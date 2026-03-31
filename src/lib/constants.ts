export const CONFIG = {
	DEFAULT_NETWORK: (import.meta.env.VITE_DEFAULT_NETWORK ?? 'testnet') as string,
	HASHI_OBJECT_ID: import.meta.env.VITE_HASHI_OBJECT_ID ?? '',
	HASHI_PACKAGE_ID: import.meta.env.VITE_HASHI_PACKAGE_ID ?? '',
	SUI_RPC_URL: import.meta.env.VITE_SUI_RPC_URL ?? '',
	BTC_RPC_URL: import.meta.env.VITE_BTC_RPC_URL ?? '',
} as const;

/** Maps Sui network name to the equivalent Bitcoin network for address encoding. */
export function btcNetwork(): 'mainnet' | 'testnet' | 'regtest' {
	return CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'mainnet' : CONFIG.DEFAULT_NETWORK === 'localnet' ? 'regtest' : 'testnet';
}

/** Base URL for the mempool.space block explorer matching the current network. */
export function mempoolBaseUrl(): string {
	return CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/signet';
}

/** Base URL for Suiscan matching the current network. */
export function suiscanBaseUrl(): string {
	return `https://suiscan.xyz/${CONFIG.DEFAULT_NETWORK}`;
}

// Polling intervals (ms)
export const POLL_DEPOSIT_STATUS = 15_000;
export const POLL_WITHDRAWAL_STATUS = 15_000;
export const POLL_BALANCE = 30_000;

/**
 * Navigate nested Move object fields by dotted path.
 * Move objects from the Sui JSON-RPC have a `{ fields: { ... } }` wrapping at each level.
 * Example: getField(obj, 'committee_set.mpc_public_key') navigates
 *   obj.fields.committee_set.fields.mpc_public_key
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getField(obj: unknown, path: string): any {
	const parts = path.split('.');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let current = obj as any;
	for (const part of parts) {
		current = current?.fields?.[part];
		if (current === undefined) return undefined;
	}
	return current;
}
