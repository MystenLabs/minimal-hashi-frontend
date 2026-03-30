/**
 * dApp Kit 2.0 configuration.
 *
 * Creates a typed dAppKit instance that all hooks automatically pick up
 * via the module-level Register interface.
 */

import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { CONFIG } from './lib/constants';

const RPC_URLS: Record<string, string> = {
	devnet: CONFIG.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
	testnet: 'https://fullnode.testnet.sui.io:443',
	mainnet: 'https://fullnode.mainnet.sui.io:443',
};

const networkList = [CONFIG.DEFAULT_NETWORK, 'devnet', 'testnet', 'mainnet'].filter(
	(v, i, a) => a.indexOf(v) === i,
) as [string, ...string[]];

export const dAppKit = createDAppKit({
	networks: networkList,
	defaultNetwork: CONFIG.DEFAULT_NETWORK,
	createClient(network) {
		return new SuiJsonRpcClient({ network, url: RPC_URLS[network] ?? RPC_URLS.devnet });
	},
});

declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
