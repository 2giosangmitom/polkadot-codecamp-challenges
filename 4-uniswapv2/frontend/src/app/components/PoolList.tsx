"use client";

import { useEffect, useState } from "react";
import { factoryAbi, pairAbi } from "../config/abis";
import { FACTORY_ADDRESS, TOKENS } from "../config/dex";
import { publicClient } from "../utils/viem";

interface PoolRow {
  pair: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  reserve0: bigint;
  reserve1: bigint;
}

export function PoolList() {
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [status, setStatus] = useState("Loading pools...");

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const length: bigint = await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: factoryAbi,
          functionName: "allPairsLength",
          args: [],
        }) as bigint;
        const items: PoolRow[] = [];
        for (let i = 0n; i < length; i++) {
          const pair = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: factoryAbi,
            functionName: "allPairs",
            args: [i],
          }) as `0x${string}`;
          const [token0, token1, reserves] = await Promise.all([
            publicClient.readContract({ address: pair, abi: pairAbi, functionName: "token0" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: pair, abi: pairAbi, functionName: "token1" }) as Promise<`0x${string}`>,
            publicClient.readContract({ address: pair, abi: pairAbi, functionName: "getReserves" }) as Promise<[bigint, bigint, number]>,
          ]);
          items.push({ pair, token0, token1, reserve0: reserves[0], reserve1: reserves[1] });
        }
        setPools(items);
        setStatus(items.length === 0 ? "No pools yet" : "");
      } catch (err) {
        console.error(err);
        setStatus("Failed to load pools");
      }
    };
    fetchPools();
  }, []);

  return (
    <div className="border border-pink-500 rounded-lg p-4 bg-white text-pink-600 w-full space-y-3">
      <h2 className="text-lg font-bold">Pools</h2>
      {status && <p className="text-sm text-gray-700">{status}</p>}
      {!status && (
        <div className="space-y-2">
          {pools.map((p) => {
            const t0 = TOKENS.find((t) => t.address.toLowerCase() === p.token0.toLowerCase())
            const t1 = TOKENS.find((t) => t.address.toLowerCase() === p.token1.toLowerCase())
            return (
              <div key={p.pair} className="border rounded p-2 flex justify-between text-sm">
                <div>
                  <div className="font-semibold">{t0?.symbol || p.token0.slice(0, 6)} / {t1?.symbol || p.token1.slice(0, 6)}</div>
                  <div className="text-gray-600">{p.pair}</div>
                </div>
                <div className="text-right text-gray-700">
                  <div>R0: {p.reserve0.toString()}</div>
                  <div>R1: {p.reserve1.toString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
