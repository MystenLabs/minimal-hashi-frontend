# CLAUDE.md

## Project Overview

Minimal reference implementation of the Hashi BTC bridge frontend for Sui. This is an integration guide — not a production app. The goal is clarity over completeness.

## Commands

- `pnpm dev` — Start dev server (devnet mode)
- `pnpm build` — Type check + production build
- `pnpm codegen` — Regenerate contract bindings from on-chain package (requires `sui` CLI pointed at devnet)
- `npx tsc --noEmit` — Type check only

## Architecture

Single-page React app. All Hashi integration logic lives in `src/App.tsx`, organized into labeled sections (deposit address derivation, BTC tx lookup, deposit fee + create deposit, poll deposit, create withdrawal, poll withdrawal, balance, UI).

- `src/dapp-kit.ts` — dApp Kit 2.0 configuration. Creates a typed `dAppKit` instance with `SuiJsonRpcClient`.
- `src/main.tsx` — Entry point with `DAppKitProvider` and `QueryClientProvider`.
- `src/lib/bitcoin.ts` — Bitcoin address derivation crypto. Do not simplify — the math is load-bearing.
- `src/lib/constants.ts` — Reads config from Vite env vars (including `BTC_RPC_URL`).
- `contracts/src/` — Generated Move contract bindings via `@mysten/codegen`. Gitignored — run `pnpm codegen` to generate. Do not hand-edit.
- `contracts/sui-codegen.config.ts` — Codegen config pointing at the on-chain devnet package.

## Key Patterns

- All blockchain interactions use React Query hooks (`useQuery` for reads, `useDAppKit()` for transaction signing).
- Contract calls are built using the `Transaction` builder from `@mysten/sui` and signed via `dAppKit.signAndExecuteTransaction()`.
- Contract binding arguments use array syntax (positional), not named objects — on-chain bytecode doesn't preserve parameter names.
- The deposit fee is read from the on-chain Hashi config (`useDepositFee`) and must exactly match when calling `deposit()`.
- BTC transaction details (vout, amount) are auto-detected via `getrawtransaction` JSON-RPC call to `VITE_BTC_RPC_URL`.
- Status polling uses `refetchInterval` that stops once a terminal state is reached (confirmed/expired/cancelled).
- Bitcoin txids are stored in reversed byte order on-chain (internal byte order). Convert with `.match(/.{2}/g).reverse().join('')` for display.
- The `bitcoinAddress` parameter in withdrawals is raw witness program bytes, not the bech32-encoded string. Use `bitcoinAddressToWitnessProgram()` to convert.

## Environment

- Devnet config in `.env.devnet` — contains package ID, object ID, and BTC RPC URL.
- `VITE_SUI_RPC_URL` is set to `/sui-rpc` in dev, proxied to the Sui fullnode by Vite to avoid CORS issues (see `vite.config.mts`).
- To target other networks, create `.env.testnet` / `.env.mainnet` with the corresponding IDs.

## Style

- This is a reference/guide codebase. Prioritize readability and clear comments over DRY code.
- Keep everything in as few files as possible. Do not split App.tsx into separate component files.
- Section headers in App.tsx use `// ===` comment blocks — maintain this structure.
- JSDoc comments on hooks explain the "why" and the on-chain mechanics, not just the "what".
