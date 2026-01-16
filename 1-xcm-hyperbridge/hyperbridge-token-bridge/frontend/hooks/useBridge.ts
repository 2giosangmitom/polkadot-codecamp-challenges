import { useState } from "react";
import { ethers } from "ethers";
import TOKEN_BRIDGE from "../abi/TOKEN_BRIDGE.json";

// Replace with your actual deployed TokenBridge address on the relevant chain
// For testing on BSC Testnet, use the address you deployed earlier.
const TOKEN_BRIDGE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_BRIDGE_ADDRESS || "0x0000000000000000000000000000000000000000";

export function useBridge() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any>(null);

  const bridgeTokens = async ({
    token,
    symbol,
    amount,
    destChainId,
  }: {
    token: string;
    symbol: string;
    amount: string;
    destChainId: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      setReceipt(null);

      if (!window.ethereum) throw new Error("No crypto wallet found");

      // Connect to wallet
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(
        TOKEN_BRIDGE_CONTRACT_ADDRESS,
        TOKEN_BRIDGE.abi,
        signer
      );

      // Get recipient address (self)
      const recipient = await signer.getAddress();

      // Convert amount to BigNumber (assuming 18 decimals)
      const amountParsed = ethers.parseUnits(amount, 18);

      // Convert destChainId to bytes (e.g. "11155111" for Sepolia)
      // Note: The destChain format depends on how Hyperbridge expects it. 
      // If it expects the chain ID as string bytes:
      const destChain = ethers.toUtf8Bytes(destChainId.toString());

      // Approve token first (if it's an ERC20)
      // This is a simplified example; in production, check allowance first.
      const tokenContract = new ethers.Contract(
        token,
        [
            "function approve(address spender, uint256 amount) public returns (bool)"
        ],
        signer
      );
      
      console.log("Approving token...");
      const approveTx = await tokenContract.approve(TOKEN_BRIDGE_CONTRACT_ADDRESS, amountParsed);
      await approveTx.wait();
      console.log("Token approved");

      // Send bridge transaction
      console.log("Bridging tokens...");
      const tx = await contract.bridgeTokens(
        token,
        symbol,
        amountParsed,
        recipient,
        destChain,
        { value: 0 } // Add value if native fee is required
      );

      const txReceipt = await tx.wait();
      setReceipt(txReceipt);

      return txReceipt;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { bridgeTokens, loading, error, receipt };
}
