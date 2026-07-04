'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { isAddress, keccak256, stringToHex, type Address } from 'viem'
import { Encryptable } from '@cofhe/sdk'
import { AlertCircle, ClipboardCheck, FileText, Loader2, LockKeyhole, Send, Sparkles, Users } from 'lucide-react'
import { useCofheClient } from '@/hooks/useCofheClient'
import { DEMO_AI_SIGNAL, DEMO_PAPER, DEMO_REVIEWERS, type DemoStage } from '@/lib/demoScenario'
import { REVIEW_POOL_ABI, REVIEW_POOL_ADDRESS, shortAddress } from '@/lib/reviewPool'

type AiSignal = {
  score: number
  rationale: string
  source: 'groq' | 'fallback'
}

const LOCAL_REVIEWERS = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
] as const satisfies readonly Address[]

function clientFallbackScore(title: string, abstract: string): AiSignal {
  const text = `${title} ${abstract}`.toLowerCase()
  const keywordHits = ['fhe', 'encrypted', 'privacy', 'threshold', 'homomorphic', 'review'].filter((word) =>
    text.includes(word),
  ).length

  return {
    score: Math.max(4, Math.min(9, 5 + keywordHits + Math.floor(abstract.length / 500))),
    rationale: 'Local fallback scored the paper so the demo can continue without the Groq service.',
    source: 'fallback',
  }
}

function parseReviewers(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type SubmitPaperProps = {
  mode?: 'demo' | 'live'
  demoStage?: DemoStage
  onSubmitted?: (paperId: bigint) => void
  onDemoStageChange?: (stage: DemoStage) => void
}

export function SubmitPaper({ mode = 'live', demoStage = 'ready', onSubmitted, onDemoStageChange }: SubmitPaperProps) {
  const isDemo = mode === 'demo'
  const { address } = useAccount()
  const { client, isReady, isLoading: cofheLoading, error: cofheError } = useCofheClient()
  const [title, setTitle] = useState('')
  const [abstract, setAbstract] = useState('')
  const [reviewers, setReviewers] = useState(() =>
    isDemo ? DEMO_REVIEWERS.map((reviewer) => reviewer.address).join(', ') : LOCAL_REVIEWERS.join(', '),
  )
  const [aiSignal, setAiSignal] = useState<AiSignal | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'scoring' | 'matching' | 'encrypting' | 'submitting'>('idle')
  const [submittedPaperId, setSubmittedPaperId] = useState<bigint | null>(null)

  const parsedReviewers = useMemo(() => parseReviewers(reviewers), [reviewers])
  const reviewerIssue = useMemo(() => {
    if (parsedReviewers.length === 0) return null
    if (parsedReviewers.length !== 3) return 'Add exactly three reviewer addresses.'
    if (!parsedReviewers.every((reviewer) => isAddress(reviewer))) return 'One reviewer address is not valid.'
    if (new Set(parsedReviewers.map((reviewer) => reviewer.toLowerCase())).size !== 3) {
      return 'Reviewer addresses must be distinct.'
    }
    return null
  }, [parsedReviewers])
  
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { data: paperCount, refetch: refetchPaperCount } = useReadContract({
    address: REVIEW_POOL_ADDRESS,
    abi: REVIEW_POOL_ABI,
    functionName: 'paperCount',
    query: { refetchInterval: 5000 },
  })

  useEffect(() => {
    if (!isSuccess || submittedPaperId === null) return
    onSubmitted?.(submittedPaperId)
    void refetchPaperCount()
  }, [isSuccess, onSubmitted, refetchPaperCount, submittedPaperId])

  const scorePaper = async () => {
    try {
      const response = await fetch('/api/groq-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, abstract }),
      })

      if (!response.ok) throw new Error('Groq route failed')
      return (await response.json()) as AiSignal
    } catch {
      return clientFallbackScore(title, abstract)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (isDemo) {
      if (!title.trim() || !abstract.trim()) {
        setFormError('Paste the paper title and abstract before matching reviewers.')
        return
      }

      try {
        if (demoStage === 'ready') {
          setStage('scoring')
          setAiSignal(DEMO_AI_SIGNAL)
          await wait(450)

          setStage('matching')
          onDemoStageChange?.('matching')
          await wait(750)
          onDemoStageChange?.('matched')
          return
        }

        if (demoStage === 'matched') {
          setStage('encrypting')
          onDemoStageChange?.('encrypting')
          await wait(900)

          setStage('submitting')
          await wait(650)
          onDemoStageChange?.('accepted')
        }
      } finally {
        setStage('idle')
      }
      return
    }

    if (!address) {
      setFormError('Connect the author wallet before submitting.')
      return
    }

    if (!client || !isReady) {
      setFormError(cofheError || 'CoFHE client is still initializing.')
      return
    }

    if (reviewerIssue) {
      setFormError(reviewerIssue)
      return
    }

    try {
      setStage('scoring')
      const scored = await scorePaper()
      setAiSignal(scored)

      setStage('encrypting')
      const paperContent = title + abstract
      const paperHash = keccak256(stringToHex(paperContent))

      const authorIdNum = BigInt(parseInt(address.slice(-8), 16))
      const encAuthors = await client.encryptInputs([Encryptable.uint32(authorIdNum)]).execute()
      const encAuthorId = encAuthors[0]
      const revs = parsedReviewers as [Address, Address, Address]
      const nextPaperId = typeof paperCount === 'bigint' ? paperCount : 0n

      setStage('submitting')
      setSubmittedPaperId(nextPaperId)
      writeContract({
        address: REVIEW_POOL_ADDRESS,
        abi: REVIEW_POOL_ABI,
        functionName: 'submitPaper',
        args: [paperHash, encAuthorId, scored.score, revs],
      })
    } catch (err) {
      console.error(err)
      setFormError(err instanceof Error ? err.message : 'Paper submission failed.')
    } finally {
      setStage('idle')
    }
  }

  const isBusy = isPending || isWaiting || stage !== 'idle'
  const buttonLabel =
    stage === 'scoring'
      ? 'Scoring with Groq'
      : stage === 'matching'
        ? 'Matching reviewers'
        : stage === 'encrypting'
          ? 'Encrypting paper'
          : stage === 'submitting'
            ? isDemo
              ? 'Sealing approvals'
              : 'Submit to pool'
            : isDemo
              ? demoStage === 'matched'
                ? 'Encrypt paper'
                : demoStage === 'accepted'
                  ? 'Paper passed'
                  : 'Match AI reviewers'
              : 'Submit to pool'
  const visibleError = formError || (!isDemo ? reviewerIssue || cofheError : null)
  const demoCanEdit = !isDemo || demoStage === 'ready'
  const showDemoReviewers = isDemo && ['matched', 'encrypting', 'accepted'].includes(demoStage)
  const demoActionDisabled = demoStage === 'accepted' || isBusy

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-2">
          <FileText className="h-5 w-5 text-cyan-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Submit Paper</h2>
          <p className="text-sm text-slate-400">Paper hash and encrypted identity enter the pool.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Paper Title</label>
          <input 
            type="text" 
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            readOnly={!demoCanEdit}
            className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
            placeholder={isDemo ? DEMO_PAPER.title : 'Encrypted consensus scoring for double-blind review'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Abstract</label>
          <textarea 
            required
            rows={isDemo ? 7 : 4}
            value={abstract}
            onChange={e => setAbstract(e.target.value)}
            readOnly={!demoCanEdit}
            className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-2 text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
            placeholder={isDemo ? DEMO_PAPER.abstract : 'Describe the method, threat model, and evaluation signal...'}
          />
        </div>
        {isDemo && demoStage === 'ready' && (
          <button
            type="button"
            onClick={() => {
              setTitle(DEMO_PAPER.title)
              setAbstract(DEMO_PAPER.abstract)
              setAiSignal(null)
              setFormError(null)
              onDemoStageChange?.('ready')
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
          >
            <ClipboardCheck className="h-4 w-4" />
            Load Demo Idea
          </button>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-400">
              {isDemo ? 'AI-Matched Reviewers' : 'Reviewers'}
            </label>
            {!isDemo && (
              <button
                type="button"
                onClick={() => setReviewers(LOCAL_REVIEWERS.join(', '))}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/40 hover:text-cyan-200"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Local demo
              </button>
            )}
          </div>
          {isDemo ? (
            <div className="grid gap-2">
              {demoStage === 'ready' && (
                <div className="rounded-md border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                  Reviewer matching appears after the paper idea is submitted for matching.
                </div>
              )}
              {demoStage === 'matching' && (
                <div className="flex items-center gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Matching reviewers by topic, methods, and governance fit.
                </div>
              )}
              {showDemoReviewers &&
                DEMO_REVIEWERS.map((reviewer) => (
                  <div key={reviewer.address} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{reviewer.name}</p>
                        <p className="text-xs text-slate-400">{reviewer.specialty}</p>
                      </div>
                      <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                        {reviewer.matchScore}%
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{reviewer.reason}</p>
                    <p className="mt-2 font-mono text-xs text-slate-500">{shortAddress(reviewer.address)}</p>
                  </div>
                ))}
            </div>
          ) : (
            <>
              <input 
                type="text" 
                required
                value={reviewers}
                onChange={e => setReviewers(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-black/20 px-4 py-2 font-mono text-sm text-white outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="0x..., 0x..., 0x..."
              />
              {parsedReviewers.length === 3 && !reviewerIssue && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsedReviewers.map((reviewer) => (
                    <span key={reviewer} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300">
                      <Users className="h-3 w-3 text-cyan-300" />
                      {shortAddress(reviewer)}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button 
          disabled={isDemo ? demoActionDisabled : isBusy || !isReady || cofheLoading}
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isBusy || (!isDemo && cofheLoading) ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> {buttonLabel}</>
          ) : isDemo && demoStage === 'matched' ? (
            <><LockKeyhole className="h-5 w-5" /> Encrypt Paper</>
          ) : isDemo ? (
            <><Users className="h-5 w-5" /> {demoStage === 'accepted' ? 'Paper Passed' : 'Match AI Reviewers'}</>
          ) : (
            <><Send className="h-5 w-5" /> Submit to Review Pool</>
          )}
        </button>
      </form>

      {aiSignal && (
        <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <div className="flex items-center gap-2 text-amber-200">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">AI pre-signal: {aiSignal.score}/10</span>
            <span className="rounded-md bg-black/20 px-2 py-0.5 text-xs uppercase tracking-wide text-amber-100/70">
              {aiSignal.source}
            </span>
          </div>
          <p className="mt-2 text-sm text-amber-100/80">{aiSignal.rationale}</p>
        </div>
      )}

      {visibleError && (
        <div className="mt-4 flex gap-2 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{visibleError}</span>
        </div>
      )}

      {!isDemo && isSuccess && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-center text-sm text-emerald-200">
          Paper submitted. Active paper ID: {submittedPaperId?.toString() ?? '0'}
        </div>
      )}
    </div>
  )
}
