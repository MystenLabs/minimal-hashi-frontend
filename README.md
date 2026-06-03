# Minimal Hashi Frontend

Reference frontend for the [Hashi](https://github.com/MystenLabs/hashi) BTC bridge on Sui, built with the published [`@mysten-incubation/hashi`](https://www.npmjs.com/package/@mysten-incubation/hashi) SDK.

This repo is an integration guide, not a production app. It intentionally keeps the UI plain and the SDK calls close to the components so partners can see the moving pieces: deposit address derivation, BTC UTXO lookup, Sui wallet signing, hBTC withdrawals, balance reads, and status polling.

See [INTEGRATION.md](INTEGRATION.md) for a walkthrough of the implementation.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open the Vite URL and connect a Sui wallet.

## Configuration

Environment variables in [`.env.devnet`](.env.devnet):

| Variable | Description |
| --- | --- |
| `VITE_DEFAULT_NETWORK` | Sui network, usually `devnet` for this reference app |
| `VITE_HASHI_PACKAGE_ID` | Hashi Move package ID |
| `VITE_HASHI_OBJECT_ID` | Hashi shared object ID |
| `VITE_BTC_RPC_URL` | Bitcoin JSON-RPC endpoint for transaction-output lookup |

Target a different mode by creating the matching env file and running Vite with that mode:

```bash
pnpm vite --mode testnet
```

Bitcoin address encoding is configured in [src/lib/hashi.ts](src/lib/hashi.ts): Sui `devnet` maps to Bitcoin `signet`, Sui `mainnet` maps to Bitcoin `mainnet`, Sui `localnet` maps to Bitcoin `regtest`, and other Sui networks map to Bitcoin `testnet`.

## Deposit Behavior

Most Bitcoin deposits have one output to the Hashi deposit address. The example still calls `hashi.bitcoin.lookupAllVouts()` because a Bitcoin transaction can contain more than one output to the same address.

The deposit flow:

1. Derives the user's Bitcoin deposit address with `hashi.generateDepositAddress({ suiAddress })`.
2. Looks up all Bitcoin outputs in the supplied txid that pay to that address.
3. Checks `hashi.view.findUsedUtxos()` so already-used outputs are not submitted again.
4. Builds one Sui transaction with `hashi.tx.deposit({ txid, utxos, recipient })`.
5. Signs and executes through dApp Kit.

The lookup screen uses [src/lib/deposit-statuses.ts](src/lib/deposit-statuses.ts) to render every `DepositRequestedEvent` emitted by a multi-UTXO deposit transaction. The SDK's `hashi.view.depositStatus(txDigest)` returns one request, which is enough for the common case but not for displaying all requests in a batch.

As of `@mysten-incubation/hashi` 0.3.x, deposit addresses are 2-of-2 taproot addresses derived from the on-chain guardian BTC key and the MPC-derived child key. `hashi.generateDepositAddress()` reads that guardian config and fails if the deployment is not guardian-provisioned.

## Dependencies

| Package | Purpose |
| --- | --- |
| `@mysten-incubation/hashi` | Hashi protocol SDK |
| `@mysten/dapp-kit-react` | Wallet connection and transaction signing |
| `@mysten/sui` | Sui client |
| `@tanstack/react-query` | Data fetching and polling |

## Commands

```bash
pnpm dev      # start dev server in devnet mode
pnpm build    # type check and production build
```
