import type { DepositInfo, DepositStatus } from 'hashi-sdk';

import { hashi } from './hashi';

const OBJECT_BAG_ADDRESS_TYPE = '0x0000000000000000000000000000000000000000000000000000000000000002::dynamic_object_field::Wrapper<address>';

type DepositEventJson = {
	request_id: string;
	utxo_id: { txid: string; vout: number };
	amount: string;
	derivation_path: string | null;
	timestamp_ms: string;
};

export async function getDepositStatusesByDigest(txDigest: string): Promise<DepositInfo[]> {
	const txResult = await hashi.client.getTransaction({
		digest: txDigest,
		include: { events: true },
	});

	const txData = txResult.Transaction ?? txResult.FailedTransaction;
	if (!txData?.events) return [];

	const requestsBagId = await fetchDepositRequestsBagId();

	const depositEvents = txData.events.filter(
		(event: { eventType: string; json?: unknown }) =>
			event.eventType.includes('::deposit::DepositRequestedEvent') && !!event.json,
	);

	return Promise.all(
		depositEvents.map((event: { json: unknown }) =>
			buildDepositInfo(event.json as DepositEventJson, txDigest, requestsBagId),
		),
	);
}

async function buildDepositInfo(
	parsed: DepositEventJson,
	txDigest: string,
	requestsBagId: string | null,
): Promise<DepositInfo> {
	let status: DepositStatus = 'unknown';

	try {
		const { object } = await hashi.client.getObject({
			objectId: parsed.request_id,
			include: { json: true },
		});

		if (!object?.objectId) {
			throw new Error('Deposit request not found');
		}

		if (requestsBagId) {
			const reqResult = await hashi.client
				.getDynamicField({
					parentId: requestsBagId,
					name: { type: OBJECT_BAG_ADDRESS_TYPE, bcs: serializeAddress(parsed.request_id) },
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
		amount: (Number(parsed.amount) / 1e8).toString(),
		derivationPath: parsed.derivation_path,
		btcTxid,
		btcVout: parsed.utxo_id.vout,
		timestampMs: parsed.timestamp_ms,
		status,
		suiTxDigest: txDigest,
	};
}

async function fetchDepositRequestsBagId(): Promise<string | null> {
	try {
		const result = await hashi.client.getDynamicField({
			parentId: hashi.objectId,
			name: {
				type: `${hashi.packageId}::bitcoin_state::BitcoinStateKey`,
				bcs: new Uint8Array([0]),
			},
		});

		if (!result.dynamicField?.fieldId) return null;

		const { object } = await hashi.client.getObject({
			objectId: result.dynamicField.fieldId,
			include: { json: true },
		});

		if (!object?.json) return null;

		const json = object.json as Record<string, unknown>;
		const bitcoinState = (json.value ?? json) as Record<string, unknown>;
		const depositQueue =
			((bitcoinState.deposit_queue as Record<string, unknown> | undefined)?.fields as Record<string, unknown>) ??
			(bitcoinState.deposit_queue as Record<string, unknown> | undefined);

		return getFieldId(depositQueue, 'requests');
	} catch {
		return null;
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

function serializeAddress(addr: string): Uint8Array {
	const hex = addr.startsWith('0x') ? addr.slice(2) : addr;
	const padded = hex.padStart(64, '0');
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 32; i += 1) {
		bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}
