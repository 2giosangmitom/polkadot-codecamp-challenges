// Responsibility: Public types used by the AgentWrapper and external callers.
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
