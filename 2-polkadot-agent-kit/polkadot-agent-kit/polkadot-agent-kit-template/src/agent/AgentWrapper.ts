import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { PolkadotAgentKit, getLangChainTools } from "@polkadot-agent-kit/sdk";
// Official prompts are composed in the prompt builder. Do not import them here.
import type { AgentProvider } from "./types";

import { createStakingSystemPrompt } from "../prompts/createStakingSystemPrompt";
import { createGetPoolInfoAction } from "../actions/listNominationPools.action";
import { createInitializeChainApiAction } from "../actions/ensureChainApi.action";
import { createCheckUserPoolAction } from "../actions/checkUserPool.action";
import type { AgentConfig, AgentResponse } from "./types";

export class AgentWrapper {
  provider: AgentProvider;
  model: string;
  private llmWithTools: any;
  private tools: any[];
  private apiKey?: string;
  private systemPrompt: string = "";
  private connectedChain?: string;
  private connectedChainDisplayName?: string;

  constructor(private agentKit: PolkadotAgentKit, config: AgentConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.connectedChain = config.connectedChain;
    this.connectedChainDisplayName = config.connectedChainDisplayName;
    this.tools = [];
  }





  async init(systemPrompt?: string) {
    console.log(`Initializing ${this.provider} with model: ${this.model}`);
    console.log(`Connected chain: ${this.connectedChain || "not specified"}`);

    // Create staking system prompt with connected chain info
    const basePrompt = createStakingSystemPrompt(
      this.connectedChain,
      this.connectedChainDisplayName,
    );

    // Use base prompt, or combine with custom prompt if provided
    this.systemPrompt = systemPrompt
      ? `${basePrompt}\n\nAdditional instructions: ${systemPrompt}`
      : basePrompt;

    // Register custom tools with agentKit so LangChain tools include them
    this.agentKit.addCustomTools([
      createGetPoolInfoAction(this.agentKit),
      createCheckUserPoolAction(this.agentKit),
      createInitializeChainApiAction(this.agentKit),
    ]);

    // Get SDK tools
    this.tools = getLangChainTools(this.agentKit);

    // Log available tools
    console.log(
      "Available tools:",
      this.tools.map((t: any) => t.name).join(", "),
    );

    // Create LLM based on provider
    let llm;
    switch (this.provider) {
      case "gemini":
        if (!this.apiKey) {
          throw new Error("Gemini API key is required");
        }
        llm = new ChatGoogleGenerativeAI({
          model: this.model,
          apiKey: this.apiKey,
          convertSystemMessageToHumanContent: true,
        });
        break;

      case "openai":
        if (!this.apiKey) {
          throw new Error("OpenAI API key is required");
        }
        llm = new ChatOpenAI({
          model: this.model,
          apiKey: this.apiKey,
        });
        break;

      case "ollama":
        llm = new ChatOllama({
          model: this.model,
          baseUrl: "http://localhost:11434",
        });
        break;

      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }

    // Bind tools to the LLM
    this.llmWithTools = llm.bindTools(this.tools);

    console.log("Agent initialized successfully");
  }

  async ask(query: string): Promise<AgentResponse> {
    if (!this.llmWithTools) {
      throw new Error("Agent not initialized. Call init() first.");
    }

    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(query),
    ];

    const intermediateSteps: any[] = [];
    const toolResults: any[] = [];
    let currentMessages: BaseMessage[] = messages;
    let iterations = 0;
    const maxIterations = 15;

    // Agent loop: invoke LLM, check for tool calls, execute tools, repeat
    while (iterations < maxIterations) {
      iterations++;

      const response = await this.llmWithTools.invoke(currentMessages);
      intermediateSteps.push(response);

      // Check if there are tool calls
      if (!response.tool_calls || response.tool_calls.length === 0) {
        // No more tool calls, return the final response
        let output =
          typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content);

        // If the LLM response is empty or too short but we have tool results,
        // format the tool results nicely for the user
        if ((!output || output.trim().length < 20) && toolResults.length > 0) {
          output = this.formatToolResults(toolResults);
        } else if (
          toolResults.length > 0 &&
          !this.outputContainsToolData(output, toolResults)
        ) {
          // If the output doesn't seem to contain the tool data, append it
          output = output + "\n\n" + this.formatToolResults(toolResults);
        }

        return {
          input: query,
          output,
          intermediateSteps,
          toolResults,
          provider: this.provider,
          model: this.model,
        };
      }

      // Execute tool calls
      currentMessages = [...currentMessages, response];

      for (const toolCall of response.tool_calls) {
        try {
          console.log(`Executing tool: ${toolCall.name}`, toolCall.args);

          const tool = this.tools.find((t: any) => t.name === toolCall.name);
          if (!tool) {
            throw new Error(`Tool ${toolCall.name} not found`);
          }

          const toolResult = await tool.invoke(toolCall.args);
          console.log(`Tool result:`, toolResult);

          // Store tool result for later formatting
          toolResults.push({
            tool: toolCall.name,
            args: toolCall.args,
            result: toolResult,
            success: true,
          });

          // Use ToolMessage for tool results (LangChain standard)
          currentMessages.push(
            new ToolMessage({
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id || toolCall.name,
            }),
          );
          intermediateSteps.push({
            tool: toolCall.name,
            args: toolCall.args,
            result: toolResult,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`Tool error:`, errorMessage);

          // Store error for later
          toolResults.push({
            tool: toolCall.name,
            args: toolCall.args,
            error: errorMessage,
            success: false,
          });

          // Use ToolMessage for errors too
          currentMessages.push(
            new ToolMessage({
              content: `Error: ${errorMessage}`,
              tool_call_id: toolCall.id || toolCall.name,
            }),
          );
          intermediateSteps.push({
            tool: toolCall.name,
            args: toolCall.args,
            error: errorMessage,
          });
        }
      }
    }

    // Max iterations reached
    return {
      input: query,
      output: "Maximum iterations reached without completing the task.",
      intermediateSteps,
      toolResults,
      provider: this.provider,
      model: this.model,
    };
  }

  // Check if the LLM output contains key data from tool results
  private outputContainsToolData(output: string, toolResults: any[]): boolean {
    const outputLower = output.toLowerCase();

    for (const tr of toolResults) {
      if (tr.success && tr.result) {
        // Check for common pool info fields
        if (tr.tool === "list_nomination_pools") {
          // If it mentions pool or the result contains data that should be in output
          const result = tr.result;
          if (typeof result === "object") {
            // Check if output mentions pools or specific data
            if (
              result.pools &&
              Array.isArray(result.pools) &&
              result.pools.length > 0
            ) {
              // Check if any pool ID is mentioned
              const hasPoolData = result.pools.some(
                (p: any) =>
                  outputLower.includes(String(p.id)) ||
                  outputLower.includes(String(p.memberCount)),
              );
              if (!hasPoolData) return false;
            }
          }
        }
      }
    }
    return true;
  }

  // Format tool results into a readable string
  private formatToolResults(toolResults: any[]): string {
    const parts: string[] = [];

    for (const tr of toolResults) {
      if (tr.success) {
        const toolName = tr.tool
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase());

        if (tr.tool === "list_nomination_pools") {
          parts.push(this.formatPoolInfo(tr.result));
        } else if (tr.tool === "join_pool") {
          parts.push(
            `**Pool Joined Successfully!**\n${this.formatTransactionResult(tr.result)}`,
          );
        } else if (tr.tool === "bond_extra") {
          parts.push(
            `**Bond Extra Successful!**\n${this.formatTransactionResult(tr.result)}`,
          );
        } else if (tr.tool === "unbond") {
          parts.push(
            `**Unbond Initiated!**\n${this.formatTransactionResult(tr.result)}`,
          );
        } else if (tr.tool === "withdraw_unbonded") {
          parts.push(
            `**Withdrawal Successful!**\n${this.formatTransactionResult(tr.result)}`,
          );
        } else if (tr.tool === "claim_rewards") {
          parts.push(
            `**Rewards Claimed!**\n${this.formatTransactionResult(tr.result)}`,
          );
        } else {
          parts.push(
            `**${toolName} Result:**\n\`\`\`json\n${JSON.stringify(tr.result, null, 2)}\n\`\`\``,
          );
        }
      } else {
        parts.push(`**Error in ${tr.tool}:** ${tr.error}`);
      }
    }

    return parts.join("\n\n");
  }

  // Format pool info into readable format
  private formatPoolInfo(result: any): string {
    if (!result) return "No pool information available.";

    let output = "**Nomination Pools Information**\n\n";

    // Prefer to show the chain field provided by the tool

    if (result.pools && Array.isArray(result.pools)) {
      if (result.pools.length === 0) {
        output += `No nomination pools found on ${result.chain}.`;
        return output;
      }

      output += `Found **${result.poolCount || result.pools.length}** pool(s) on **${result.chain}**:\n\n`;

      for (const pool of result.pools) {
        output += `---\n`;
        output += `**Pool #${pool.id}**\n`;
        if (pool.state) output += `- State: ${pool.state}\n`;
        if (pool.memberCount !== undefined)
          output += `- Members: ${pool.memberCount}\n`;
        if (pool.points) output += `- Points: ${pool.points}\n`;
        if (pool.roles) {
          output += `- Depositor: ${this.truncateAddress(pool.roles.depositor)}\n`;
          if (pool.roles.root)
            output += `- Root: ${this.truncateAddress(pool.roles.root)}\n`;
          if (pool.roles.nominator)
            output += `- Nominator: ${this.truncateAddress(pool.roles.nominator)}\n`;
        }
        output += "\n";
      }

      if (result.message) {
        output += `*${result.message}*\n`;
      }
    } else if (typeof result === "object") {
      // Error or different format
      if (result.error) {
        output += `**Error:** ${result.error}\n`;
        if (result.hint) {
          output += `*Hint: ${result.hint}*\n`;
        }
      } else {
        output += `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      }
    }

    return output;
  }

  // Format transaction result
  private formatTransactionResult(result: any): string {
    if (!result) return "Transaction completed.";

    let output = "";
    if (result.status) output += `- Status: ${result.status}\n`;
    if (result.blockHash)
      output += `- Block Hash: ${this.truncateAddress(result.blockHash)}\n`;
    if (result.txHash)
      output += `- Tx Hash: ${this.truncateAddress(result.txHash)}\n`;
    if (result.events) output += `- Events: ${result.events.length} event(s)\n`;

    return output || `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }

  // Helper to truncate addresses for display
  private truncateAddress(addr: string): string {
    if (!addr || addr.length < 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  }

  isReady(): boolean {
    return !!this.llmWithTools;
  }

  getAvailableTools(): string[] {
    return this.tools.map((t: any) => t.name);
  }

  getConnectedChain(): string | undefined {
    return this.connectedChain;
  }

  getConnectedChainDisplayName(): string | undefined {
    return this.connectedChainDisplayName;
  }
}
