'use client'

import { useEffect, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Encryptable } from '@cofhe/sdk'
import { BadgeCheck, Check, Circle, Loader2, Shield, Sparkles, X } from 'lucide-react'
import { useCofheClient } from '@/hooks/useCofheClient'
import { DEMO_PAPER, DEMO_REVIEWERS, type DemoStage } from '@/lib/demoScenario'
import {
  hasPaper,
  type PaperTuple,
  REVIEW_POOL_ABI,
  REVIEW_POOL_ADDRESS,
  shortAddress,
  ZERO_ADDRESS,
} from '@/lib/reviewPool'

type ReviewerStatusesResult = {
  0?: unknown
  1?: unknown
  reviewers?: unknown
  voted?: unknown
}

function tuple3<T>(value: unknown, fallback: readonly [T, T, T]): readonly [T, T, T] {
  if (Array.isArray(value)) {
    return [
      (value[0] as T | undefined) ?? fallback[0],
      (value[1] as T | undefined) ?? fallback[1],
      (value[2] as T | undefined) ?? fallback[2],
    ]
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, T | undefined>
    return [record[0] ?? fallback[0], record[1] ?? fallback[1], record[2] ?? fallback[2]]
  }

  return fallback
}

type ReviewPaperProps = {
  paperId: bigint
  mode?: 'demo' | 'live'
  demoStage?: DemoStage
}

export function ReviewPaper({ paperId, mode = 'live', demoStage = 'ready' }: ReviewPaperProps) {
  const { address } = useAccount()
  const { client, isReady, isLoading, error } = useCofheClient()
  const isDemo = mode === 'demo'

  const { data: paperData, refetch: refetchPaper } = useReadContract({
    address: REVIEW_POOL_ADDRESS,
    abi: REVIEW_POOL_ABI,
    functionName: 'papers',
    args: [paperId],
    query: { refetchInterval: 3000 },
  })

  const paper = paperData as PaperTuple | undefined
  const exists = hasPaper(paper)

  const { data: statusData, refetch: refetchStatuses } = useReadContract({
    address: REVIEW_POOL_ADDRESS,
    abi: REVIEW_POOL_ABI,
    functionName: 'reviewerStatuses',
    args: [paperId],
    query: { enabled: exists, refetchInterval: 3000 },
  })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (!isSuccess) return
    void refetchPaper()
    void refetchStatuses()
  }, [isSuccess, refetchPaper, refetchStatuses])

  const statuses = statusData as ReviewerStatusesResult | undefined
  const reviewers = useMemo(
    () =>
      tuple3(
        statuses?.reviewers ?? statuses?.[0],
        [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS] as const,
      ),
    [statuses],
  )
  const voted = useMemo(() => tuple3(statuses?.voted ?? statuses?.[1], [false, false, false] as const), [statuses])
  const reviewersList = Array.isArray(reviewers) ? reviewers : [reviewers[0], reviewers[1], reviewers[2]]
  const currentReviewerIndex = reviewersList.findIndex((reviewer) => typeof reviewer === 'string' && reviewer.toLowerCase() === address?.toLowerCase())
  const isReviewer = currentReviewerIndex >= 0
  const currentReviewerHasVoted = currentReviewerIndex >= 0 ? voted[currentReviewerIndex] : false

  const handleVote = async (approve: boolean) => {
    if (!client || !isReady || !address) return

    try {
      const encryptedVotes = await client.encryptInputs([Encryptable.bool(approve)]).execute()
      const encryptedVote = encryptedVotes[0]

      writeContract({
        address: REVIEW_POOL_ADDRESS,
        abi: REVIEW_POOL_ABI,
        functionName: 'submitVote',
        args: [paperId, encryptedVote],
      })
    } catch (err) {
      console.error(err)
    }
  }

  if (isDemo) {
    const matched = ['matched', 'approvingEncryption', 'encrypting', 'submittingPaper', 'submitted'].includes(demoStage)
    const encrypted = demoStage === 'encrypting' || demoStage === 'submittingPaper' || demoStage === 'submitted'
    const submitted = demoStage === 'submitted'
    const matching = demoStage === 'matching'
    const approvedCount = 0

    return (
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
        <div className="relative z-10 mb-6 flex items-center gap-3">
          <div className="rounded-lg border border-teal-400/20 bg-teal-400/10 p-2">
            <Shield className="h-5 w-5 text-teal-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI-Matched Reviewers</h2>
            <p className="text-sm text-slate-400">Top reviewers appear after matching.</p>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-400">{encrypted ? 'Encrypted Paper Hash' : 'Paper Hash'}</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-200">
              {encrypted ? DEMO_PAPER.hash : 'Generated after encryption'}
            </p>
          </div>

          {!matched && !matching && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
              Paste the idea and run matching to select reviewers.
            </div>
          )}

          {demoStage === 'submittingIdea' && (
            <div className="flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Waiting for idea transaction...</span>
            </div>
          )}

          {matching && (
            <div className="flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-cyan-100">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Matching reviewers...</span>
            </div>
          )}

          {matched && (
            <div className="grid gap-3 sm:grid-cols-3">
              {DEMO_REVIEWERS.map((reviewer, index) => {
                const approved = index < approvedCount
                return (
                  <div
                    key={reviewer.address}
                    className={`rounded-lg border p-3 ${
                      approved ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-white/10 bg-black/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer {index + 1}</span>
                        <p className="mt-1 text-sm font-semibold text-slate-100">{reviewer.name}</p>
                      </div>
                      {approved ? <Check className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4 text-slate-500" />}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{reviewer.specialty}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
                        {reviewer.matchScore}% match
                      </span>
                      <span className="text-xs text-slate-400">
                        {approved ? 'Approved' : submitted ? 'Awaiting vote' : encrypted ? 'Assigned' : 'Matched'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
            {submitted ? (
              <div className="flex items-center gap-3 text-emerald-200">
                <BadgeCheck className="h-5 w-5" />
                <span className="font-semibold">Paper submitted. Reviewer wallets can now vote.</span>
              </div>
            ) : demoStage === 'encrypting' ? (
              <div className="flex items-center gap-3 text-cyan-100">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-semibold">Encrypting paper package.</span>
              </div>
            ) : demoStage === 'approvingEncryption' ? (
              <div className="flex items-center gap-3 text-cyan-100">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-semibold">Waiting for encryption approval.</span>
              </div>
            ) : demoStage === 'submittingPaper' ? (
              <div className="flex items-center gap-3 text-cyan-100">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-semibold">Submitting encrypted paper.</span>
              </div>
            ) : matched ? (
              <div className="flex items-center gap-3 text-slate-300">
                <Sparkles className="h-5 w-5 text-amber-300" />
                <span className="font-semibold">Reviewer set matched.</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-300">
                <Sparkles className="h-5 w-5 text-amber-300" />
                <span className="font-semibold">Waiting for idea match.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!exists) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-teal-400/20 bg-teal-400/10 p-2">
            <Shield className="h-5 w-5 text-teal-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Reviewer Vote</h2>
            <p className="text-sm text-slate-400">Waiting for an active paper.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
      <div className="relative z-10 mb-6 flex items-center gap-3">
        <div className="rounded-lg border border-teal-400/20 bg-teal-400/10 p-2">
          <Shield className="h-5 w-5 text-teal-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Reviewer Vote</h2>
          <p className="text-sm text-slate-400">Connected reviewers submit one encrypted approve or reject signal.</p>
        </div>
      </div>

      <div className="relative z-10 space-y-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-slate-400">Paper Hash</p>
          <p className="mt-1 break-all font-mono text-sm text-slate-200">{paper[0]}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {reviewers.map((reviewer, index) => {
            const connected = reviewer.toLowerCase() === address?.toLowerCase()
            return (
              <div
                key={`${reviewer}-${index}`}
                className={`rounded-lg border p-3 ${
                  connected ? 'border-cyan-300/50 bg-cyan-300/10' : 'border-white/10 bg-black/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewer {index + 1}</span>
                  {voted[index] ? <Check className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4 text-slate-500" />}
                </div>
                <p className="mt-2 font-mono text-sm text-slate-200">{shortAddress(reviewer)}</p>
                <p className="mt-1 text-xs text-slate-400">{connected ? 'Connected' : voted[index] ? 'Voted' : 'Pending'}</p>
              </div>
            )
          })}
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <button
            disabled={isPending || isWaiting || !isReady || isLoading || !isReviewer || currentReviewerHasVoted}
            onClick={() => handleVote(true)}
            className="flex items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isPending || isWaiting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Approve (Encrypted)
          </button>

          <button
            disabled={isPending || isWaiting || !isReady || isLoading || !isReviewer || currentReviewerHasVoted}
            onClick={() => handleVote(false)}
            className="flex items-center justify-center gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 font-semibold text-red-200 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isPending || isWaiting ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
            Reject (Encrypted)
          </button>
        </div>

        {!isReviewer && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-3 text-sm text-slate-300">
            Switch to one of the assigned reviewer wallets to cast an encrypted vote.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>
        )}

        {isSuccess && (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-center text-sm text-emerald-200">
            Encrypted vote cast successfully!
          </div>
        )}
      </div>
    </div>
  )
}
