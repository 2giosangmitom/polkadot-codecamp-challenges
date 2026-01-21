"use client";

import { useState } from "react";
import { factoryAbi } from "../config/abis";
import { FACTORY_ADDRESS, TOKENS } from "../config/dex";
import { getWalletClient, publicClient } from "../utils/viem";

export function CreatePool({ account }: { account: string | null }) {
  const [tokenA, setTokenA] = useState(TOKENS[0]);
  const [tokenB, setTokenB] = useState(TOKENS[1]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (tokenA.address === tokenB.address) {
      setStatus("Choose two distinct tokens");
      return;
    }
    if (!account) {
      setStatus("Please connect wallet first");
      return;
    }
    setBusy(true);
    setStatus("Requesting wallet signature...");
    try {
      const wallet = await getWalletClient();
      const existing: `0x${string}` = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "getPair",
        args: [tokenA.address, tokenB.address],
      }) as `0x${string}`;
      if (existing !== "0x0000000000000000000000000000000000000000") {
        setStatus("Pair already exists");
        setBusy(false);
        return;
      }

      const hash = await wallet.writeContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createPair",
        args: [tokenA.address, tokenB.address],
        gas: 3000000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Pair created");
    } catch (err: any) {
      console.error(err);
      setStatus(err?.shortMessage || err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full max-w-lg space-y-3">
      <h2 className="text-lg font-bold">Create Pool</h2>
      <div className="flex gap-2">
        <select
          className="border rounded px-2 py-1 flex-1"
          value={tokenA.address}
          onChange={(e) => {
            const next = TOKENS.find((t) => t.address === e.target.value)
            if (next) setTokenA(next)
          }}
        >
          {TOKENS.map((t) => (
            <option key={t.address} value={t.address}>
              {t.symbol}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 flex-1"
          value={tokenB.address}
          onChange={(e) => {
            const next = TOKENS.find((t) => t.address === e.target.value)
            if (next) setTokenB(next)
          }}
        >
          {TOKENS.map((t) => (
            <option key={t.address} value={t.address}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <button
        disabled={busy}
        onClick={handleCreate}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded disabled:bg-gray-300"
      >
        {busy ? "Working..." : "Create"}
      </button>
      {status && <p className="text-sm text-gray-700 break-words">{status}</p>}
    </div>
  );
}
