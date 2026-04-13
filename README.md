# Minimal Hashi Frontend

Reference frontend for the [Hashi](https://github.com/MystenLabs/hashi) BTC bridge on Sui, built with [`hashi-sdk`](../hashi-sdk). Demonstrates deposits (BTC to hBTC), withdrawals (hBTC to BTC), balance display, and status polling.

This is a working example, not a production app. See [**INTEGRATION.md**](INTEGRATION.md) for a walkthrough of how each piece works.

## Quick start

```bash
pnpm install
pnpm dev
```

Open the URL and connect a Sui wallet.

## Configuration

Environment variables in [`.env.devnet`](.env.devnet):

| Variable | Description |
|----------|-------------|
| `VITE_DEFAULT_NETWORK` | `devnet`, `testnet`, or `mainnet` |
| `VITE_HASHI_PACKAGE_ID` | Hashi Move package ID |
| `VITE_HASHI_OBJECT_ID` | Hashi shared object ID |
| `VITE_BTC_RPC_URL` | Bitcoin JSON-RPC endpoint (for UTXO auto-detection) |

Target a different network:

```bash
pnpm vite --mode testnet
```

## Project structure

```
src/
  App.tsx                    # Shell: wallet connect, balance, tabs
  main.tsx                   # Providers (dApp Kit, React Query)
  dapp-kit.ts                # dApp Kit config
  lib/
    hashi.ts                 # HashiClient singleton
    constants.ts             # Env vars, URLs, polling intervals
  components/
    DepositPanel.tsx          # Deposit flow
    WithdrawPanel.tsx         # Withdrawal flow
    LookupPanel.tsx           # Transaction lookup
    ExplorerLink.tsx          # Explorer links with copy
    StatusBadge.tsx           # Status indicator
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [`hashi-sdk`](../hashi-sdk) | All Hashi protocol operations |
| `@mysten/dapp-kit-react` | Wallet connection + transaction signing |
| `@mysten/sui` | Sui client |
| `@tanstack/react-query` | Data fetching + polling |
