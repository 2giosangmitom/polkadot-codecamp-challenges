"use client";

import { useEffect, useState } from "react";
import { parseUnits } from "viem";
import { erc20Abi, routerAbi } from "../config/abis";
import { ROUTER_ADDRESS, TOKENS } from "../config/dex";
import { getWalletClient, publicClient } from "../utils/viem";

export function AddLiquidity({ account }: { account: string | null }) {
  const [tokenA, setTokenA] = useState(TOKENS[0]);
  const [tokenB, setTokenB] = useState(TOKENS[1]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tokenA.address === tokenB.address) {
      const alt = TOKENS.find((t) => t.address !== tokenA.address);
      if (alt) setTokenB(alt);
    }
  }, [tokenA, tokenB]);

  const handleAdd = async () => {
    if (!amountA || !amountB) return;
    if (!account) {
      setStatus("Please connect wallet first");
      return;
    }
    setBusy(true);
    setStatus("Preparing transaction...");
    try {
      const wallet = await getWalletClient();
      const parsedA = parseUnits(amountA, tokenA.decimals);
      const parsedB = parseUnits(amountB, tokenB.decimals);

      // Approvals (with logging & error handling)
      const approvals = [
        { token: tokenA, amount: parsedA },
        { token: tokenB, amount: parsedB },
      ];
      for (const a of approvals) {
        const allowance: bigint = await publicClient.readContract({
          address: a.token.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [account as `0x${string}`, ROUTER_ADDRESS],
        }) as bigint;
        if (allowance < a.amount) {
          setStatus(`Approving ${a.token.symbol}...`);
          try {
            const approveHash = await wallet.writeContract({
              address: a.token.address,
              abi: erc20Abi,
              functionName: "approve",
              args: [ROUTER_ADDRESS, a.amount],
            });
            console.log(`${a.token.symbol} approve tx hash:`, approveHash);
            const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log(`${a.token.symbol} approve receipt:`, approveReceipt);
          } catch (err: any) {
            console.error(`${a.token.symbol} approve failed:`, err);
            const msg = err?.cause?.reason || err?.shortMessage || err?.message || `${a.token.symbol} approve failed`;
            setStatus(`Error: ${msg}`);
            setBusy(false);
            return;
          }
        }
      }

      setStatus("Supplying liquidity...");
      try {
        const hash = await wallet.writeContract({
          address: ROUTER_ADDRESS,
          abi: routerAbi,
          functionName: "addLiquidity",
          args: [tokenA.address, tokenB.address, parsedA, parsedB, 0n, 0n, account],
        });
        console.log("addLiquidity tx hash:", hash);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("addLiquidity receipt:", receipt);
        setStatus("Liquidity added");
        setAmountA("");
        setAmountB("");
      } catch (err: any) {
        console.error("addLiquidity failed:", err);
        const msg = err?.cause?.reason || err?.shortMessage || err?.message || "Add liquidity failed";
        setStatus(`Error: ${msg}`);
      }
      setAmountA("");
      setAmountB("");
    } catch (err: any) {
      console.error(err);
      setStatus(err?.shortMessage || err?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full max-w-lg space-y-3">
      <h2 className="text-lg font-bold">Add Liquidity</h2>
      <TokenInput label="Token A" token={tokenA} onTokenChange={setTokenA} amount={amountA} onAmountChange={setAmountA} />
      <TokenInput label="Token B" token={tokenB} onTokenChange={setTokenB} amount={amountB} onAmountChange={setAmountB} />
      <button
        disabled={busy}
        onClick={handleAdd}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded disabled:bg-gray-300"
      >
        {busy ? "Working..." : "Add Liquidity"}
      </button>
      {status && <p className="text-sm text-gray-700 break-words">{status}</p>}
    </div>
  );
}

function TokenInput({
  label,
  token,
  onTokenChange,
  amount,
  onAmountChange,
}: {
  label: string;
  token: typeof TOKENS[number];
  onTokenChange: (t: typeof TOKENS[number]) => void;
  amount: string;
  onAmountChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-gray-700">{label}</div>
      <div className="flex gap-2">
        <select
          className="border rounded px-2 py-1 flex-1"
          value={token.address}
          onChange={(e) => {
            const next = TOKENS.find((t) => t.address === e.target.value)
            if (next) onTokenChange(next)
          }}
        >
          {TOKENS.map((t) => (
            <option key={t.address} value={t.address}>
              {t.symbol}
            </option>
          ))}
        </select>
        <input
          className="border rounded px-2 py-1 flex-1"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.0"
        />
      </div>
    </div>
  );
}
