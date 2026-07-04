import type { Abi, Address } from 'viem'
import EncryptedReviewPoolABI from '@/abis/EncryptedReviewPool.json'
import { CONTRACT_ADDRESS } from '@/config'

export const REVIEW_POOL_ABI = EncryptedReviewPoolABI.abi as Abi
export const REVIEW_POOL_ADDRESS = CONTRACT_ADDRESS as Address

export const ZERO_HASH = `0x${'0'.repeat(64)}` as const
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export type PaperTuple = readonly [
  paperHash: `0x${string}`,
  encAuthorId: bigint,
  groqScore: number,
  reviewers: readonly [Address, Address, Address],
  voteSum: bigint,
  votesIn: number,
  passed: bigint,
  verdictRevealed: boolean,
  accepted: boolean,
  author: Address,
]

export type ReviewerStatuses = readonly [
  reviewers: readonly [Address, Address, Address],
  voted: readonly [boolean, boolean, boolean],
]

export function hasPaper(paper: PaperTuple | undefined): paper is PaperTuple {
  return Boolean(paper && paper[0] !== ZERO_HASH)
}

export function shortAddress(address: string, chars = 4) {
  if (!address || address === ZERO_ADDRESS) return 'Unassigned'
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
