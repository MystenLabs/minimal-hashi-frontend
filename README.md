# Minimal Hashi Frontend

A simplified, single-page reference implementation of the [Hashi](https://github.com/MystenLabs/hashi) BTC bridge for Sui. Built as a companion to the Hashi integration guide — strips away all UI polish to focus on the core bridge mechanics.

## What This Demonstrates

### Deposit Flow (BTC → hBTC on Sui)

1. **Derive deposit address** — Each Sui wallet gets a unique Bitcoin P2TR (taproot) address, derived from the MPC committee's public key + the user's Sui address using HKDF-SHA3-256.
2. **Send BTC** — User sends Bitcoin to their derived address (outside this app).
3. **Submit deposit request** — User enters the Bitcoin txid, output index, and amount. The app builds a Sui transaction that creates a `DepositRequest` on-chain.
4. **Poll for confirmation** — The app queries `DepositConfirmedEvent` every 15s until the deposit is confirmed (6 BTC confirmations + committee verification) or expired.

### Withdrawal Flow (hBTC → BTC)

1. **Enter destination** — User provides a Bitcoin address (P2WPKH or P2TR) and hBTC amount.
2. **Submit withdrawal** — The app burns hBTC via `requestWithdrawal()`, which queues the withdrawal on-chain.
3. **Poll for completion** — Tracks the multi-step process: `requested → approved → processing → signed → confirmed`.

### Transaction Lookup

Paste any Sui transaction digest to check the on-chain status of a deposit or withdrawal.

## Project Structure

```
src/
├── App.tsx              # All integration logic + UI in one annotated file
├── main.tsx             # Sui wallet + React Query setup
└── lib/
    ├── constants.ts     # Package/object IDs from env vars
    └── bitcoin.ts       # P2TR address derivation (HKDF + taproot)

contracts/src/           # Generated Move contract bindings (via sui-ts-codegen)
├── hashi/
│   ├── deposit.ts       # deposit()
│   ├── deposit_queue.ts # depositRequest()
│   ├── utxo.ts          # utxoId(), utxo()
│   ├── withdraw.ts      # requestWithdrawal()
│   └── withdrawal_queue.ts  # Event types
└── utils/index.ts       # Binding utilities
```

The entire integration is in `src/App.tsx`, organized into 7 labeled sections:

| Section | Hook | Purpose |
|---------|------|---------|
| 1 | `useDepositAddress()` | Derive unique BTC deposit address from Sui wallet |
| 2 | `useCreateDeposit()` | Build + sign the deposit request transaction |
| 3 | `useDepositStatus()` | Poll on-chain events for deposit confirmation |
| 4 | `useCreateWithdrawal()` | Build + sign the withdrawal request transaction |
| 5 | `useWithdrawalStatus()` | Poll withdrawal queue + events for status |
| 6 | `useHbtcBalance()` | Query hBTC token balance |
| 7 | UI Components | Minimal forms wiring it all together |

## Quick Start

```bash
pnpm install
pnpm dev
```

This starts the app on devnet by default. Open the URL shown in terminal and connect a Sui wallet.

## Configuration

Environment variables (see `.env.devnet`):

| Variable | Description |
|----------|-------------|
| `VITE_DEFAULT_NETWORK` | Sui network: `devnet`, `testnet`, or `mainnet` |
| `VITE_SUI_RPC_URL` | Sui RPC endpoint URL |
| `VITE_HASHI_PACKAGE_ID` | Deployed Hashi Move package ID |
| `VITE_HASHI_OBJECT_ID` | Hashi shared object ID |

To target a different network, create a `.env.testnet` or `.env.mainnet` file and run:

```bash
pnpm vite --mode testnet
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@mysten/dapp-kit` | Sui wallet connection + transaction signing |
| `@mysten/sui` | Sui client, transaction builder, BCS encoding |
| `@noble/curves` | secp256k1 operations for key derivation |
| `@noble/hashes` | SHA-256, SHA3-256, HKDF for address derivation |
| `@scure/base` | bech32/bech32m encoding for Bitcoin addresses |
| `@tanstack/react-query` | Async data fetching + polling |

## How Address Derivation Works

The most Hashi-specific piece is how each Sui wallet gets a unique Bitcoin deposit address:

1. Fetch the MPC committee's public key from the on-chain Hashi object
2. Convert from ark-works compressed format to standard Bitcoin format (02/03 prefix)
3. Compute `tweak = HKDF-SHA3-256(ikm = mpcKey.x || suiAddress)`
4. Derive `newPoint = mpcKey + tweak * G` (secp256k1 point addition)
5. Build a P2TR script-path address using a NUMS internal key + `<derivedKey> OP_CHECKSIG` leaf

See `src/lib/bitcoin.ts` for the full implementation.

## Contract Bindings

The `contracts/` directory contains TypeScript bindings generated from the Hashi Move contracts using [`sui-ts-codegen`](https://github.com/MystenLabs/sui-ts-codegen). Only the bindings actually used by this demo are included:

- `deposit.ts` — `deposit(hashi, request, fee)`
- `deposit_queue.ts` — `depositRequest(utxo)`
- `utxo.ts` — `utxoId(txid, vout)`, `utxo(utxoId, amount, derivationPath)`
- `withdraw.ts` — `requestWithdrawal(hashi, btc, bitcoinAddress)`

To regenerate bindings from the full Hashi package, see the [hashi repository](https://github.com/MystenLabs/hashi).
