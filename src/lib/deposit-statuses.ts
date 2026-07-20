import type { DepositInfo, DepositStatus } from '@mysten-incubation/hashi';
import { bcs } from '@mysten/sui/bcs';

import { HASHI_OBJECT_ID, HASHI_PACKAGE_ID, hashi, suiClient } from './hashi';

const OBJECT_BAG_ADDRESS_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_object_field::Wrapper<address>';

type DepositEventJson = {
	request_id: string;
	utxo_id: { txid: string; vout: number };
	amount: string;
	derivation_path: string | null;
	timestamp_ms: string;
};

export async function getDepositStatusesByDigest(txDigest: string): Promise<DepositInfo[]> {
	const txResult = await suiClient.getTransaction({
		digest: txDigest,
		include: { events: true },
	});

	const txData = txResult.Transaction ?? txResult.FailedTransaction;
	if (!txData?.events) return [];

	const [requestsBagId, depositTimeDelayMs] = await Promise.all([
		fetchDepositRequestsBagId(),
		fetchDepositTimeDelayMs(),
	]);

	const depositEvents = txData.events.filter(
		(event: { eventType: string; json?: unknown }) =>
			event.eventType.includes('::deposit::DepositRequested') && !!event.json,
	);

	return Promise.all(
		depositEvents.map((event: { json: unknown }) =>
			buildDepositInfo(event.json as DepositEventJson, txDigest, requestsBagId, depositTimeDelayMs),
		),
	);
}

async function buildDepositInfo(
	parsed: DepositEventJson,
	txDigest: string,
	requestsBagId: string | undefined,
	depositTimeDelayMs: bigint | null,
): Promise<DepositInfo> {
	let status: DepositStatus = 'unknown';
	let approvalTimestampMs: bigint | null = null;
	let confirmableAtMs: bigint | null = null;

	try {
		const { object } = await suiClient.getObject({
			objectId: parsed.request_id,
			include: { json: true },
		});

		if (!object?.objectId) {
			throw new Error('Deposit request not found');
		}

		approvalTimestampMs = getBigIntField(object.json, 'approved_timestamp_ms');
		if (approvalTimestampMs !== null && depositTimeDelayMs !== null) {
			confirmableAtMs = approvalTimestampMs + depositTimeDelayMs;
		}

		if (requestsBagId === undefined) {
			status = 'unknown';
		} else if (requestsBagId) {
			const reqResult = await suiClient
				.getDynamicField({
					parentId: requestsBagId,
					name: { type: OBJECT_BAG_ADDRESS_TYPE, bcs: bcs.Address.serialize(parsed.request_id).toBytes() },
				})
				.catch(() => null);

			status = reqResult?.dynamicField ? 'pending' : 'confirmed';
		} else {
			status = 'confirmed';
		}
	} catch {
		status = 'expired';
	}

	const txidHex = parsed.utxo_id.txid.replace('0x', '');
	const btcTxid = txidHex.match(/.{2}/g)?.reverse().join('') ?? txidHex;

	return {
		requestId: parsed.request_id,
		amountSats: BigInt(parsed.amount),
		recipient: parsed.derivation_path,
		btcTxid,
		btcVout: parsed.utxo_id.vout,
		timestampMs: BigInt(parsed.timestamp_ms),
		approvalTimestampMs,
		confirmableAtMs,
		status,
		suiTxDigest: txDigest,
	};
}

async function fetchDepositTimeDelayMs(): Promise<bigint | null> {
	return hashi.view.all()
		.then((config) => config.bitcoinDepositTimeDelayMs)
		.catch(() => null);
}

async function fetchDepositRequestsBagId(): Promise<string | undefined> {
	try {
		const result = await suiClient.getDynamicField({
			parentId: HASHI_OBJECT_ID,
			name: {
				type: `${HASHI_PACKAGE_ID}::bitcoin_state::BitcoinStateKey`,
				bcs: bcs.bool().serialize(false).toBytes(),
			},
		});

		if (!result.dynamicField?.fieldId) return undefined;

		const { object } = await suiClient.getObject({
			objectId: result.dynamicField.fieldId,
			include: { json: true },
		});

		if (!object?.json) return undefined;

		const json = object.json as Record<string, unknown>;
		const bitcoinState = (json.value ?? json) as Record<string, unknown>;
		const depositQueue =
			((bitcoinState.deposit_queue as Record<string, unknown> | undefined)?.fields as Record<string, unknown>) ??
			(bitcoinState.deposit_queue as Record<string, unknown> | undefined);

		return getFieldId(depositQueue, 'requests') ?? undefined;
	} catch {
		return undefined;
	}
}

function getFieldId(parent: Record<string, unknown> | undefined, field: string): string | null {
	const obj = parent?.[field] as Record<string, unknown> | undefined;
	if (!obj) return null;

	const rawId = obj.id;
	if (typeof rawId === 'string') return rawId;

	const id =
		(rawId as Record<string, string> | undefined)?.id ??
		((obj.fields as Record<string, unknown> | undefined)?.id as Record<string, string> | undefined)?.id;

	return id ?? null;
}

function getBigIntField(json: unknown, field: string): bigint | null {
	if (!json || typeof json !== 'object') return null;

	const root = json as Record<string, unknown>;
	const value = (root.value ?? root.fields ?? root) as Record<string, unknown>;
	const raw = value[field] ?? (value.fields as Record<string, unknown> | undefined)?.[field];

	if (raw === null || raw === undefined) return null;
	if (typeof raw === 'bigint') return raw;
	if (typeof raw === 'string' || typeof raw === 'number') return BigInt(raw);
	return null;
}
