export const CONFIG = {
	DEFAULT_NETWORK: (import.meta.env.VITE_DEFAULT_NETWORK ?? 'testnet') as string,
	HASHI_OBJECT_ID: import.meta.env.VITE_HASHI_OBJECT_ID ?? '',
	HASHI_PACKAGE_ID: import.meta.env.VITE_HASHI_PACKAGE_ID ?? '',
	BTC_RPC_URL: import.meta.env.VITE_BTC_RPC_URL ?? '',
} as const;

export const FULLNODE_URLS: Record<string, string> = {
	devnet: 'https://fullnode.devnet.sui.io:443',
	testnet: 'https://fullnode.testnet.sui.io:443',
	mainnet: 'https://fullnode.mainnet.sui.io:443',
};

export const MEMPOOL_BASE_URL = CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/signet';
export const SUISCAN_BASE_URL = `https://suiscan.xyz/${CONFIG.DEFAULT_NETWORK}`;

// Polling intervals (ms)
export const POLL_DEPOSIT_STATUS = 15_000;
export const POLL_WITHDRAWAL_STATUS = 15_000;
export const POLL_BALANCE = 30_000;

/** Format satoshis as a BTC decimal string (8 decimal places). */
export function formatBtc(sats: bigint): string {
	return (Number(sats) / 1e8).toFixed(8);
}

/** Format a millisecond timestamp from SDK status objects for compact display. */
export function formatTimestampMs(timestampMs: bigint | null | undefined): string | null {
	if (timestampMs === null || timestampMs === undefined) return null;
	return new Date(Number(timestampMs)).toLocaleString();
}
