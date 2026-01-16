"use client";

import { useState } from "react";
import { erc20Abi } from "../config/abis";
import { TOKENS } from "../config/dex";
import { getWalletClient, publicClient } from "../utils/viem";

export function Faucet() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const mint = async (addr: `0x${string}`, symbol: string) => {
    setBusy(true);
    setStatus(`Minting ${symbol}...`);
    try {
      const wallet = await getWalletClient();
      
      // Skip simulation and send directly with explicit gas to avoid RPC estimation issues
      const hash = await wallet.writeContract({
        address: addr,
        abi: erc20Abi,
        functionName: "faucet",
        args: [],
        gas: 50000n, // enough for faucet() based on Hardhat result (10741)
      });
      
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`Minted ${symbol}`);
    } catch (err: any) {
      console.error(err);
      const msg = err?.cause?.reason || err?.shortMessage || err?.message || "Failed";
      setStatus(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full max-w-lg space-y-3">
      <h2 className="text-lg font-bold">Faucet</h2>
      <div className="flex flex-wrap gap-2">
        {TOKENS.filter((t) => t.faucet).map((t) => (
          <button
            key={t.address}
            disabled={busy}
            onClick={() => mint(t.address, t.symbol)}
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-3 rounded disabled:bg-gray-300"
          >
            Mint {t.symbol}
          </button>
        ))}
      </div>
      {status && <p className="text-sm text-gray-700 break-words">{status}</p>}
    </div>
  );
}
