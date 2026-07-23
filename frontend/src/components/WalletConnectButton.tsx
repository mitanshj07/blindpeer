'use client'

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { LogOut, PlugZap, RefreshCw, Wallet } from 'lucide-react'

const SEPOLIA_CHAIN_ID = 11155111

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { connect, connectors, error, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const injectedConnector = connectors.find((connector) => connector.type === 'injected')
  const needsSepolia = isConnected && chainId !== SEPOLIA_CHAIN_ID

  if (!injectedConnector) {
    return (
      <a
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-400/15"
        href="https://metamask.io/download/"
        rel="noreferrer"
        target="_blank"
      >
        <Wallet className="h-4 w-4" />
        Install MetaMask
      </a>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          onClick={() => connect({ connector: injectedConnector, chainId: SEPOLIA_CHAIN_ID })}
          type="button"
        >
          {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          {isPending ? 'Connecting' : 'Connect Wallet'}
        </button>
        {error ? <p className="max-w-52 text-right text-xs text-rose-300">{error.message}</p> : null}
      </div>
    )
  }

  if (needsSepolia) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
          type="button"
        >
          {isSwitching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Switch to Sepolia
        </button>
        <p className="text-xs text-slate-400">{address ? shortAddress(address) : 'Wallet connected'}</p>
      </div>
    )
  }

  return (
    <div className="inline-flex h-11 items-center overflow-hidden rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-100">
      <div className="flex items-center gap-2 px-3">
        <Wallet className="h-4 w-4" />
        {address ? shortAddress(address) : 'Connected'}
      </div>
      <button
        aria-label="Disconnect wallet"
        className="flex h-11 w-11 items-center justify-center border-l border-emerald-400/20 transition hover:bg-emerald-300/10"
        onClick={() => disconnect()}
        type="button"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}
