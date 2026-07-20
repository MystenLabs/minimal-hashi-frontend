import {
	HashiClient,
	bitcoinAddressToWitnessProgram,
	witnessProgramToAddress,
	type BitcoinNetwork,
	type SuiNetwork,
} from '@mysten-incubation/hashi';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { CONFIG, FULLNODE_URLS } from './constants';

export const suiClient = new SuiGrpcClient({
	network: CONFIG.DEFAULT_NETWORK,
	baseUrl: FULLNODE_URLS[CONFIG.DEFAULT_NETWORK] ?? FULLNODE_URLS.testnet,
});

export const HASHI_PACKAGE_ID = CONFIG.HASHI_PACKAGE_ID;
export const HASHI_OBJECT_ID = CONFIG.HASHI_OBJECT_ID;

const SUI_NETWORK = CONFIG.DEFAULT_NETWORK as SuiNetwork;

export const BTC_NETWORK: BitcoinNetwork =
	CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'mainnet'
		: CONFIG.DEFAULT_NETWORK === 'localnet' ? 'regtest'
		: 'signet';

export const hashi = new HashiClient({
	client: suiClient,
	network: SUI_NETWORK,
	packageId: CONFIG.HASHI_PACKAGE_ID || undefined,
	hashiObjectId: CONFIG.HASHI_OBJECT_ID || undefined,
	bitcoinNetwork: BTC_NETWORK,
	btcRpcUrl: CONFIG.BTC_RPC_URL || undefined,
});

export function decodeBitcoinAddress(address: string): Uint8Array {
	return bitcoinAddressToWitnessProgram(address, BTC_NETWORK).program;
}

export function formatBitcoinAddress(program: Uint8Array): string {
	return witnessProgramToAddress(program, BTC_NETWORK);
}
