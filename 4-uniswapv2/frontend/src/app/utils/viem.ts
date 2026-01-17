import { createPublicClient, http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
// Testnet account for writes (fund this via PAS faucet on Paseo Asset Hub)
// NOTE: this is exposed client-side, so ONLY use a throwaway key with faucet funds.
const pk = process.env.NEXT_PUBLIC_TESTNET_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const testAccount = pk ? privateKeyToAccount(pk) : undefined;
// Wallet client for signing + sending transactions directly through the testnet RPC
export const getWalletClient = async () => {
  if (!testAccount) {
    throw new Error(
      "NEXT_PUBLIC_TESTNET_PRIVATE_KEY is not set in frontend .env"
    );
  }
  return createWalletClient({
    chain: passetHub,
    account: testAccount,
    transport,
  });
};
