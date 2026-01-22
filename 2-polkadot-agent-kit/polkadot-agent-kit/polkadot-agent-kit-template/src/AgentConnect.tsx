import { useState, FormEvent, useRef, useEffect } from "react";
import { PolkadotAgentKit } from "@polkadot-agent-kit/sdk";
import { AgentWrapper, AgentProvider } from "./agent/AgentWrapper";
import Markdown from "react-markdown";
import {
  useAccount,
  useConnect,
  useChain,
  useAccounts,
  ConnectionStatus,
} from "@luno-kit/react";

export type AgentFormValues = {
  llmProvider: AgentProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
};

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

const STAKING_QUICK_ACTIONS = [
  {
    label: "Get Pool Info (Westend)",
    prompt: "Get information about nomination pools on west",
  },
  {
    label: "Get Pool Info (Paseo)",
    prompt: "Get information about nomination pools on paseo",
  },
  {
    label: "Join Pool",
    prompt: "Join nomination pool with 1 WND on west_asset_hub",
  },
  {
    label: "Bond Extra",
    prompt: "Bond extra 0.5 WND to my pool on west_asset_hub",
  },
  {
    label: "Claim Rewards",
    prompt: "Claim my staking rewards on west_asset_hub",
  },
  { label: "Unbond", prompt: "Unbond 0.5 WND from my pool on west_asset_hub" },
  {
    label: "Withdraw",
    prompt: "Withdraw my unbonded tokens on west_asset_hub",
  },
];

// Map LunoKit chain names to polkadot-agent-kit chain names
// LunoKit may return various formats, so we normalize and check multiple patterns
const getAgentChainId = (chainName: string | undefined): string => {
  if (!chainName) return "west_asset_hub";

  const normalized = chainName.toLowerCase().trim();

  // Direct mapping
  const CHAIN_MAPPING: Record<string, string> = {
    // Asset Hub chains (required for staking)
    "westend asset hub": "west_asset_hub",
    "westend assethub": "west_asset_hub",
    "westend-asset-hub": "west_asset_hub",
    west_asset_hub: "west_asset_hub",
    "polkadot asset hub": "polkadot_asset_hub",
    "polkadot assethub": "polkadot_asset_hub",
    "polkadot-asset-hub": "polkadot_asset_hub",
    polkadot_asset_hub: "polkadot_asset_hub",
    "kusama asset hub": "kusama_asset_hub",
    "kusama assethub": "kusama_asset_hub",
    "kusama-asset-hub": "kusama_asset_hub",
    kusama_asset_hub: "kusama_asset_hub",
    "paseo asset hub": "paseo_asset_hub",
    "paseo assethub": "paseo_asset_hub",
    "paseo-asset-hub": "paseo_asset_hub",
    paseo_asset_hub: "paseo_asset_hub",
    // Relay chains
    polkadot: "polkadot",
    kusama: "kusama",
    westend: "west",
    west: "west",
    paseo: "paseo",
  };

  // Try direct match first
  if (CHAIN_MAPPING[normalized]) {
    return CHAIN_MAPPING[normalized];
  }

  // Try pattern matching for asset hub chains
  if (
    normalized.includes("paseo") &&
    (normalized.includes("asset") || normalized.includes("hub"))
  ) {
    return "paseo_asset_hub";
  }
  if (
    normalized.includes("westend") &&
    (normalized.includes("asset") || normalized.includes("hub"))
  ) {
    return "west_asset_hub";
  }
  if (
    normalized.includes("polkadot") &&
    (normalized.includes("asset") || normalized.includes("hub"))
  ) {
    return "polkadot_asset_hub";
  }
  if (
    normalized.includes("kusama") &&
    (normalized.includes("asset") || normalized.includes("hub"))
  ) {
    return "kusama_asset_hub";
  }

  // Fallback to relay chain matching
  if (normalized.includes("paseo")) return "paseo";
  if (normalized.includes("westend") || normalized.includes("west"))
    return "west";
  if (normalized.includes("polkadot")) return "polkadot";
  if (normalized.includes("kusama")) return "kusama";

  // Default fallback
  console.warn(
    `Unknown chain name: "${chainName}", defaulting to west_asset_hub`,
  );
  return "west_asset_hub";
};

// Map an agent chain (could be an asset hub) to its relay chain for pool queries
const mapToRelayChain = (agentChainId: string) => {
  const normalized = agentChainId.toLowerCase().trim();
  const map: Record<string, string> = {
    paseo_asset_hub: "paseo",
    west_asset_hub: "west",
    polkadot_asset_hub: "polkadot",
    kusama_asset_hub: "kusama",
  };
  return map[normalized] || agentChainId;
};

const AgentConnect = () => {
  // LunoKit hooks
  const { account } = useAccount();
  const { accounts } = useAccounts();
  const { status: connectionStatus } = useConnect();
  const { chain } = useChain();

  const isWalletConnected =
    connectionStatus === ConnectionStatus.Connected && account;

  // LLM Configuration state
  const [llmProvider, setLlmProvider] = useState<AgentProvider>("ollama");
  const [model, setModel] = useState("llama3.2:3b");
  const [apiKey, setApiKey] = useState("");

  // Agent state
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentInstance, setAgentInstance] = useState<AgentWrapper | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modelSuggestions: Record<AgentProvider, string[]> = {
    openai: ["gpt-4", "gpt-4o", "gpt-3.5-turbo"],
    ollama: ["llama3.2:3b", "qwen2.5:3b", "qwen3:latest"],
    gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
  };

  const requiresApiKey = (provider: AgentProvider): boolean => {
    return provider === "openai" || provider === "gemini";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Disconnect agent when wallet disconnects
  useEffect(() => {
    if (!isWalletConnected && isAgentConnected) {
      handleDisconnect();
    }
  }, [isWalletConnected, isAgentConnected]);

  const handleConnectAgent = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!account) {
      setError(
        "Please connect your wallet first using the Connect button in the header",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get chain name for polkadot-agent-kit (may be asset hub)
      const agentChain = getAgentChainId(chain?.name);
      const relayChainForPools = mapToRelayChain(agentChain);

      console.log("Creating PolkadotAgentKit instance...");
      console.log("LunoKit chain name:", chain?.name);
      console.log("Using account:", account.address);
      console.log(
        "Using agent chain:",
        agentChain,
        "(relay for pools:",
        relayChainForPools,
        ")",
      );

      // For LunoKit integration, we need to use a signer approach
      // But for now, we'll ask for seed phrase since polkadot-agent-kit needs it
      const seedPhrase = prompt(
        "Enter your seed phrase to sign transactions (this is only used locally):",
      );

      if (!seedPhrase) {
        throw new Error("Seed phrase is required to initialize the agent");
      }

      // Initialize agent with all relay chains that have nomination pools
      // Nomination pools exist on relay chains, not asset hubs
      const relayChains = [
        // "west",
        // "west_asset_hub",
        // "paseo",
        "paseo_asset_hub",
      ];
      const agentKit = new PolkadotAgentKit({
        privateKey: seedPhrase,
        keyType: "Sr25519",
        chains: relayChains as any,
      });

      console.log("Initializing blockchain APIs...");
      await agentKit.initializeApi();

      console.log("Setting up LLM agent...");
      const agent = new AgentWrapper(agentKit, {
        provider: llmProvider,
        model,
        apiKey: requiresApiKey(llmProvider) ? apiKey : undefined,
        connectedChain: agentChain,
        connectedChainDisplayName: chain?.name || agentChain,
        connectedAccount: account.address,
      });

      console.log("Initializing agent executor...");
      await agent.init();

      setAgentInstance(agent);
      setIsAgentConnected(true);

      // Add welcome message with asset hub vs relay guidance
      const connectedAccountLabel =
        account.name || account.address.slice(0, 8) + "...";
      const agentChainLabel = chain?.name || agentChain;
      const relayInfo = agentChain.endsWith("_asset_hub")
        ? `Note: You are connected to an Asset Hub (${agentChainLabel}). Nomination pools exist on the corresponding relay chain (${mapToRelayChain(agentChain)}).`
        : `Connected to relay chain: ${mapToRelayChain(agentChain)}.`;

      setMessages([
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `Welcome to the Nomination Staking Agent!\n\nConnected Account: ${connectedAccountLabel}\nChain: ${agentChainLabel} (chain id: ${agentChain})\n${relayInfo}\nModel: ${model}\n\nI can help you with:\n- Joining nomination pools\n- Bonding extra tokens\n- Unbonding tokens\n- Withdrawing unbonded tokens\n- Claiming rewards\n- Getting pool information (use relay chain names like 'west' or 'paseo' for pool queries)\n\nHow can I assist you today?`,
          timestamp: new Date(),
        },
      ]);

      console.log("Agent connected and ready!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect agent");
      console.error("Error connecting agent:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setIsAgentConnected(false);
    setAgentInstance(null);
    setMessages([]);
    console.log("Agent disconnected");
  };

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || !agentInstance || isSending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageToSend,
      timestamp: new Date(),
    };

    const loadingMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInputMessage("");
    setIsSending(true);

    try {
      const response = await agentInstance.ask(messageToSend);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? { ...msg, content: response.output, isLoading: false }
            : msg,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
                isLoading: false,
              }
            : msg,
        ),
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="agent-container">
      {!isAgentConnected ? (
        <div className="connect-wrapper">
          <div className="connect-hero">
            <div className="hero-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                />
              </svg>
            </div>
            <h2>Nomination Staking Agent</h2>
            <p>AI-powered staking operations for Polkadot ecosystem</p>
          </div>

          {/* Wallet Status Section */}
          <div className="wallet-status-section">
            {isWalletConnected ? (
              <div className="wallet-connected-info">
                <div className="wallet-status-header">
                  <span className="status-dot connected"></span>
                  <span>Wallet Connected</span>
                </div>
                <div className="wallet-details">
                  <div className="wallet-detail-item">
                    <span className="detail-label">Account</span>
                    <span className="detail-value">
                      {account.name || account.address.slice(0, 12) + "..."}
                    </span>
                  </div>
                  <div className="wallet-detail-item">
                    <span className="detail-label">Address</span>
                    <span className="detail-value address">
                      {account.address.slice(0, 8)}...
                      {account.address.slice(-6)}
                    </span>
                  </div>
                  <div className="wallet-detail-item">
                    <span className="detail-label">Chain</span>
                    <span className="detail-value">
                      {chain?.name || "Unknown"}
                    </span>
                  </div>
                  {accounts && accounts.length > 1 && (
                    <div className="wallet-detail-item">
                      <span className="detail-label">All Accounts</span>
                      <span className="detail-value">
                        {accounts.length} accounts available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="wallet-not-connected">
                <div className="wallet-status-header">
                  <span className="status-dot disconnected"></span>
                  <span>Wallet Not Connected</span>
                </div>
                <p>
                  Please connect your wallet using the button in the header to
                  continue.
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleConnectAgent} className="agent-form">
            <div className="form-section">
              <div className="section-header">
                <div className="section-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23.693L5 15.3m14.8 0 .21 1.047a3.75 3.75 0 0 1-2.672 4.377l-2.338.585a9.06 9.06 0 0 1-4.5 0l-2.338-.585a3.75 3.75 0 0 1-2.672-4.377l.21-1.047"
                    />
                  </svg>
                </div>
                <h3>AI Model Configuration</h3>
              </div>

              <label>
                <span className="label-text">LLM Provider</span>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const provider = e.target.value as AgentProvider;
                    setLlmProvider(provider);
                    setModel(modelSuggestions[provider][0]);
                  }}
                  required
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>

              <label>
                <span className="label-text">Model</span>
                <div className="model-select-wrapper">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    required
                    className="model-select"
                  >
                    {modelSuggestions[llmProvider].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {llmProvider === "ollama" && (
                    <div className="model-badges">
                      {modelSuggestions.ollama.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`model-badge ${model === m ? "active" : ""}`}
                          onClick={() => setModel(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {requiresApiKey(llmProvider) && (
                <label>
                  <span className="label-text">API Key</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${llmProvider} API key`}
                    required
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="error-banner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="connect-btn"
              disabled={loading || !isWalletConnected}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Connecting Agent...
                </>
              ) : !isWalletConnected ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
                    />
                  </svg>
                  Connect Wallet First
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                  Start Staking Agent
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="chat-wrapper">
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <div className="connection-status">
                <span className="status-dot connected"></span>
                <span>Agent Active</span>
              </div>
            </div>

            <div className="sidebar-section">
              <h4>Wallet</h4>
              <div className="config-item">
                <span className="config-label">Account</span>
                <span className="config-value">
                  {account?.name || "Unknown"}
                </span>
              </div>
              <div className="config-item">
                <span className="config-label">Chain</span>
                <span className="config-value">{chain?.name || "Unknown"}</span>
              </div>
              {accounts && accounts.length > 1 && (
                <div className="config-item">
                  <span className="config-label">Accounts</span>
                  <span className="config-value">
                    {accounts.length} available
                  </span>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <h4>AI Model</h4>
              <div className="config-item">
                <span className="config-label">Model</span>
                <span className="config-value">{model}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Provider</span>
                <span className="config-value">{llmProvider}</span>
              </div>
            </div>

            <div className="sidebar-section">
              <h4>Quick Actions</h4>
              <div className="quick-actions">
                {STAKING_QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    className="quick-action-btn"
                    onClick={() => handleSendMessage(action.prompt)}
                    disabled={isSending}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleDisconnect} className="disconnect-btn">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9"
                />
              </svg>
              Stop Agent
            </button>
          </div>

          <div className="chat-main">
            <div className="chat-header">
              <h3>Nomination Staking Agent</h3>
              <div className="header-badge">
                <span className="model-indicator">{model}</span>
              </div>
            </div>

            <div className="messages-container">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === "user" ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86zm2-15.86c1.03.13 2 .45 2.87.93H13v-.93zM13 7h5.24c.25.31.48.65.68 1H13V7zm0 3h6.74c.08.33.15.66.19 1H13v-1zm0 9.93V19h2.87c-.87.48-1.84.8-2.87.93zM18.24 17H13v-1h5.92c-.2.35-.43.69-.68 1zm1.5-3H13v-1h6.93c-.04.34-.11.67-.19 1z" />
                      </svg>
                    )}
                  </div>
                  <div className="message-content">
                    {msg.isLoading ? (
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <div className="message-text">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about staking operations..."
                disabled={isSending}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isSending}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConnect;
