'use client'

import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { SubmitPaper } from '@/components/SubmitPaper'
import { ReviewPaper } from '@/components/ReviewPaper'
import { PaperStatus } from '@/components/PaperStatus'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import { REVIEW_POOL_ABI, REVIEW_POOL_ADDRESS } from '@/lib/reviewPool'
import { BrainCircuit, ShieldCheck } from 'lucide-react'

export default function Home() {
  const [activePaperId, setActivePaperId] = useState<bigint | null>(() => {
    if (typeof window === 'undefined') return null
    const storedPaperId = window.localStorage.getItem('blindpeer.activePaperId')
    return storedPaperId && /^\d+$/.test(storedPaperId) ? BigInt(storedPaperId) : null
  })

  const { data: paperCount } = useReadContract({
    address: REVIEW_POOL_ADDRESS,
    abi: REVIEW_POOL_ABI,
    functionName: 'paperCount',
    query: { refetchInterval: 5000 },
  })

  const latestPaperId = typeof paperCount === 'bigint' && paperCount > 0n ? paperCount - 1n : 0n
  const displayedPaperId = activePaperId ?? latestPaperId

  const handleSubmitted = (paperId: bigint) => {
    setActivePaperId(paperId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('blindpeer.activePaperId', paperId.toString())
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      
      <main className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex w-full items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-2">
              <BrainCircuit className="h-8 w-8 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                BlindPeer
              </h1>
              <p className="text-sm font-medium text-slate-400">Encrypted evaluation infrastructure on Fhenix CoFHE</p>
            </div>
          </div>
          <WalletConnectButton />
        </header>

        <section className="mb-8 grid w-full gap-4 md:grid-cols-3">
          {[
            ['Encrypted votes', 'Reviewer signals stay private until aggregate decrypt.'],
            ['2-of-3 threshold', 'FHE.add and FHE.gte compute majority without exposing ballots.'],
            ['Identity reveal', 'Accepted work can reveal the author after verdict publication.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-lg border border-white/10 bg-slate-900/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                <h2 className="text-sm font-semibold">{title}</h2>
              </div>
              <p className="text-sm text-slate-400">{copy}</p>
            </div>
          ))}
        </section>

        <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-8">
            <SubmitPaper onSubmitted={handleSubmitted} />
          </div>

          <div className="lg:col-span-7 space-y-8">
            <PaperStatus paperId={displayedPaperId} />
            <ReviewPaper paperId={displayedPaperId} />
          </div>
        </div>
      </main>
    </div>
  )
}
