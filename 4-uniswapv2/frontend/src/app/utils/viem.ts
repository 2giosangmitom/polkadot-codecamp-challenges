import { createPublicClient, http, createWalletClient, custom } from "viem";
import "viem/window";
// Official RPC for Paseo Asset Hub testnet (from README).
const transport = http("https://testnet-passet-hub-eth-rpc.polkadot.io");
// Configure the Paseo Asset Hub chain
export const passetHub = {
  id: 420420422,
  name: "Paseo Asset Hub",
  network: "paseo-asset-hub",
  nativeCurrency: {
    decimals: 18,
    name: "PAS",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-passet-hub-eth-rpc.polkadot.io"],
    },
  },
} as const;
// Optional local dev chain (unchanged if you still want it elsewhere)
export const localNode = {
  id: 31337,
  name: "Localhost",
  network: "localhost",
  nativeCurrency: {
    decimals: 18,
    name: "PAS",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
  },
} as const;
// Public client for reads on testnet
export const publicClient = createPublicClient({
  chain: passetHub,
  transport,
});
// Wallet client for signing + sending transactions through MetaMask
export const getWalletClient = async () => {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not detected');
  }
  const [account] = await window.ethereum.request({
    method: 'eth_requestAccounts',
  }) as [`0x${string}`];
  return createWalletClient({
    chain: passetHub,
    account,
    transport: custom(window.ethereum),
  });
};
