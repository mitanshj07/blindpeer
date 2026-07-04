# BlindPeer

BlindPeer is a Fhenix CoFHE demo for encrypted consensus scoring: an author submits a paper, Groq produces a plaintext reviewer pre-signal, three assigned reviewers submit encrypted approve/reject votes, and the contract reveals only the aggregate 2-of-3 verdict.

## Run Locally

```bash
pnpm install
pnpm compile
pnpm test
pnpm hardhat deploy-review-pool --network localhost
pnpm frontend:dev
```

The frontend defaults to the latest local deployment in `frontend/src/config.ts` and runs on [http://localhost:3000](http://localhost:3000). Set `NEXT_PUBLIC_REVIEW_POOL_ADDRESS` to point at another deployment.

## Environment

Copy `.env.example` to `.env` for contract deployment keys. Copy `frontend/.env.example` to `frontend/.env.local` for Groq and public frontend overrides:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

`GROQ_API_KEY` is optional for local demos. If it is missing or Groq times out, `/api/groq-score` returns a deterministic fallback score so the submission flow keeps moving.

## Useful Scripts

- `pnpm compile` - compile `EncryptedReviewPool`
- `pnpm test` - run Hardhat CoFHE mock tests
- `pnpm deploy:review-pool --network localhost` - deploy the review pool
- `pnpm arb-sepolia:deploy-review-pool` - deploy to Arbitrum Sepolia
- `pnpm frontend:dev` - run the Next.js app with webpack
- `pnpm frontend:build` - production build

## Demo Flow

1. Connect the author wallet and submit title, abstract, and three reviewer addresses.
2. Groq returns a quality pre-signal, or the fallback scorer does if the API is unavailable.
3. The browser encrypts the author identity and submits the paper hash, encrypted author ID, score, and reviewer set.
4. Switch to each reviewer wallet and cast encrypted approve/reject votes.
5. Request the encrypted threshold verdict once all three votes are in.
6. Decrypt and publish the verdict. If accepted, the author can publish the identity reveal.
