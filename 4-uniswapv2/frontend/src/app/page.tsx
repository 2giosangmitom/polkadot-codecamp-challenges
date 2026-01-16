"use client";

import WalletConnect from "./components/WalletConnect";
import { AddLiquidity } from "./components/AddLiquidity";
import { RemoveLiquidity } from "./components/RemoveLiquidity";
import { Swap } from "./components/Swap";
import { PoolList } from "./components/PoolList";
import { CreatePool } from "./components/CreatePool";
import { Faucet } from "./components/Faucet";

export default function Home() {
  return (
    <section className="min-h-screen bg-white text-black flex flex-col items-center gap-6 py-10 px-4">
      <h1 className="text-2xl font-semibold text-center">Uniswap V2 (Paseo Asset Hub)</h1>
      <WalletConnect onConnect={() => {}} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
        <Swap />
        <AddLiquidity />
        <RemoveLiquidity />
        <CreatePool />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-6xl">
        <Faucet />
        <PoolList />
      </div>
    </section>
  );
}
