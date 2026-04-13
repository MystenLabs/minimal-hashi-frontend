# Hashi Frontend Integration Guide

This guide walks through integrating [`hashi-sdk`](../hashi-sdk) into a React frontend with wallet connection, transaction signing, and status polling. The code in this repo is the working example — each section links to the relevant source file.

For the full SDK API reference, see the [hashi-sdk README](../hashi-sdk/README.md).

## Overview

| Flow | What the SDK does | What your frontend does |
|------|-------------------|------------------------|
| **Deposit** (BTC to hBTC) | Derives deposit address, looks up Bitcoin tx, builds Sui transaction | Signs + executes transaction, polls status |
| **Withdrawal** (hBTC to BTC) | Builds burn transaction with witness program encoding | Signs + executes, shows progress pipeline |
| **Balance** | Queries hBTC coin objects | Formats and displays |
| **Status tracking** | Reads on-chain request state, returns typed status | Polls with `refetchInterval`, stops on terminal state |

The SDK is framework-agnostic — it builds transactions but never signs them. Your frontend handles wallet interaction and UI.

## Setup

### 1. Create the HashiClient (once, at module level)

[`src/lib/hashi.ts`](src/lib/hashi.ts)

```ts
import { HashiClient } from 'hashi-sdk';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const client = new SuiGrpcClient({
  network: 'devnet',
  baseUrl: 'https://fullnode.devnet.sui.io:443',
});

export const hashi = new HashiClient(client, {
  packageId: '0x...',    // from env vars or config
  objectId: '0x...',
  bitcoinNetwork: 'testnet',
  btcRpcUrl: 'https://...', // optional, for UTXO auto-detection
});
```

The client is stateless — one singleton serves the whole app.

### 2. Wire up wallet connection

[`src/dapp-kit.ts`](src/dapp-kit.ts) / [`src/main.tsx`](src/main.tsx)

This example uses [`@mysten/dapp-kit-react`](https://www.npmjs.com/package/@mysten/dapp-kit-react) for wallet connect and transaction signing. Any Sui wallet adapter works.

```ts
import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

export const dAppKit = createDAppKit({
  networks: ['devnet', 'testnet', 'mainnet'],
  defaultNetwork: 'devnet',
  createClient(network) {
    return new SuiGrpcClient({ network, baseUrl: FULLNODE_URLS[network] });
  },
});
```

```tsx
<QueryClientProvider client={queryClient}>
  <DAppKitProvider dAppKit={dAppKit}>
    <App />
  </DAppKitProvider>
</QueryClientProvider>
```

## Deposit flow

[`src/components/DepositPanel.tsx`](src/components/DepositPanel.tsx)

The deposit is a 3-step process: derive address, wait for BTC, submit on-chain request.

### Step 1 — Generate a deposit address

```ts
const { address } = await hashi.generateDepositAddress(suiAddress);
// Display this address to the user — they send BTC to it
```

The address is deterministic (same Sui address always gets the same BTC address), so you can cache it aggressively. In this example we use React Query with a 5-minute `staleTime`:

```tsx
const { data } = useQuery({
  queryKey: ['deposit-address', account?.address],
  queryFn: () => hashi.generateDepositAddress(account!.address),
  enabled: !!account?.address,
  staleTime: 5 * 60 * 1000,
});
```

### Step 2 — Look up the Bitcoin transaction

After the user sends BTC, they provide the Bitcoin txid. The SDK finds the matching output:

```ts
const result = await hashi.lookupBitcoinVout(btcTxid, depositAddress);
// result = { vout: 0, amountSats: 100000n }
```

This requires `btcRpcUrl` to be configured on the HashiClient. If you don't have a Bitcoin RPC, you can ask the user for the vout and amount manually.

### Step 3 — Build and sign the deposit transaction

```ts
const { transaction } = hashi.buildDepositTransaction({
  txid: btcTxid,
  utxos: [{ vout: result.vout, amountSats: result.amountSats }],
  recipient: suiAddress,
});

const result = await dAppKit.signAndExecuteTransaction({ transaction });
```

### Step 4 — Poll for confirmation

```ts
const info = await hashi.getDepositStatus(suiTxDigest);
// info.status: 'pending' | 'confirmed' | 'expired'
```

In React, use `refetchInterval` that stops on terminal states:

```tsx
const { data: status } = useQuery({
  queryKey: ['deposit-status', digest],
  queryFn: () => hashi.getDepositStatus(digest),
  refetchInterval: (query) => {
    const s = query.state.data?.status;
    if (s === 'confirmed' || s === 'expired') return false;
    return 15_000;
  },
});
```

## Withdrawal flow

[`src/components/WithdrawPanel.tsx`](src/components/WithdrawPanel.tsx)

### Build and sign

```ts
const { transaction } = hashi.buildWithdrawalTransaction({
  amountSats: BigInt(Math.round(parseFloat(userInput) * 1e8)),
  bitcoinAddress: 'tb1q...', // SDK handles witness program extraction
});

const result = await dAppKit.signAndExecuteTransaction({ transaction });
```

### Poll status

```ts
const info = await hashi.getWithdrawalStatus(suiTxDigest);
// info.status: 'requested' | 'approved' | 'processing' | 'signed' | 'confirmed' | 'cancelled'
```

The withdrawal pipeline has more stages than deposits. This example shows a progress bar across the steps — see the source file linked above.

## Balance query

```ts
const { totalBalance } = await hashi.getBalance(suiAddress);
```

`totalBalance` is in satoshis (bigint). Format for display:

```ts
const display = (Number(totalBalance) / 1e8).toFixed(8) + ' hBTC';
```

## Adapting for your platform

This example uses React + dApp Kit, but the SDK doesn't require either. The integration points are:

1. **Create a `HashiClient`** with your Sui client and Hashi config
2. **Call SDK methods** to build transactions (`buildDepositTransaction`, `buildWithdrawalTransaction`)
3. **Sign transactions** with whatever wallet adapter your platform uses
4. **Poll status** using `getDepositStatus` / `getWithdrawalStatus` (or the blocking `waitForDeposit` / `waitForWithdrawal` helpers for server-side flows)

For server-side or non-React integrations, the SDK provides blocking helpers that poll internally:

```ts
const deposit = await hashi.waitForDeposit(txDigest);
const withdrawal = await hashi.waitForWithdrawal(txDigest);
```
