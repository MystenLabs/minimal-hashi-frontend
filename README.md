# Minimal Hashi Frontend

Reference frontend for the [Hashi](https://github.com/MystenLabs/hashi) BTC bridge on Sui, built with the local [`hashi-sdk`](../hashi-sdk). Demonstrates multi-output deposits (BTC to hBTC), withdrawals (hBTC to BTC), balance display, and status polling.

This is a working example, not a production app. See [**INTEGRATION.md**](INTEGRATION.md) for a walkthrough of how each piece works.

## Quick start

```bash
pnpm install
pnpm dev
```

Open the URL and connect a Sui wallet.

`hashi-sdk` is linked from `../hashi-sdk`, so rebuild and reinstall after SDK changes:

```bash
cd ../hashi-sdk && pnpm build
cd ../minimal-hashi-frontend && CI=true pnpm install --force
```

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

`VITE_DEFAULT_NETWORK` selects the Sui fullnode. The frontend maps Sui `mainnet` to Bitcoin `mainnet`, `localnet` to Bitcoin `regtest`, and all other Sui networks to Bitcoin `testnet` for address encoding.

## Deposit behavior

The deposit flow looks up all Bitcoin transaction outputs that pay to the derived Hashi deposit address, filters out UTXOs already tracked by the protocol, and submits the remaining UTXOs in a single Sui transaction. The lookup screen also renders every deposit request emitted by a multi-UTXO deposit transaction.

## Dependencies

| Package | Purpose |
|---------|---------|
| [`hashi-sdk`](../hashi-sdk) | All Hashi protocol operations |
| `@mysten/dapp-kit-react` | Wallet connection + transaction signing |
| `@mysten/sui` | Sui client |
| `@tanstack/react-query` | Data fetching + polling |
