# Hashi Frontend Integration Guide

This repo shows the minimum moving pieces for integrating [`@mysten-incubation/hashi`](https://www.npmjs.com/package/@mysten-incubation/hashi) into a browser wallet flow.

The app uses React, React Query, and `@mysten/dapp-kit-react`, but the important boundary is simple: the Hashi SDK derives addresses, reads protocol state, and builds unsigned Sui transactions; your frontend owns wallet connection, signing, user input, and status display.

## Source Map

| File | Purpose |
| --- | --- |
| [src/lib/hashi.ts](src/lib/hashi.ts) | Creates the `HashiClient`, Sui client, and Bitcoin address helpers |
| [src/dapp-kit.ts](src/dapp-kit.ts) | Configures wallet/network support |
| [src/components/DepositPanel.tsx](src/components/DepositPanel.tsx) | Deposit address, BTC tx lookup, UTXO filtering, deposit signing |
| [src/components/WithdrawPanel.tsx](src/components/WithdrawPanel.tsx) | Withdrawal amount validation, BTC address decoding, withdrawal signing |
| [src/components/LookupPanel.tsx](src/components/LookupPanel.tsx) | Manual status lookup by Sui digest |
| [src/lib/deposit-statuses.ts](src/lib/deposit-statuses.ts) | Reads every deposit request emitted by a multi-UTXO deposit transaction |

## 1. Create a Client

```ts
import { HashiClient } from '@mysten-incubation/hashi';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const suiClient = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
});

export const hashi = new HashiClient({
  client: suiClient,
  network: 'testnet',
  bitcoinNetwork: 'signet',
  btcRpcUrl: 'https://...',
});
```

The 0.5 SDK includes the Hashi testnet deployment IDs, so no overrides are needed for the standard deployment. `btcRpcUrl` is optional, but without it your UI must ask users for the Bitcoin output index and amount manually.

## 2. Sign With a Wallet

The SDK's `hashi.tx.*` methods return unsigned Sui transactions. In this app, dApp Kit signs and executes them:

```tsx
const dAppKit = useDAppKit();
const result = await dAppKit.signAndExecuteTransaction({ transaction });
```

Any wallet adapter that can sign a Sui `Transaction` can be used.

## 3. Deposit BTC to hBTC

Generate the user's deposit address:

```ts
const depositAddress = await hashi.generateDepositAddress({
  suiAddress: account.address,
});
```

In SDK 0.5.x, this derives a 2-of-2 taproot address from the on-chain guardian BTC key and the MPC-derived child key. The call fails if the target deployment has not been guardian-provisioned.

After the user sends BTC, find the outputs in their Bitcoin transaction that paid that address:

```ts
const txidHex = userInput.trim().replace(/^0x/i, '').toLowerCase();
const suiTxid = `0x${txidHex}`;

const utxos = await hashi.bitcoin.lookupAllVouts(txidHex, depositAddress);
```

Most deposits have one matching output. `lookupAllVouts()` handles the valid Bitcoin edge case where one transaction pays the same address more than once.

Before submission, check that those outputs are not already tracked by Hashi:

```ts
const usage = await hashi.view.findUsedUtxos(
  utxos.map(({ vout }) => ({ txid: suiTxid, vout })),
);
```

Then build and sign the Sui deposit transaction:

```ts
const transaction = hashi.tx.deposit({
  txid: suiTxid,
  utxos: availableUtxos,
  recipient: account.address,
});

const result = await dAppKit.signAndExecuteTransaction({ transaction });
```

See [DepositPanel.tsx](src/components/DepositPanel.tsx) for the full filtering and UI flow.

## 4. Withdraw hBTC to BTC

Read the current withdrawal minimum and fee estimate:

```ts
const fees = await hashi.view.withdrawalFees(account.address);
```

Decode the user's Bitcoin address into the witness program expected by the transaction builder:

```ts
import { bitcoinAddressToWitnessProgram } from '@mysten-incubation/hashi';

const { program } = bitcoinAddressToWitnessProgram(bitcoinAddress, 'signet');
```

Build and sign the withdrawal transaction:

```ts
const transaction = hashi.tx.requestWithdrawal({
  amount: amountSats,
  bitcoinAddress: program,
});

const result = await dAppKit.signAndExecuteTransaction({ transaction });
```

See [WithdrawPanel.tsx](src/components/WithdrawPanel.tsx) for amount validation and status rendering.

## 5. Read Status and Balance

Deposit status:

```ts
const deposit = await hashi.view.depositStatus(suiTxDigest);
```

Withdrawal status:

```ts
const withdrawal = await hashi.view.withdrawalStatus(suiTxDigest);
```

hBTC balance:

```ts
const { totalBalance } = await hashi.view.balance(account.address);
```

Status polling is frontend-owned. This app uses React Query `refetchInterval` and stops polling once deposits are `confirmed` / `expired` or withdrawals are `Confirmed` / `cancelled`.

## Multi-UTXO Status

`hashi.tx.deposit({ utxos })` can create multiple deposit requests in one Sui transaction. The SDK's `hashi.view.depositStatus(txDigest)` returns one request, which is enough for the common one-output case.

If your UI submits multiple UTXOs at once and needs to display every request from the digest, read every `DepositRequested` event. This repo does that in [src/lib/deposit-statuses.ts](src/lib/deposit-statuses.ts).

## Integration Checklist

1. Create a `HashiClient` with your Sui client and a supported network (testnet is built in to SDK 0.5+).
2. Generate a BTC deposit address with `hashi.generateDepositAddress()`.
3. Look up BTC outputs with `hashi.bitcoin.lookupAllVouts()` or collect `vout` and amount manually.
4. Filter reused outputs with `hashi.view.findUsedUtxos()`.
5. Build unsigned transactions with `hashi.tx.deposit()` and `hashi.tx.requestWithdrawal()`.
6. Sign through your wallet adapter.
7. Poll `hashi.view.depositStatus()` and `hashi.view.withdrawalStatus()` until terminal status.
