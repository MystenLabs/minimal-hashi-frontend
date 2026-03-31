# CLAUDE.md

## Project Overview

Minimal reference implementation of the Hashi BTC bridge frontend for Sui. This is an integration guide — not a production app. The goal is clarity over completeness.

## Commands

- `pnpm dev` — Start dev server (devnet mode)
- `pnpm build` — Type check + production build
- `pnpm codegen` — Regenerate contract bindings from on-chain package (requires `sui` CLI pointed at devnet)
- `npx tsc --noEmit` — Type check only

## Architecture

Single-page React app split into hooks, components, and shared utilities.

- `src/App.tsx` — App shell: wallet connect, balance display, tab switcher, footer.
- `src/hooks/useDeposit.ts` — Deposit hooks: address derivation, BTC tx lookup, fee reading, deposit creation, status polling.
- `src/hooks/useWithdrawal.ts` — Withdrawal hooks: withdrawal creation and status polling.
- `src/hooks/useHbtcBalance.ts` — hBTC balance query.
- `src/components/DepositPanel.tsx` — Deposit flow UI (3-step wizard) and deposit address display.
- `src/components/WithdrawPanel.tsx` — Withdrawal form and status display with pipeline visualization.
- `src/components/LookupPanel.tsx` — Transaction lookup by Sui digest.
- `src/components/ExplorerLink.tsx` — Clickable + copiable link to Suiscan / mempool.space.
- `src/components/StatusBadge.tsx` — Colored status badge.
- `src/lib/constants.ts` — Env vars, explorer URL helpers, network mapping, Move field navigation helper, polling intervals.
- `src/lib/bitcoin.ts` — Bitcoin address derivation crypto. Do not simplify — the math is load-bearing.
- `src/dapp-kit.ts` — dApp Kit 2.0 configuration. Creates a typed `dAppKit` instance with `SuiJsonRpcClient`.
- `src/main.tsx` — Entry point with `DAppKitProvider` and `QueryClientProvider`.
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
- Hooks live in `src/hooks/`, UI components in `src/components/`, shared utilities in `src/lib/`.
- Section headers in hook files use `// ===` comment blocks — maintain this structure.
- JSDoc comments on hooks explain the "why" and the on-chain mechanics, not just the "what".
