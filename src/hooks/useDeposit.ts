/**
 * Deposit-related hooks: address derivation, BTC tx lookup, fee reading,
 * deposit creation, and deposit status polling.
 */

import { useCurrentAccount, useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, btcNetwork, getField, POLL_DEPOSIT_STATUS } from '../lib/constants';
import { arkworksToCompressedHex, deriveDepositAddress } from '../lib/bitcoin';

import { utxoId as createUtxoId, utxo as createUtxo } from '@contracts/hashi/utxo';
import { depositRequest as createDepositRequest } from '@contracts/hashi/deposit_queue';
import { deposit } from '@contracts/hashi/deposit';

// ============================================================================
// Deposit Address Derivation
// ============================================================================

/**
 * Derives a unique Bitcoin P2TR (taproot) deposit address for a given Sui wallet.
 *
 * How it works:
 * 1. Fetch the MPC committee's public key from the Hashi on-chain object
 * 2. Convert from ark-works format to standard Bitcoin compressed format
 * 3. Derive a unique key using HKDF-SHA3-256(mpcKey.x || suiAddress)
 * 4. Build a P2TR script-path address with the derived key
 *
 * Each Sui address gets a deterministic, unique Bitcoin deposit address.
 */
export function useDepositAddress(recipient: string | undefined) {
	const client = useCurrentClient();

	return useQuery({
		queryKey: ['deposit-address', recipient],
		queryFn: async () => {
			if (!recipient) return null;

			// Fetch the Hashi object to get the MPC public key
			const hashiObject = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const content = hashiObject.data?.content;
			if (!content || content.dataType !== 'moveObject') {
				throw new Error('Failed to fetch Hashi object');
			}

			// Navigate to: hashi.committee_set.mpc_public_key
			const mpcKeyBytes = getField(content, 'committee_set.mpc_public_key') as number[];

			// Convert ark-works compressed point → standard Bitcoin compressed format
			const mpcPubkeyHex = arkworksToCompressedHex(mpcKeyBytes);

			// Derive the unique P2TR deposit address
			const address = deriveDepositAddress(mpcPubkeyHex, recipient, btcNetwork());

			return { address, mpcPublicKey: mpcPubkeyHex };
		},
		enabled: !!recipient && !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 5 * 60 * 1000,
	});
}

// ============================================================================
// Look Up Bitcoin Transaction
// ============================================================================

/**
 * Fetches a Bitcoin transaction via JSON-RPC and finds the output matching
 * the user's deposit address. Returns the vout index and amount in satoshis.
 *
 * Uses `getrawtransaction` with verbose=true to get decoded output details,
 * then matches against the derived deposit address.
 */
export function useBtcTransaction(txid: string | undefined, depositAddress: string | undefined) {
	return useQuery({
		queryKey: ['btc-tx', txid],
		queryFn: async () => {
			if (!txid || !depositAddress) return null;

			const res = await fetch(CONFIG.BTC_RPC_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'getrawtransaction',
					params: [txid.trim(), true],
				}),
			});

			const json = await res.json();
			if (json.error) throw new Error(json.error.message);

			const tx = json.result;
			const matchingOutput = tx.vout.find(
				(out: { scriptPubKey: { address?: string } }) =>
					out.scriptPubKey.address === depositAddress,
			);

			if (!matchingOutput) {
				throw new Error(`No output found matching your deposit address ${depositAddress}`);
			}

			return {
				vout: matchingOutput.n as number,
				amountSats: BigInt(Math.round(matchingOutput.value * 1e8)),
				amountBtc: (matchingOutput.value as number).toFixed(8),
			};
		},
		enabled: !!txid && txid.length === 64 && !!depositAddress && !!CONFIG.BTC_RPC_URL,
		retry: false,
	});
}

// ============================================================================
// Deposit Fee
// ============================================================================

/**
 * Reads the protocol deposit fee from the on-chain Hashi config.
 *
 * The fee is stored in the config VecMap under the key "deposit_fee" as a U64
 * value in MIST (SUI's smallest unit). The deposit() Move function requires
 * an exact match — sending 0 will abort.
 */
export function useDepositFee() {
	const client = useCurrentClient();

	return useQuery({
		queryKey: ['deposit-fee'],
		queryFn: async () => {
			const hashiObject = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const content = hashiObject.data?.content;
			if (!content || content.dataType !== 'moveObject') return 0n;

			// Navigate: hashi.config.config.contents[] (VecMap entries)
			const contents = getField(content, 'config.config.contents') as Array<Record<string, unknown>> | undefined;

			if (contents) {
				for (const entry of contents) {
					const entryFields = entry.fields as Record<string, unknown> | undefined;
					if (entryFields?.key === 'deposit_fee') {
						const valueObj = entryFields.value as Record<string, unknown>;
						if (valueObj?.variant === 'U64') {
							const valFields = valueObj.fields as Record<string, string>;
							return BigInt(valFields.pos0 ?? '0');
						}
						break;
					}
				}
			}

			return 0n;
		},
		enabled: !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 60_000,
	});
}

// ============================================================================
// Create Deposit Request
// ============================================================================

/**
 * Submits a deposit request on-chain after the user has sent BTC.
 *
 * Transaction structure:
 * 1. utxo_id(txid, vout)           → identifies the Bitcoin UTXO
 * 2. utxo(utxoId, amount, address) → wraps UTXO with amount + recipient
 * 3. deposit_request(utxo)         → creates the on-chain request
 * 4. splitCoins(gas, [fee])        → splits SUI for the protocol fee
 * 5. deposit(hashi, request, fee)  → submits to the Hashi contract
 */
export function useCreateDeposit() {
	const dAppKit = useDAppKit();
	const { data: depositFee } = useDepositFee();

	return async (txid: string, vout: number, amountSats: bigint, recipient: string) => {
		const pkg = CONFIG.HASHI_PACKAGE_ID;
		const fee = depositFee ?? 0n;

		// Bitcoin txids are displayed in reversed byte order.
		// The Move contract expects internal byte order (reversed from display).
		const txidBytes = txid.replace(/^0x/, '').match(/.{2}/g);
		if (!txidBytes || txidBytes.length !== 32) throw new Error('Invalid txid: must be 64 hex characters');
		const reversedTxid = '0x' + txidBytes.reverse().join('');

		const tx = new Transaction();

		// Step 1: Create UtxoId from txid + output index
		const [utxoIdResult] = tx.add(
			createUtxoId({ package: pkg, arguments: [reversedTxid, vout] }),
		);

		// Step 2: Create Utxo with amount and derivation path (= recipient Sui address)
		const [utxoResult] = tx.add(
			createUtxo({ package: pkg, arguments: [utxoIdResult, amountSats, recipient] }),
		);

		// Step 3: Create DepositRequest (assigns an on-chain ID + timestamp)
		const [requestResult] = tx.add(
			createDepositRequest({ package: pkg, arguments: [utxoResult] }),
		);

		// Step 4: Split SUI for the protocol deposit fee
		const [feeCoin] = tx.splitCoins(tx.gas, [fee]);

		// Step 5: Submit the deposit to the Hashi contract
		tx.add(
			deposit({ package: pkg, arguments: [CONFIG.HASHI_OBJECT_ID, requestResult, feeCoin] }),
		);

		return dAppKit.signAndExecuteTransaction({ transaction: tx });
	};
}

// ============================================================================
// Poll Deposit Status
// ============================================================================

/**
 * Polls the on-chain status of a deposit by its Sui transaction digest.
 *
 * Status flow: pending → confirmed | expired
 *
 * How it works:
 * 1. Fetch the original tx to find the DepositRequestedEvent (contains request_id)
 * 2. Query DepositConfirmedEvent — if found with matching request_id, it's confirmed
 * 3. Query ExpiredDepositDeletedEvent — if found, it expired (3-day window)
 * 4. Otherwise, still pending (waiting for 6 BTC confirmations)
 */
export function useDepositStatus(txDigest: string | undefined) {
	const client = useCurrentClient();
	const pkg = CONFIG.HASHI_PACKAGE_ID;

	return useQuery({
		queryKey: ['deposit-status', txDigest],
		queryFn: async () => {
			if (!txDigest) return null;

			// 1. Get the DepositRequestedEvent from the original transaction
			const tx = await client.getTransactionBlock({
				digest: txDigest,
				options: { showEvents: true },
			});

			const depositEvent = tx.events?.find((e) =>
				e.type.includes('::deposit::DepositRequestedEvent'),
			);
			if (!depositEvent?.parsedJson) return null;

			const parsed = depositEvent.parsedJson as {
				request_id: string;
				utxo_id: { txid: string; vout: number };
				amount: string;
				derivation_path: string | null;
				timestamp_ms: string;
			};

			// 2. Check for confirmation
			let status: 'pending' | 'confirmed' | 'expired' = 'pending';

			try {
				const confirmedEvents = await client.queryEvents({
					query: { MoveEventType: `${pkg}::deposit::DepositConfirmedEvent` },
					limit: 50,
				});
				if (confirmedEvents.data.some(
					(e) => (e.parsedJson as { request_id: string })?.request_id === parsed.request_id,
				)) {
					status = 'confirmed';
				}
			} catch { /* event type may not exist yet */ }

			// 3. Check for expiry
			if (status === 'pending') {
				try {
					const expiredEvents = await client.queryEvents({
						query: { MoveEventType: `${pkg}::deposit::ExpiredDepositDeletedEvent` },
						limit: 50,
					});
					if (expiredEvents.data.some(
						(e) => (e.parsedJson as { request_id: string })?.request_id === parsed.request_id,
					)) {
						status = 'expired';
					}
				} catch { /* ok */ }
			}

			// Convert internal byte order back to display txid
			const txidHex = (parsed.utxo_id.txid as string).replace('0x', '');
			const btcTxid = txidHex.match(/.{2}/g)?.reverse().join('') ?? txidHex;

			return {
				requestId: parsed.request_id,
				amount: (Number(parsed.amount) / 1e8).toFixed(8),
				btcTxid,
				btcVout: parsed.utxo_id.vout,
				status,
			};
		},
		enabled: !!txDigest && !!pkg,
		// Poll until confirmed or expired
		refetchInterval: (query) => {
			const data = query.state.data;
			if (data?.status === 'confirmed' || data?.status === 'expired') return false;
			return POLL_DEPOSIT_STATUS;
		},
	});
}
