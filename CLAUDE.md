# CLAUDE.md

## Project Overview

Minimal reference implementation of the Hashi BTC bridge frontend for Sui. This is an integration guide — not a production app. The goal is clarity over completeness.

## Commands

- `pnpm dev` — Start dev server (devnet mode)
- `pnpm build` — Type check + production build
- `npx tsc --noEmit` — Type check only

## Architecture

Single-page React app. All Hashi integration logic lives in `src/App.tsx`, organized into 7 labeled sections (deposit address derivation, create deposit, poll deposit, create withdrawal, poll withdrawal, balance, UI).

- `src/lib/bitcoin.ts` — Bitcoin address derivation crypto. Do not simplify — the math is load-bearing.
- `contracts/src/` — Generated Move contract bindings via sui-ts-codegen. Do not hand-edit these files.
- `src/lib/constants.ts` — Reads config from Vite env vars.

## Key Patterns

- All blockchain interactions use React Query hooks (`useQuery` for reads, manual `mutateAsync` for writes).
- Contract calls are built using the `Transaction` builder from `@mysten/sui` and signed via `useSignAndExecuteTransaction()` from `@mysten/dapp-kit`.
- Status polling uses `refetchInterval` that stops once a terminal state is reached (confirmed/expired/cancelled).
- Bitcoin txids are stored in reversed byte order on-chain (internal byte order). Convert with `.match(/.{2}/g).reverse().join('')` for display.
- The `bitcoinAddress` parameter in withdrawals is raw witness program bytes, not the bech32-encoded string. Use `bitcoinAddressToWitnessProgram()` to convert.

## Environment

- Devnet config in `.env.devnet` — contains package ID and object ID.
- To target other networks, create `.env.testnet` / `.env.mainnet` with the corresponding IDs.

## Style

- This is a reference/guide codebase. Prioritize readability and clear comments over DRY code.
- Keep everything in as few files as possible. Do not split App.tsx into separate component files.
- Section headers in App.tsx use `// ===` comment blocks — maintain this structure.
- JSDoc comments on hooks explain the "why" and the on-chain mechanics, not just the "what".
