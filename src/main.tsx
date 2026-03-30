/**
 * Hashi Integration Guide — Entry Point
 *
 * Minimal setup required to interact with the Hashi BTC bridge:
 * 1. SuiClientProvider — connects to a Sui RPC node
 * 2. WalletProvider   — enables browser wallet connection (e.g. Sui Wallet)
 * 3. QueryClientProvider — React Query for async data fetching
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import '@mysten/dapp-kit/dist/index.css';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { CONFIG } from './lib/constants';

// Configure the Sui network. For production, use 'mainnet'.
const networks = {
	devnet: { url: CONFIG.SUI_RPC_URL || getJsonRpcFullnodeUrl('devnet'), network: 'devnet' as const },
	testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' as const },
	mainnet: { url: getJsonRpcFullnodeUrl('mainnet'), network: 'mainnet' as const },
};

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networks} defaultNetwork={CONFIG.DEFAULT_NETWORK as keyof typeof networks}>
				<WalletProvider autoConnect>
					<App />
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
