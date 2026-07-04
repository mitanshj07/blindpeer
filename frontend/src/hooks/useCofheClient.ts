import { useEffect, useState } from 'react'
import { useWalletClient, usePublicClient, useAccount } from 'wagmi'
import type { CofheClient } from '@cofhe/sdk'
import { getChainById } from '@cofhe/sdk/chains'
import { createCofheConfig, createCofheClient } from '@cofhe/sdk/web'

type CofheState = {
  client: CofheClient | null
  isReady: boolean
  isLoading: boolean
  error: string | null
}

export function useCofheClient() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { address } = useAccount()
  const [state, setState] = useState<CofheState>({
    client: null,
    isReady: false,
    isLoading: false,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (!walletClient || !publicClient || !address) {
        setState({ client: null, isReady: false, isLoading: false, error: null })
        return
      }

      try {
        setState((current) => ({ ...current, isReady: false, isLoading: true, error: null }))
        const chainId = await walletClient.getChainId()
        const chain = getChainById(chainId) || getChainById(421614)

        const config = createCofheConfig({
          environment: 'web',
          supportedChains: [chain!],
        })

        const newClient = createCofheClient(config)
        type CofhePublicClient = Parameters<typeof newClient.connect>[0]
        type CofheWalletClient = Parameters<typeof newClient.connect>[1]
        await newClient.connect(publicClient as unknown as CofhePublicClient, walletClient as unknown as CofheWalletClient)

        await newClient.permits.createSelf({
          issuer: address,
        })

        if (!cancelled) {
          setState({ client: newClient, isReady: true, isLoading: false, error: null })
        }
      } catch (err) {
        console.error('Failed to init CoFHE client', err)
        if (!cancelled) {
          setState({
            client: null,
            isReady: false,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to initialize CoFHE client',
          })
        }
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [walletClient, publicClient, address])

  return state
}
