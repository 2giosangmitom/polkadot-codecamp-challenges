"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { erc20Abi, routerAbi } from "../config/abis";
import { ROUTER_ADDRESS, TOKENS } from "../config/dex";
import { getWalletClient, publicClient } from "../utils/viem";

export function Swap({ account }: { account: string | null }) {
  const [tokenIn, setTokenIn] = useState(TOKENS[0]);
  const [tokenOut, setTokenOut] = useState(TOKENS[1]);
  const [amountIn, setAmountIn] = useState<string>("");
  const [quoteOut, setQuoteOut] = useState<string>("-");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const path = useMemo(() => [tokenIn.address, tokenOut.address], [tokenIn, tokenOut]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountIn || !Number(amountIn) || path.includes("0x0000000000000000000000000000000000000000")) {
        setQuoteOut("-");
        return;
      }
      try {
        const parsed = parseUnits(amountIn, tokenIn.decimals);
        const amounts: bigint[] = await publicClient.readContract({
          address: ROUTER_ADDRESS,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [parsed, path],
        }) as bigint[];
        const out = amounts[amounts.length - 1];
        setQuoteOut(formatUnits(out, tokenOut.decimals));
      } catch (err) {
        console.error(err);
        setQuoteOut("error");
      }
    };
    fetchQuote();
  }, [amountIn, path, tokenIn.decimals, tokenOut.decimals]);

  const handleSwap = async () => {
    if (!amountIn || !Number(amountIn)) return;
    if (!account) {
      setStatus("Please connect wallet first");
      return;
    }
    setBusy(true);
    setStatus("Requesting wallet signature...");
    try {
      const wallet = await getWalletClient();
      const parsedIn = parseUnits(amountIn, tokenIn.decimals);
      const amounts: bigint[] = await publicClient.readContract({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "getAmountsOut",
        args: [parsedIn, path],
      }) as bigint[];
      const minOut = (amounts[amounts.length - 1] * 99n) / 100n; // 1% slippage buffer

      // Ensure allowance
      const allowance: bigint = await publicClient.readContract({
        address: tokenIn.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account as `0x${string}`, ROUTER_ADDRESS],
      }) as bigint;
      if (allowance < parsedIn) {
        setStatus("Approving token...");
        const approveHash = await wallet.writeContract({
          address: tokenIn.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [ROUTER_ADDRESS, parsedIn],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus("Sending swap...");
      const hash = await wallet.writeContract({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "swapExactTokensForTokens",
        args: [parsedIn, minOut, path, account],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Swap confirmed");
    } catch (err: any) {
      console.error(err);
      setStatus(err?.shortMessage || err?.message || "Swap failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full max-w-lg space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Swap</h2>
        <button
          className="text-sm underline"
          onClick={() => {
            setTokenIn(tokenOut);
            setTokenOut(tokenIn);
          }}
        >
          Flip
        </button>
      </div>
      <TokenRow
        label="From"
        token={tokenIn}
        onTokenChange={setTokenIn}
        amount={amountIn}
        onAmountChange={setAmountIn}
      />
      <TokenRow label="To" token={tokenOut} onTokenChange={setTokenOut} amount={quoteOut} readOnly />
      <button
        disabled={busy}
        onClick={handleSwap}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded disabled:bg-gray-300"
      >
        {busy ? "Working..." : "Swap"}
      </button>
      {status && <p className="text-sm text-gray-700 break-words">{status}</p>}
    </div>
  );
}

function TokenRow({
  label,
  token,
  onTokenChange,
  amount,
  onAmountChange,
  readOnly,
}: {
  label: string;
  token: typeof TOKENS[number];
  onTokenChange: (t: typeof TOKENS[number]) => void;
  amount: string;
  onAmountChange?: (v: string) => void;
  readOnly?: boolean;
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
          onChange={(e) => onAmountChange && onAmountChange(e.target.value)}
          placeholder="0.0"
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
