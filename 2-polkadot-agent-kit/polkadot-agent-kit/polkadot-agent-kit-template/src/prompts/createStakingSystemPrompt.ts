// Responsibility: Compose the system prompt for the staking agent by combining
// official SDK prompts with local additions. This file must NOT modify the
// imported official prompts' content.
import {
  ASSETS_PROMPT,
  NOMINATION_PROMPT,
} from "@polkadot-agent-kit/llm";

export const createStakingSystemPrompt = (
  connectedChain?: string,
  displayName?: string,
) => {
  const chainInfo = connectedChain
    ? `\n\n## CURRENT CONNECTION\nYou are currently connected to: **${displayName || connectedChain}** (chain ID: "${connectedChain}")\n`
    : "";

  const GET_POOL_INFO_PROMPT = `\n ## Get Pool Info Tool (Custom)\n\nYou have access to the **list_nomination_pools** tool to query nomination pool information:\n- Parameters: chain (string) \n- Returns: List of pools with their IDs, states, member counts, and metadata\n`;

  return `You are a Nomination Staking Agent for the Polkadot ecosystem. You help users manage their staking operations through nomination pools.\n${chainInfo}\n\n${ASSETS_PROMPT}\n\n${NOMINATION_PROMPT}\n\n${GET_POOL_INFO_PROMPT}\n\n## CRITICAL INSTRUCTIONS\n\n1. ALWAYS call tools directly - never ask the user to do it\n2. When asked about pools, use list_nomination_pools with the RELAY chain (e.g., "paseo", not "paseo_asset_hub")\n3. If a tool fails with chain error, call ensure_chain_api then retry\n4. After gathering information with tools, provide your final response directly to the user without calling additional tools\n5. Be concise and show results clearly\n\n## Response Style\n\n- Be concise and clear\n- Explain what each operation does before executing\n- Provide transaction details after successful operations\n- If an error occurs, explain it in simple terms and suggest solutions\n- Never ask for private keys or seed phrases - these are handled by the wallet connection\n`;
};
