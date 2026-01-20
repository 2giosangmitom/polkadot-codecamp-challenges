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
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
// Import official prompts from the SDK
import { ASSETS_PROMPT, DYNAMIC_CHAIN_INITIALIZATION_PROMPT, NOMINATION_PROMPT } from "@polkadot-agent-kit/llm";

// Define schema outside class to avoid TypeScript inference issues
const poolInfoSchema = z.object({
  chain: z
    .string()
    .describe(
      "The relay chain to query pools from (e.g., 'paseo', 'west', 'polkadot', 'kusama'). Nomination pools exist on relay chains, not asset hub chains.",
    ),
});

const initializeChainApiSchema = z.object({
  chainId: z
    .string()
    .describe(
      "The chain ID to initialize (e.g., 'paseo', 'west_asset_hub', 'polkadot_asset_hub')",
    ),
});

export type AgentProvider = "openai" | "ollama" | "gemini";

export interface AgentResponse {
  input: string;
  output: string;
  intermediateSteps: any[];
  toolResults: any[];
  provider: AgentProvider;
  model: string;
}

export interface AgentConfig {
  provider: AgentProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  connectedChain?: string; // The chain the user is connected to
  connectedChainDisplayName?: string; // Human-readable chain name
}

// Create system prompt using SDK's official prompts combined with our additions
const createStakingSystemPrompt = (
  connectedChain?: string,
  displayName?: string,
) => {
  const chainInfo = connectedChain
    ? `\n\n## CURRENT CONNECTION\nYou are currently connected to: **${displayName || connectedChain}** (chain ID: "${connectedChain}")\n`
    : "";

  // Custom prompt for our get_pool_info tool (not in SDK)
  const GET_POOL_INFO_PROMPT = `
## Get Pool Info Tool (Custom)

You have access to the **get_pool_info** tool to query nomination pool information:
- Parameters: chain (string) - Use RELAY chains: "paseo", "west", "polkadot", "kusama"
- Returns: List of pools with their IDs, states, member counts, and metadata
- **IMPORTANT**: Nomination pools exist ONLY on RELAY chains, NOT on Asset Hub chains!
  - Paseo relay chain: "paseo"
  - Westend relay chain: "west"
  - Polkadot relay chain: "polkadot"
  - Kusama relay chain: "kusama"
  - Asset Hub chains like "paseo_asset_hub" do NOT have nomination pools
`;

  // Simplified chain initialization prompt for smaller LLMs
  const SIMPLE_CHAIN_INIT_PROMPT = `
## Chain Initialization (IMPORTANT)

When you encounter a chain-related error like "API not found" or "chain not initialized":
1. Call the **initialize_chain_api** tool with the chainId parameter
2. After initialization succeeds, retry your original operation

Chain IDs:
- Relay chains (for pool info): "paseo", "west", "polkadot", "kusama"
- Asset Hub chains (for staking operations): "paseo_asset_hub", "west_asset_hub", "polkadot_asset_hub"

IMPORTANT: Always TRY the tool call first. If it fails, then initialize the chain and retry.
Do NOT ask the user to initialize - YOU must call the initialize_chain_api tool yourself.
`;

  // Combine SDK prompts with our additions
  return `You are a Nomination Staking Agent for the Polkadot ecosystem. You help users manage their staking operations through nomination pools.
${chainInfo}

${DYNAMIC_CHAIN_INITIALIZATION_PROMPT}

${ASSETS_PROMPT}

${NOMINATION_PROMPT}

${GET_POOL_INFO_PROMPT}

## CRITICAL INSTRUCTIONS

1. ALWAYS call tools directly - never ask the user to do it
2. When asked about pools, use get_pool_info with the RELAY chain (e.g., "paseo", not "paseo_asset_hub")
3. If a tool fails with chain error, call initialize_chain_api then retry
4. Be concise and show results clearly

## Response Style

- Be concise and clear
- Explain what each operation does before executing
- Provide transaction details after successful operations
- If an error occurs, explain it in simple terms and suggest solutions
- Never ask for private keys or seed phrases - these are handled by the wallet connection
`;
};

export class AgentWrapper {
  provider: AgentProvider;
  model: string;
  private llmWithTools: any;
  private tools: any[];
  private apiKey?: string;
  private systemPrompt: string = "";
  private connectedChain?: string;
  private connectedChainDisplayName?: string;

  constructor(
    private agentKit: PolkadotAgentKit,
    config: AgentConfig,
  ) {
    this.provider = config.provider;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.connectedChain = config.connectedChain;
    this.connectedChainDisplayName = config.connectedChainDisplayName;
    this.tools = [];
  }

  // Create a custom initialize_chain_api tool since SDK doesn't provide one
  private createInitializeChainApiTool(): any {
    const agentKit = this.agentKit;

    return new DynamicStructuredTool({
      name: "initialize_chain_api",
      description:
        "Initialize the API connection for a specific chain. Call this when you encounter 'API not found' or 'chain not initialized' errors.",
      schema: initializeChainApiSchema as any,
      func: async ({
        chainId,
      }: z.infer<typeof initializeChainApiSchema>): Promise<string> => {
        try {
          console.log(`Initializing API for chain: ${chainId}`);

          // Call the SDK's initializeApi method
          await agentKit.initializeApi();

          return JSON.stringify({
            success: true,
            chainId,
            message: `Successfully initialized API for chain: ${chainId}`,
          });
        } catch (error: any) {
          console.error("Initialize chain API error:", error);
          return JSON.stringify({
            success: false,
            chainId,
            error: error.message || "Failed to initialize chain API",
          });
        }
      },
    });
  }

  // Create a custom get_pool_info tool since SDK doesn't provide one
  private createGetPoolInfoTool(): any {
    const agentKit = this.agentKit;

    // Map asset hub chains to their relay chains for pool queries
    const getRelayChain = (chain: string): string => {
      const normalized = chain.toLowerCase().trim();

      // Asset hub to relay chain mapping
      const assetHubToRelay: Record<string, string> = {
        paseo_asset_hub: "paseo",
        "paseo-asset-hub": "paseo",
        "paseo assethub": "paseo",
        west_asset_hub: "west",
        "west-asset-hub": "west",
        westend_asset_hub: "west",
        "westend-asset-hub": "west",
        polkadot_asset_hub: "polkadot",
        "polkadot-asset-hub": "polkadot",
        kusama_asset_hub: "kusama",
        "kusama-asset-hub": "kusama",
      };

      return assetHubToRelay[normalized] || chain;
    };

    return new DynamicStructuredTool({
      name: "get_pool_info",
      description:
        "Get information about all nomination pools on a specific relay chain. Returns pool IDs, states, member counts, and other details. Nomination pools exist on RELAY chains like 'paseo', 'west', 'polkadot', 'kusama', NOT on asset hub chains. If you specify an asset hub chain, it will automatically query the corresponding relay chain.",
      schema: poolInfoSchema as any,
      func: async ({
        chain,
      }: z.infer<typeof poolInfoSchema>): Promise<string> => {
        // Map asset hub chains to relay chains
        const relayChain = getRelayChain(chain);
        try {
          console.log(
            `Fetching pool info for chain: ${chain} -> relay chain: ${relayChain}`,
          );

          // Get the API for the relay chain
          let api: any;
          try {
            api = agentKit.getApi(relayChain as any);
          } catch (e: any) {
            // Chain might not be initialized yet
            return JSON.stringify({
              success: false,
              error: `Chain API not initialized for "${relayChain}". Please call initialize_chain_api first with chainId: "${relayChain}"`,
              chain: relayChain,
              originalChain: chain !== relayChain ? chain : undefined,
              hint: "The agent should call initialize_chain_api tool to initialize this chain.",
            });
          }

          if (!api) {
            return JSON.stringify({
              success: false,
              error: `API not available for chain "${relayChain}". Please initialize it first.`,
              chain: relayChain,
              originalChain: chain !== relayChain ? chain : undefined,
            });
          }

          // Try to get all pools using the exact same pattern as SDK's getAllPoolsInfo
          try {
            // Check if NominationPools pallet exists
            if (!api.query?.NominationPools) {
              return JSON.stringify({
                success: false,
                error: `NominationPools pallet not available on ${relayChain}. Nomination pools only exist on relay chains.`,
                chain: relayChain,
                originalChain: chain !== relayChain ? chain : undefined,
              });
            }

            // Get all pool entries using the SDK pattern
            const allPoolEntries =
              await api.query.NominationPools.BondedPools.getEntries();

            if (!allPoolEntries || allPoolEntries.length === 0) {
              return JSON.stringify({
                success: true,
                chain: relayChain,
                originalChain: chain !== relayChain ? chain : undefined,
                poolCount: 0,
                pools: [],
                message: "No nomination pools found on this chain.",
              });
            }

            // Format the pools using the SDK's pattern
            const pools = allPoolEntries.slice(0, 20).map((entry: any) => {
              const poolId = entry.keyArgs[0];
              const poolInfo = entry.value;

              return {
                id: typeof poolId === "number" ? poolId : Number(poolId),
                state:
                  poolInfo.state?.type || String(poolInfo.state) || "Unknown",
                points: poolInfo.points?.toString() || "0",
                memberCount: poolInfo.member_counter || 0,
                roles: {
                  depositor: poolInfo.roles?.depositor || "Unknown",
                  root:
                    poolInfo.roles?.root?.value || poolInfo.roles?.root || null,
                  nominator:
                    poolInfo.roles?.nominator?.value ||
                    poolInfo.roles?.nominator ||
                    null,
                  bouncer:
                    poolInfo.roles?.bouncer?.value ||
                    poolInfo.roles?.bouncer ||
                    null,
                },
              };
            });

            return JSON.stringify({
              success: true,
              chain: relayChain,
              originalChain: chain !== relayChain ? chain : undefined,
              poolCount: allPoolEntries.length,
              pools,
              message:
                allPoolEntries.length > 20
                  ? `Showing first 20 of ${allPoolEntries.length} pools.`
                  : `Found ${allPoolEntries.length} nomination pool(s).`,
            });
          } catch (queryError: any) {
            console.error("Pool query error:", queryError);
            return JSON.stringify({
              success: false,
              error: `Failed to query pools: ${queryError.message}`,
              chain: relayChain,
              originalChain: chain !== relayChain ? chain : undefined,
              hint: "Make sure the chain API is properly initialized with initialize_chain_api tool.",
            });
          }
        } catch (error: any) {
          console.error("Get pool info error:", error);
          return JSON.stringify({
            success: false,
            error: error.message || "Unknown error fetching pool info",
            chain: relayChain,
            originalChain: chain !== relayChain ? chain : undefined,
          });
        }
      },
    });
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

    // Get SDK tools
    this.tools = getLangChainTools(this.agentKit);

    // Add custom tools since SDK doesn't provide them
    const getPoolInfoTool = this.createGetPoolInfoTool();
    const initializeChainApiTool = this.createInitializeChainApiTool();
    this.tools.push(getPoolInfoTool, initializeChainApiTool);

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
        if (tr.tool === "get_pool_info") {
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

        if (tr.tool === "get_pool_info") {
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

    // Show which chain we're actually querying if it was mapped
    if (result.originalChain && result.chain !== result.originalChain) {
      output += `*Note: "${result.originalChain}" was mapped to relay chain "${result.chain}" for pool query*\n\n`;
    }

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
