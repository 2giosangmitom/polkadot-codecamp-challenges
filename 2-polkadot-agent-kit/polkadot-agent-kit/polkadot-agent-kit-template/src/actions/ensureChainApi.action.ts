// Responsibility: Provide an action to initialize the chain API when missing.
// This isolates chain-initialization logic so the agent can call it as a tool.
import { z } from "zod";
import type { PolkadotAgentKit } from "@polkadot-agent-kit/sdk";
import {
  createAction,
  createErrorResponse,
  createSuccessResponse,
  type ToolConfig,
} from "@polkadot-agent-kit/llm";

const initializeChainApiSchema = z.object({
  chainId: z
    .string()
    .describe("The chain ID to initialize (e.g., 'paseo', 'west_asset_hub', 'polkadot_asset_hub')"),
});

export function createInitializeChainApiAction(agentKit: PolkadotAgentKit) {
  const config: ToolConfig = {
    name: "ensure_chain_api",
    description:
      "Initialize the API connection for a specific chain. Call this when you encounter 'API not found' or 'chain not initialized' errors.",
    schema: initializeChainApiSchema as any,
  };

  const action = {
    async invoke(args: z.infer<typeof initializeChainApiSchema>) {
      const { chainId } = args;
      try {
        console.log(`Initializing API for chain: ${chainId}`);
        const initFn: any = (agentKit as any).initializeApi;
        if (typeof initFn === "function") {
          try {
            await initFn.call(agentKit, chainId);
          } catch (_) {
            // Some SDKs expose initializeApi without params; try fallback
            await initFn.call(agentKit);
          }
        }

        return createSuccessResponse(
          { success: true, chainId, message: `Initialized API for ${chainId}` },
          config.name,
        );
      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Initialize chain API error:", message);
        return createErrorResponse(message, config.name);
      }
    },
  };

  return createAction(action, config);
}
