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

No environment file is needed for Hashi's standard testnet deployment: the SDK and this app default to its package and object IDs.

To enable automatic Bitcoin transaction-output lookup, create a local, untracked [`.env.local`](.env.local):

```dotenv
VITE_BTC_RPC_URL=https://your-signet-bitcoin-rpc.example.com/
```

Hashi on Sui testnet uses Bitcoin signet. [src/lib/hashi.ts](src/lib/hashi.ts) maps Sui `testnet` and `devnet` to Bitcoin `signet`, `mainnet` to Bitcoin `mainnet`, and `localnet` to Bitcoin `regtest`.

For a custom deployment, set `VITE_DEFAULT_NETWORK`, `VITE_HASHI_PACKAGE_ID`, and `VITE_HASHI_OBJECT_ID` in the appropriate Vite environment file.

## Deposit Behavior

Most Bitcoin deposits have one output to the Hashi deposit address. The example still calls `hashi.bitcoin.lookupAllVouts()` because a Bitcoin transaction can contain more than one output to the same address.

The deposit flow:

1. Derives the user's Bitcoin deposit address with `hashi.generateDepositAddress({ suiAddress })`.
2. Looks up all Bitcoin outputs in the supplied txid that pay to that address.
3. Checks `hashi.view.findUsedUtxos()` so already-used outputs are not submitted again.
4. Builds one Sui transaction with `hashi.tx.deposit({ txid, utxos, recipient })`.
5. Signs and executes through dApp Kit.

The lookup screen uses [src/lib/deposit-statuses.ts](src/lib/deposit-statuses.ts) to render every `DepositRequested` event emitted by a multi-UTXO deposit transaction. The SDK's `hashi.view.depositStatus(txDigest)` returns one request, which is enough for the common case but not for displaying all requests in a batch.

As of `@mysten-incubation/hashi` 0.5.x, deposit addresses are 2-of-2 taproot addresses derived from the on-chain guardian BTC key and the MPC-derived child key. `hashi.generateDepositAddress()` reads that guardian config and fails if the deployment is not guardian-provisioned.

## Dependencies

| Package | Purpose |
| --- | --- |
| `@mysten-incubation/hashi` | Hashi protocol SDK |
| `@mysten/dapp-kit-react` | Wallet connection and transaction signing |
| `@mysten/sui` | Sui client |
| `@tanstack/react-query` | Data fetching and polling |

## Commands

```bash
pnpm dev      # start dev server in testnet mode
pnpm build    # type check and production build
```
