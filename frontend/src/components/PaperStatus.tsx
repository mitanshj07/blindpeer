'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { Activity, AlertCircle, CheckCircle2, KeyRound, Loader2, Lock, Radio, Sparkles, Unlock, XCircle } from 'lucide-react'
import { useCofheClient } from '@/hooks/useCofheClient'
import { hasPaper, type PaperTuple, REVIEW_POOL_ABI, REVIEW_POOL_ADDRESS, shortAddress } from '@/lib/reviewPool'

function decryptedToBool(value: unknown) {
  return value === true || value === 1 || value === 1n || value === '1'
}

export function PaperStatus({ paperId }: { paperId: bigint }) {
  const { address } = useAccount()
  const { client, isReady, isLoading: cofheLoading, error: cofheError } = useCofheClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: paperData, refetch } = useReadContract({
    address: REVIEW_POOL_ADDRESS,
    abi: REVIEW_POOL_ABI,
    functionName: 'papers',
    args: [paperId],
    query: { refetchInterval: 3000 },
  })

  const { writeContract: writeReqVerdict, data: hashReq, isPending: isReqPending } = useWriteContract()
  const { isLoading: isReqWaiting, isSuccess: isReqSuccess } = useWaitForTransactionReceipt({ hash: hashReq })

  const { writeContract: writeRevVerdict, data: hashRev, isPending: isRevPending } = useWriteContract()
  const { isLoading: isRevWaiting, isSuccess: isRevSuccess } = useWaitForTransactionReceipt({ hash: hashRev })

  const { writeContract: writeRevId, data: hashId, isPending: isIdPending } = useWriteContract()
  const { isLoading: isIdWaiting, isSuccess: isIdSuccess } = useWaitForTransactionReceipt({ hash: hashId })

  useEffect(() => {
    if (!isReqSuccess && !isRevSuccess && !isIdSuccess) return
    void refetch()
  }, [isIdSuccess, isReqSuccess, isRevSuccess, refetch])

  const paper = paperData as PaperTuple | undefined

  if (!hasPaper(paper)) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-white/10 bg-slate-900/80 p-6 text-slate-400 shadow-2xl shadow-black/20">
        <Activity className="mb-4 h-12 w-12 opacity-50" />
        <p>No active paper at ID {paperId.toString()}</p>
      </div>
    )
  }

  const votesIn = Number(paper[4] || 0)
  const passedHasRequested = paper[5] !== `0x${'0'.repeat(64)}`
  const verdictRevealed = Boolean(paper[6])
  const isAccepted = Boolean(paper[7])
  const authorAddress = typeof paper[8] === 'string' ? paper[8] : ''
  const isAuthor = authorAddress.toLowerCase() === (address?.toLowerCase() || '')
  const readyForVerdict = votesIn === 3

  const handleRequestVerdict = () => {
    setActionError(null)
    writeReqVerdict({
      address: REVIEW_POOL_ADDRESS,
      abi: REVIEW_POOL_ABI,
      functionName: 'requestVerdict',
      args: [paperId],
    })
  }

  const handleRevealVerdict = async () => {
    if (!client || !isReady) return
    try {
      setActionError(null)
      const result = await client.decryptForTx(paper[5]).withoutPermit().execute()
      writeRevVerdict({
        address: REVIEW_POOL_ADDRESS,
        abi: REVIEW_POOL_ABI,
        functionName: 'revealVerdict',
        args: [paperId, decryptedToBool(result.decryptedValue), result.signature],
      })
    } catch (err) {
      console.error(err)
      setActionError(err instanceof Error ? err.message : 'Verdict decrypt failed.')
    }
  }

  const handleRevealIdentity = async () => {
    if (!client || !isReady) return
    try {
      setActionError(null)
      const result = await client.decryptForTx(paper[1]).withoutPermit().execute()
      writeRevId({
        address: REVIEW_POOL_ADDRESS,
        abi: REVIEW_POOL_ABI,
        functionName: 'revealIdentity',
        args: [paperId, Number(result.decryptedValue), result.signature],
      })
    } catch (err) {
      console.error(err)
      setActionError(err instanceof Error ? err.message : 'Identity decrypt failed.')
    }
  }

  const steps = [
    { label: 'Submitted', active: true },
    { label: 'Votes', active: readyForVerdict },
    { label: 'Threshold', active: passedHasRequested },
    { label: 'Verdict', active: verdictRevealed },
  ]

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-2">
          <Activity className="h-5 w-5 text-blue-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Review Status</h2>
          <p className="text-sm text-slate-400">Paper #{paperId.toString()} by {shortAddress(authorAddress)}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-400">Votes Received</p>
            <p className="mt-1 text-3xl font-bold text-white">{votesIn} <span className="text-lg font-normal text-slate-500">/ 3</span></p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-slate-400">AI Pre-Score</p>
            <div className="mt-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-300" />
              <p className="text-3xl font-bold text-amber-300">{Number(paper[2])}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {steps.map((step) => (
            <div key={step.label} className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${step.active ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-black/20 text-slate-500'}`}>
              {step.label}
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-lg border border-white/10 bg-slate-950/60 p-5">
          {!passedHasRequested && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-200">Calculate Verdict</h3>
                <p className="text-sm text-slate-400">Compute the encrypted 2-of-3 threshold.</p>
              </div>
              <button
                disabled={votesIn < 3 || isReqPending || isReqWaiting}
                onClick={handleRequestVerdict}
                className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isReqPending || isReqWaiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Request
              </button>
            </div>
          )}

          {passedHasRequested && !verdictRevealed && (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-200">Reveal Verdict</h3>
                <p className="text-sm text-slate-400">Publish the threshold-network decrypt result.</p>
              </div>
              <button
                disabled={!isReady || cofheLoading || isRevPending || isRevWaiting}
                onClick={handleRevealVerdict}
                className="flex items-center gap-2 rounded-md bg-violet-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isRevPending || isRevWaiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                Decrypt
              </button>
            </div>
          )}

          {verdictRevealed && (
            <div className={`rounded-lg border p-4 ${isAccepted ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-red-400/30 bg-red-400/10'}`}>
              <h3 className={`flex items-center gap-2 text-lg font-bold ${isAccepted ? 'text-emerald-200' : 'text-red-200'}`}>
                {isAccepted ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {isAccepted ? 'Paper Accepted' : 'Paper Rejected'}
              </h3>
              
              {isAccepted && isAuthor && (
                <div className="mt-4 border-t border-emerald-400/20 pt-4">
                  <p className="mb-3 text-sm text-emerald-100/80">Accepted papers can unlock the author identity.</p>
                  <button
                    disabled={!isReady || cofheLoading || isIdPending || isIdWaiting}
                    onClick={handleRevealIdentity}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    {isIdPending || isIdWaiting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Reveal Identity
                  </button>
                  {isIdSuccess && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-100">
                      <Radio className="h-4 w-4" />
                      Identity reveal transaction confirmed.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(actionError || cofheError) && (
            <div className="flex gap-2 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{actionError || cofheError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
