import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { CONFIG, FULLNODE_URLS } from './lib/constants';

export const dAppKit = createDAppKit({
	networks: [CONFIG.DEFAULT_NETWORK] as [string, ...string[]],
	defaultNetwork: CONFIG.DEFAULT_NETWORK,
	createClient(network) {
		return new SuiGrpcClient({
			network,
			baseUrl: FULLNODE_URLS[network] ?? FULLNODE_URLS.devnet,
		});
	},
});

declare module '@mysten/dapp-kit-react' {
	interface Register {
		dAppKit: typeof dAppKit;
	}
}
