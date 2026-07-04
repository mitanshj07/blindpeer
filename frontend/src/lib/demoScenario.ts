import type { Address } from 'viem'

export type DemoStage =
  | 'ready'
  | 'submittingIdea'
  | 'matching'
  | 'matched'
  | 'approvingEncryption'
  | 'encrypting'
  | 'submittingPaper'
  | 'submitted'

export type DemoReviewer = {
  name: string
  specialty: string
  address: Address
  matchScore: number
  reason: string
}

export const DEMO_AUTHOR = '0xF2838E9976FEd502dfe2B247aa398F1628d8fB41' as Address

export const DEMO_PAPER = {
  id: 'DEMO-01',
  title: 'Zero-Knowledge Proofs for Privacy-Preserving Clinical Trials',
  abstract:
    'Clinical trial data is traditionally siloed by strict patient privacy regulations, which limits cross-institutional research and slows validation. This paper proposes BlindTrial, a decentralized review and audit architecture using zero-knowledge proofs and fully homomorphic encryption so hospitals can prove eligibility, safety, and outcome statistics without exposing raw patient records. Reviewers evaluate encrypted evidence, the protocol computes a private approval threshold, and accepted work can reveal only the minimal author identity required for publication. The system is evaluated across oncology trial simulations, adversarial reviewer behavior, and governance constraints for HIPAA and GDPR-aligned research workflows.',
  hash: '0xff7bb6a5e07718ed9f3173860a07071f07164d8b8e67165d806c42d045c9b331' as `0x${string}`,
  aiScore: 9,
  aiRationale:
    'The submission has a strong privacy thesis, clear FHE/ZK fit, and a concrete clinical governance use case with measurable review criteria.',
} as const

export const DEMO_REVIEWERS = [
  {
    name: 'Dr. Asha Raman',
    specialty: 'Zero-knowledge systems',
    address: '0x6dFC5a1478A918451A5b58e2464AC00fFda97d9e' as Address,
    matchScore: 97,
    reason: 'Strong match on proof systems, encrypted attestations, and reviewer threat models.',
  },
  {
    name: 'Prof. Miguel Alvarez',
    specialty: 'FHE and private ML',
    address: '0x046073797012FF255aD38ACc92608e945EEBf858' as Address,
    matchScore: 94,
    reason: 'Best match for homomorphic computation, threshold logic, and encrypted scoring.',
  },
  {
    name: 'Dr. Naomi Chen',
    specialty: 'Clinical data governance',
    address: '0xD82e14c47cb3d05f832805acE30C178255c5b9aD' as Address,
    matchScore: 92,
    reason: 'Covers HIPAA, GDPR, trial safety workflows, and publication policy.',
  },
] as const satisfies readonly DemoReviewer[]
