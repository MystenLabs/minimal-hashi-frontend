import { HashiClient } from 'hashi-sdk';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { CONFIG, FULLNODE_URLS } from './constants';

const client = new SuiGrpcClient({
	network: CONFIG.DEFAULT_NETWORK,
	baseUrl: FULLNODE_URLS[CONFIG.DEFAULT_NETWORK] ?? FULLNODE_URLS.devnet,
});

const BTC_NETWORK = CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'mainnet' as const
	: CONFIG.DEFAULT_NETWORK === 'localnet' ? 'regtest' as const
	: 'testnet' as const;

export const hashi = new HashiClient(client, {
	packageId: CONFIG.HASHI_PACKAGE_ID,
	objectId: CONFIG.HASHI_OBJECT_ID,
	bitcoinNetwork: BTC_NETWORK,
	btcRpcUrl: CONFIG.BTC_RPC_URL || undefined,
});
