"use client";

import { useState } from "react";
import { erc20Abi, factoryAbi, pairAbi, routerAbi } from "../config/abis";
import { FACTORY_ADDRESS, ROUTER_ADDRESS, TOKENS } from "../config/dex";
import { getWalletClient, publicClient } from "../utils/viem";

export function RemoveLiquidity({ account }: { account: string | null }) {
  const [tokenA, setTokenA] = useState(TOKENS[0]);
  const [tokenB, setTokenB] = useState(TOKENS[1]);
  const [percent, setPercent] = useState("50");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const handleRemove = async () => {
    if (!percent || Number(percent) <= 0) return;
    if (!account) {
      setStatus("Please connect wallet first");
      return;
    }
    setBusy(true);
    setStatus("Preparing removal...");
    try {
      const wallet = await getWalletClient();
      const pair = await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "getPair",
        args: [tokenA.address, tokenB.address],
      }) as `0x${string}`;
      if (pair === "0x0000000000000000000000000000000000000000") {
        setStatus("Pair not created yet");
        setBusy(false);
        return;
      }

      const balance: bigint = await publicClient.readContract({
        address: pair,
        abi: pairAbi,
        functionName: "balanceOf",
        args: [account as `0x${string}`],
      }) as bigint;
      if (balance === 0n) {
        setStatus("No LP tokens to remove");
        setBusy(false);
        return;
      }
      const removeAmount = (balance * BigInt(Math.floor(Number(percent) * 100))) / 10000n; // percent with 2dp precision

      // Approve router to burn LP
      const allowance: bigint = await publicClient.readContract({
        address: pair,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account as `0x${string}`, ROUTER_ADDRESS],
      }) as bigint;
        if (allowance < removeAmount) {
          setStatus("Approving LP token...");
          const approveHash = await wallet.writeContract({
            address: pair,
            abi: erc20Abi,
            functionName: "approve",
            args: [ROUTER_ADDRESS, removeAmount],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
 
        setStatus("Removing liquidity...");
        const hash = await wallet.writeContract({
          address: ROUTER_ADDRESS,
          abi: routerAbi,
          functionName: "removeLiquidity",
          args: [tokenA.address, tokenB.address, removeAmount, 0n, 0n, account],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Liquidity removed");
    } catch (err: any) {
      console.error(err);
      setStatus(err?.shortMessage || err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full max-w-lg space-y-3">
      <h2 className="text-lg font-bold">Remove Liquidity</h2>
      <PairSelect tokenA={tokenA} tokenB={tokenB} onTokenA={setTokenA} onTokenB={setTokenB} />
      <div className="space-y-1">
        <div className="text-sm text-gray-700">Percent to remove</div>
        <input
          className="border rounded px-2 py-1 w-full"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          type="number"
          min={0}
          max={100}
        />
      </div>
      <button
        disabled={busy}
        onClick={handleRemove}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded disabled:bg-gray-300"
      >
        {busy ? "Working..." : "Remove"}
      </button>
      {status && <p className="text-sm text-gray-700 break-words">{status}</p>}
    </div>
  );
}

function PairSelect({
  tokenA,
  tokenB,
  onTokenA,
  onTokenB,
}: {
  tokenA: typeof TOKENS[number];
  tokenB: typeof TOKENS[number];
  onTokenA: (t: typeof TOKENS[number]) => void;
  onTokenB: (t: typeof TOKENS[number]) => void;
}) {
  return (
    <div className="flex gap-2">
      <select
        className="border rounded px-2 py-1 flex-1"
        value={tokenA.address}
        onChange={(e) => {
          const next = TOKENS.find((t) => t.address === e.target.value)
          if (next) onTokenA(next)
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
          if (next) onTokenB(next)
        }}
      >
        {TOKENS.map((t) => (
          <option key={t.address} value={t.address}>
            {t.symbol}
          </option>
        ))}
      </select>
    </div>
  );
}
