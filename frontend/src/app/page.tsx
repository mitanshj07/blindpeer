'use client'

import { useState } from 'react'
import { useReadContract } from 'wagmi'
import { SubmitPaper } from '@/components/SubmitPaper'
import { ReviewPaper } from '@/components/ReviewPaper'
import { PaperStatus } from '@/components/PaperStatus'
import { WalletConnectButton } from '@/components/WalletConnectButton'
import type { DemoStage } from '@/lib/demoScenario'
import { REVIEW_POOL_ABI, REVIEW_POOL_ADDRESS } from '@/lib/reviewPool'
import { BrainCircuit, Radio, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'

export default function Home() {
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [demoStage, setDemoStage] = useState<DemoStage>('ready')
  const [demoResetKey, setDemoResetKey] = useState(0)
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

  const switchMode = (nextMode: 'demo' | 'live') => {
    setMode(nextMode)
    if (nextMode === 'demo') {
      setDemoStage('ready')
      setDemoResetKey((key) => key + 1)
    }
  }

  const resetDemo = () => {
    setDemoStage('ready')
    setDemoResetKey((key) => key + 1)
  }

  const isDemo = mode === 'demo'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      
      <main className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 flex w-full flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => switchMode('demo')}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition ${
                  isDemo ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Demo
              </button>
              <button
                type="button"
                onClick={() => switchMode('live')}
                className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition ${
                  !isDemo ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Radio className="h-4 w-4" />
                Live
              </button>
            </div>
            {isDemo && (
              <button
                type="button"
                aria-label="Reset demo"
                title="Reset demo"
                onClick={resetDemo}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-black/20 text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <WalletConnectButton />
          </div>
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
            <SubmitPaper
              key={`${mode}-${demoResetKey}`}
              mode={mode}
              demoStage={demoStage}
              onSubmitted={handleSubmitted}
              onDemoStageChange={setDemoStage}
            />
          </div>

          <div className="lg:col-span-7 space-y-8">
            <PaperStatus paperId={displayedPaperId} mode={mode} demoStage={demoStage} />
            <ReviewPaper paperId={displayedPaperId} mode={mode} demoStage={demoStage} />
          </div>
        </div>
      </main>
    </div>
  )
}
