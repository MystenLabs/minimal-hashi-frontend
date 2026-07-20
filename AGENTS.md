# AGENTS.md

## Project Overview

Minimal reference implementation of the Hashi BTC bridge frontend for Sui. This is an integration guide, not a production app. The goal is clarity over completeness.

## Commands

- `pnpm dev` — Start dev server in testnet mode
- `pnpm build` — Type check and production build
- `npx tsc --noEmit` — Type check only

## Architecture

Single-page React app. Hashi protocol operations are delegated to the published `@mysten-incubation/hashi` SDK. The frontend keeps SDK calls close to the components so partners can copy the relevant integration points.

- `src/App.tsx` — App shell: wallet connect, balance display, tab switcher, footer.
- `src/components/DepositPanel.tsx` — Deposit flow UI. Derives deposit address, looks up all matching BTC outputs, filters already-used UTXOs, and submits all available UTXOs with `hashi.tx.deposit()`.
- `src/components/WithdrawPanel.tsx` — Withdrawal form and status display. Reads fees/minimums, decodes the BTC address, builds `hashi.tx.requestWithdrawal()`, and shows pipeline status.
- `src/components/LookupPanel.tsx` — Transaction lookup by Sui digest. Displays all deposit requests emitted by a multi-UTXO deposit transaction and withdrawal request details.
- `src/components/ExplorerLink.tsx` — Clickable and copiable links to Suiscan / mempool.space.
- `src/components/StatusBadge.tsx` — Colored status badge.
- `src/lib/hashi.ts` — Singleton `HashiClient`, standalone `SuiGrpcClient`, deployment config exports, and Bitcoin address encode/decode helpers.
- `src/lib/deposit-statuses.ts` — Frontend helper for multi-deposit lookup by digest. It reads all `DepositRequested` events because `hashi.view.depositStatus()` returns one request.
- `src/lib/constants.ts` — Testnet deployment defaults, environment overrides, fullnode URLs, explorer URL constants, polling intervals, `formatBtc()`.
- `src/dapp-kit.ts` — dApp Kit 2.0 configuration with `SuiGrpcClient`.
- `src/main.tsx` — Entry point with `DAppKitProvider` and `QueryClientProvider`.

## Key Patterns

- All blockchain reads use React Query hooks.
- Wallet signing uses `useDAppKit().signAndExecuteTransaction()`.
- The SDK's `hashi.tx.*` methods build unsigned transactions for browser wallets.
- `hashi.generateDepositAddress()` derives the current guardian+MPC 2-of-2 taproot address and requires guardian BTC config on the target deployment.
- Deposit submission uses `hashi.bitcoin.lookupAllVouts()` and `hashi.view.findUsedUtxos()` before `hashi.tx.deposit({ utxos })`.
- Withdrawal submission uses `hashi.view.withdrawalFees()` to enforce the current on-chain minimum before signing.
- Withdrawal status values from the SDK are title-cased (`Requested`, `Approved`, `Processing`, `Signed`, `Confirmed`) except `cancelled`.
- Status polling uses `refetchInterval` that stops once terminal states are reached.
- Both dApp Kit and `HashiClient` use `SuiGrpcClient` connecting directly to Sui fullnodes.

## Dependencies

- `@mysten-incubation/hashi` — Hashi protocol SDK.
- `@mysten/dapp-kit-react` — Wallet connection, transaction signing, React context.
- `@mysten/sui` — Sui blockchain SDK.
- `@tanstack/react-query` — Data fetching and caching.

## Environment

- Testnet deployment defaults live in the SDK and `src/lib/constants.ts`; developers set `VITE_BTC_RPC_URL` in `.env.local` to enable Bitcoin transaction-output lookup.
- Fullnode URLs are hardcoded per network in `src/lib/constants.ts`.
- SDK 0.5+ includes Hashi's standard testnet deployment IDs; environment IDs are explicit overrides.
- Bitcoin network encoding is derived in `src/lib/hashi.ts`: Sui `testnet` and `devnet` map to BTC `signet`, Sui `mainnet` maps to BTC `mainnet`, and Sui `localnet` maps to BTC `regtest`.

## Style

- Prioritize readability and clear comments over abstraction.
- UI components live in `src/components/`; shared utilities live in `src/lib/`.
- Keep SDK queries in components via `useQuery`; do not add a separate hook layer unless the repeated code becomes distracting.
- This file is the canonical agent instruction file. `CLAUDE.md` is only a compatibility pointer for older Claude Code workflows.
