"use client"

import { useState } from "react";
import { useBridge } from "@/hooks/useBridge";
import { MetaMaskButton } from "@/components/MetaMaskButton";

export default function Home() {
  const { bridgeTokens, loading, error, receipt } = useBridge();
  
  // State for form inputs
  const [tokenAddress, setTokenAddress] = useState("");
  const [symbol, setSymbol] = useState("USDh");
  const [amount, setAmount] = useState("1");
  const [destChainId, setDestChainId] = useState("420420422"); // Default to Paseo Asset Hub

  const handleBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenAddress) return alert("Please enter a token address");
    
    try {
      await bridgeTokens({
        token: tokenAddress,
        symbol,
        amount,
        destChainId: parseInt(destChainId),
      });
      alert("Bridge transaction submitted successfully!");
    } catch (err) {
      // Error is handled in hook
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <MetaMaskButton />
      
      <main className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden mt-16">
        <div className="bg-emerald-600 p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Hyperbridge Token Bridge</h1>
          <p className="text-emerald-100 mt-2">Transfer tokens across chains</p>
        </div>
        
        <form onSubmit={handleBridge} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Token Address (on BSC Testnet)</label>
            <input
              type="text"
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-black"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
              <input
                type="text"
                placeholder="USDh"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-black"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                placeholder="1.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-black"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Chain ID</label>
            <input
              type="text"
              placeholder="420420422 (Paseo Asset Hub)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-black"
              value={destChainId}
              onChange={(e) => setDestChainId(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use <strong>420420422</strong> for Paseo Asset Hub (Polkadot Testnet).
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {receipt && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200 break-all">
              Success! Tx: <a href={`https://testnet.bscscan.com/tx/${receipt.hash}`} target="_blank" rel="noopener noreferrer" className="underline font-bold">{receipt.hash.slice(0, 10)}...</a>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-bold text-lg shadow-md transition-all 
              ${loading 
                ? "bg-gray-400 cursor-not-allowed" 
                : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg active:transform active:scale-[0.98]"
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Bridge Tokens"
            )}
          </button>
        </form>
      </main>
      
      <footer className="mt-8 text-gray-500 text-sm">
        Powered by Hyperbridge
      </footer>
    </div>
  );
}
