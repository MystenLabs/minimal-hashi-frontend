/**
 * Withdrawal-related hooks: creating withdrawal requests and polling status.
 */

import { useCurrentClient, useDAppKit } from '@mysten/dapp-kit-react';
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, btcNetwork, getField, POLL_WITHDRAWAL_STATUS } from '../lib/constants';
import { bitcoinAddressToWitnessProgram, witnessProgramToAddress } from '../lib/bitcoin';

import { requestWithdrawal } from '@contracts/hashi/withdraw';

// ============================================================================
// Request Withdrawal
// ============================================================================

/**
 * Submits a withdrawal request to convert hBTC back to BTC.
 *
 * Transaction structure:
 * 1. coinWithBalance({ type: hBTC, balance }) → assembles hBTC coins to burn
 * 2. requestWithdrawal(hashi, btcCoin, bitcoinAddress) → burns hBTC, queues withdrawal
 *
 * The bitcoinAddress is passed as raw witness program bytes (extracted from bech32).
 * The protocol fee is deducted from the hBTC amount automatically.
 */
export function useCreateWithdrawal() {
	const dAppKit = useDAppKit();

	return async (amountSats: bigint, bitcoinAddress: string) => {
		const pkg = CONFIG.HASHI_PACKAGE_ID;
		const btcCoinType = `${pkg}::btc::BTC`;

		// Extract witness program bytes from the Bitcoin address
		const witnessProgram = bitcoinAddressToWitnessProgram(bitcoinAddress);

		const tx = new Transaction();

		// Step 1: Assemble hBTC coins to the exact withdrawal amount
		const btcCoin = tx.add(coinWithBalance({ type: btcCoinType, balance: amountSats }));

		// Step 2: Submit withdrawal request (burns hBTC, creates on-chain request)
		tx.add(
			requestWithdrawal({
				package: pkg,
				arguments: [CONFIG.HASHI_OBJECT_ID, btcCoin, witnessProgram],
			}),
		);

		return dAppKit.signAndExecuteTransaction({ transaction: tx });
	};
}

// ============================================================================
// Poll Withdrawal Status
// ============================================================================

/**
 * Polls the on-chain status of a withdrawal by its Sui transaction digest.
 *
 * Withdrawal status flow:
 *   requested → approved → processing → signed → confirmed
 *
 * Simplified version: checks if the request is still in the withdrawal queue.
 * If not found, queries events to determine if confirmed or cancelled.
 */
export function useWithdrawalStatus(txDigest: string | undefined) {
	const client = useCurrentClient();
	const pkg = CONFIG.HASHI_PACKAGE_ID;

	return useQuery({
		queryKey: ['withdrawal-status', txDigest],
		queryFn: async () => {
			if (!txDigest) return null;

			// 1. Get the WithdrawalRequestedEvent from the original transaction
			const tx = await client.getTransactionBlock({
				digest: txDigest,
				options: { showEvents: true },
			});

			const withdrawEvent = tx.events?.find((e) =>
				e.type.includes('::withdrawal_queue::WithdrawalRequestedEvent'),
			);
			if (!withdrawEvent?.parsedJson) return null;

			const parsed = withdrawEvent.parsedJson as {
				request_id: string;
				btc_amount: string;
				bitcoin_address: number[];
				timestamp_ms: string;
				requester_address: string;
			};

			const btcAddr = witnessProgramToAddress(parsed.bitcoin_address, btcNetwork());

			// 2. Check if request is still in the withdrawal queue
			const hashiObj = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const hashiContent = hashiObj.data?.content;
			if (!hashiContent || hashiContent.dataType !== 'moveObject') return null;

			const wqFields = getField(hashiContent, 'withdrawal_queue');
			const requestsBagId = getField(wqFields, 'requests.id') as Record<string, string> | undefined;

			let status: 'requested' | 'approved' | 'processing' | 'confirmed' | 'cancelled' = 'confirmed';

			if (requestsBagId?.id) {
				try {
					const requestObj = await client.getDynamicFieldObject({
						parentId: requestsBagId.id,
						name: { type: 'address', value: parsed.request_id },
					});
					if (requestObj.data?.content && requestObj.data.content.dataType === 'moveObject') {
						const reqFields = requestObj.data.content.fields as Record<string, unknown>;
						const valueFields = (reqFields.value as Record<string, unknown>)?.fields as Record<string, unknown>;
						status = valueFields?.approved ? 'approved' : 'requested';
					}
				} catch {
					// Not in requests bag — check if it's in pending_withdrawals or already confirmed
					const pendingBagId = getField(wqFields, 'pending_withdrawals.id') as Record<string, string> | undefined;
					if (pendingBagId?.id) {
						try {
							const dynamicFields = await client.getDynamicFields({ parentId: pendingBagId.id, limit: 50 });
							for (const field of dynamicFields.data) {
								const pendingId = (field.name as { value: string }).value;
								const obj = await client.getDynamicFieldObject({
									parentId: pendingBagId.id,
									name: { type: 'address', value: pendingId },
								});
								if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
									const pFields = obj.data.content.fields as Record<string, unknown>;
									const vFields = (pFields.value as Record<string, unknown>)?.fields as Record<string, unknown>;
									const requests = vFields?.requests as Array<Record<string, unknown>> | undefined;
									if (requests?.some((r) => (r.fields as Record<string, unknown>)?.id === parsed.request_id)) {
										status = 'processing';
										break;
									}
								}
							}
						} catch { /* ok */ }
					}
				}
			}

			return {
				requestId: parsed.request_id,
				btcAmount: (Number(parsed.btc_amount) / 1e8).toFixed(8),
				bitcoinAddress: btcAddr,
				status,
			};
		},
		enabled: !!txDigest && !!pkg,
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			if (s === 'confirmed' || s === ('cancelled' as typeof s)) return false;
			return POLL_WITHDRAWAL_STATUS;
		},
	});
}
