/**
 * Hashi Integration Guide — Entry Point
 *
 * Minimal setup required to interact with the Hashi BTC bridge:
 * 1. DAppKitProvider — connects to Sui and enables wallet connection
 * 2. QueryClientProvider — React Query for async data fetching
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';

import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { dAppKit } from './dapp-kit';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<DAppKitProvider dAppKit={dAppKit}>
				<App />
			</DAppKitProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
