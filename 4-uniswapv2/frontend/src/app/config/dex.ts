export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const TOKEN_A_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_A || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const TOKEN_B_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_B || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const TOKENS = [
  { address: TOKEN_A_ADDRESS, symbol: process.env.NEXT_PUBLIC_TOKEN_A_SYMBOL || 'TKNA', decimals: 18, faucet: true },
  { address: TOKEN_B_ADDRESS, symbol: process.env.NEXT_PUBLIC_TOKEN_B_SYMBOL || 'TKNB', decimals: 18, faucet: true },
] as const
