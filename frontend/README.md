# BlindPeer Frontend

This Next.js app is the live BlindPeer interface for submitting encrypted papers, assigning reviewers, collecting encrypted votes, and revealing the aggregate verdict.

## Run Locally

From the repository root:

```bash
pnpm install
pnpm frontend:dev
```

Or from this directory:

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Environment

Create `frontend/.env.local` when you need to override the deployed review pool or enable Groq scoring:

```bash
NEXT_PUBLIC_REVIEW_POOL_ADDRESS=0x...
GROQ_API_KEY=...
```

`GROQ_API_KEY` is optional. If it is missing or the API request fails, the scoring endpoint returns a deterministic fallback so the submission flow can still be tested.

## Useful Scripts

- `pnpm dev` - start the Next.js dev server with webpack
- `pnpm build` - create a production build
- `pnpm lint` - run ESLint
