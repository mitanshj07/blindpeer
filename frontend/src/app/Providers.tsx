'use client'

import { createConfig, http, injected, WagmiProvider } from 'wagmi'
import { defineChain } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

const ethereumSepolia = defineChain({
  id: 11155111,
  name: 'Ethereum Sepolia',
  network: 'eth-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://ethereum-sepolia-rpc.publicnode.com'],
    },
    public: {
      http: ['https://ethereum-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
})

const localCofhe = defineChain({
  id: 420105,
  name: 'Local CoFHE',
  network: 'localcofhe',
  nativeCurrency: {
    decimals: 18,
    name: 'Local ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
})

const hardhatLocal = defineChain({
  id: 31337,
  name: 'Localhost',
  network: 'localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
})

const config = createConfig({
  chains: [ethereumSepolia, hardhatLocal, localCofhe],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [ethereumSepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
    [hardhatLocal.id]: http('http://127.0.0.1:8545'),
    [localCofhe.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
