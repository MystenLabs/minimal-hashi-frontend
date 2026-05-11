# CLAUDE.md

## Project Overview

Minimal reference implementation of the Hashi BTC bridge frontend for Sui. This is an integration guide — not a production app. The goal is clarity over completeness.

## Commands

- `pnpm dev` — Start dev server (devnet mode)
- `pnpm build` — Type check + production build
- `npx tsc --noEmit` — Type check only

## Architecture

Single-page React app. All on-chain logic is delegated to `hashi-sdk` — the frontend hooks are thin React Query wrappers around SDK methods.

- `src/App.tsx` — App shell: wallet connect, balance display, tab switcher, footer.
- `src/components/DepositPanel.tsx` — Deposit flow UI (3-step wizard) and deposit address display. Looks up all matching BTC outputs, filters already-used UTXOs, and submits all available UTXOs in one SDK-built transaction.
- `src/components/WithdrawPanel.tsx` — Withdrawal form and status display with fee/minimum validation and pipeline visualization.
- `src/components/LookupPanel.tsx` — Transaction lookup by Sui digest. Displays all deposit requests emitted by a multi-UTXO deposit transaction.
- `src/components/ExplorerLink.tsx` — Clickable + copiable link to Suiscan / mempool.space.
- `src/components/StatusBadge.tsx` — Colored status badge.
- `src/lib/hashi.ts` — Singleton `HashiClient` instance (from `hashi-sdk`), configured from env vars. Uses a standalone `SuiGrpcClient`.
- `src/lib/deposit-statuses.ts` — Frontend helper for multi-deposit lookup by digest. Mirrors the SDK's status resolution with public client calls because `getDepositStatus()` returns one request.
- `src/lib/constants.ts` — Env vars, fullnode URLs, explorer URL constants, polling intervals, `formatBtc()`.
- `src/dapp-kit.ts` — dApp Kit 2.0 configuration. Creates a typed `dAppKit` instance with `SuiGrpcClient`.
- `src/main.tsx` — Entry point with `DAppKitProvider` and `QueryClientProvider`.

## Key Patterns

- All blockchain interactions use React Query hooks (`useQuery` for reads, `useDAppKit()` for transaction signing).
- The `HashiClient` from `hashi-sdk` builds transactions — dApp Kit signs and executes them.
- Deposit submission uses `lookupAllBitcoinVouts()` and `findUsedUtxos()` before `buildDepositTransaction({ utxos })`.
- Withdrawal submission uses `getWithdrawalFees()` to enforce the current on-chain minimum before signing.
- Status polling uses `refetchInterval` that stops once a terminal state is reached (confirmed/expired/cancelled).
- Both dApp Kit and `HashiClient` use `SuiGrpcClient` connecting directly to Sui fullnodes (no proxy needed).

## Dependencies

- `hashi-sdk` — linked locally from `../hashi-sdk`. Provides `HashiClient` for Hashi protocol operations (deposits, withdrawals, balance, status, Bitcoin address derivation). Rebuild the SDK and force reinstall this frontend after SDK changes so pnpm repacks the local dependency.
- `@mysten/dapp-kit-react` — Wallet connection, transaction signing, React context.
- `@mysten/sui` — Sui blockchain SDK (peer dep of hashi-sdk).
- `@tanstack/react-query` — Data fetching and caching.

## Environment

- Devnet config in `.env.devnet` — contains package ID, object ID, and BTC RPC URL. These deployment IDs are not embedded in the SDK.
- Fullnode URLs are hardcoded per network in `src/lib/constants.ts` — no proxy needed.
- To target other networks, create `.env.testnet` / `.env.mainnet` with the corresponding IDs.
- Bitcoin network encoding is derived in `src/lib/hashi.ts`: Sui `mainnet` maps to BTC `mainnet`, `localnet` maps to BTC `regtest`, and everything else maps to BTC `testnet`.

## Style

- This is a reference/guide codebase. Prioritize readability and clear comments over DRY code.
- UI components in `src/components/`, shared utilities in `src/lib/`.
- SDK queries are inlined in components via `useQuery` — no separate hook layer.
