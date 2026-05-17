import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, SUISCAN_BASE_URL, POLL_BALANCE, formatBtc } from './lib/constants';
import { hashi } from './lib/hashi';
import { DepositAddressDisplay, DepositPanel } from './components/DepositPanel';
import { WithdrawPanel } from './components/WithdrawPanel';
import { LookupPanel } from './components/LookupPanel';

type Tab = 'deposit' | 'withdraw' | 'lookup';

const TAB_LABELS: Record<Tab, string> = {
	deposit: 'Deposit BTC',
	withdraw: 'Withdraw hBTC',
	lookup: 'Lookup TX',
};

export default function App() {
	const account = useCurrentAccount();
	const [activeTab, setActiveTab] = useState<Tab>('deposit');

	return (
		<div className="min-h-screen p-8 max-w-2xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<h1 className="text-2xl font-bold">Hashi Integration Guide</h1>
				<ConnectButton />
			</div>

			{!account ? (
				<div className="text-center py-20 text-gray-400">
					Connect your Sui wallet to get started.
				</div>
			) : (
				<>
					<BalanceDisplay />
					<DepositAddressDisplay />

					<div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1">
						{(['deposit', 'withdraw', 'lookup'] as const).map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
									activeTab === tab
										? 'bg-gray-700 text-white'
										: 'text-gray-400 hover:text-gray-200'
								}`}
							>
								{TAB_LABELS[tab]}
							</button>
						))}
					</div>

					{activeTab === 'deposit' && <DepositPanel />}
					{activeTab === 'withdraw' && <WithdrawPanel />}
					{activeTab === 'lookup' && <LookupPanel />}
				</>
			)}

			<div className="mt-12 text-xs text-gray-600 border-t border-gray-800 pt-6 space-y-1">
				<p>Network: {CONFIG.DEFAULT_NETWORK}</p>
				<p>Package: <a href={`${SUISCAN_BASE_URL}/object/${CONFIG.HASHI_PACKAGE_ID}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{CONFIG.HASHI_PACKAGE_ID}</a></p>
				<p>Hashi Object: <a href={`${SUISCAN_BASE_URL}/object/${CONFIG.HASHI_OBJECT_ID}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{CONFIG.HASHI_OBJECT_ID}</a></p>
			</div>
		</div>
	);
}

function BalanceDisplay() {
	const account = useCurrentAccount();

	const { data: balance } = useQuery({
		queryKey: ['hbtc-balance', account?.address],
		queryFn: async () => {
			const b = await hashi.view.balance(account!.address);
			return { totalBalance: b.totalBalance, formatted: formatBtc(b.totalBalance) };
		},
		enabled: !!account,
		refetchInterval: POLL_BALANCE,
	});

	if (!balance) return null;
	return (
		<div className="mb-6 p-4 bg-gray-900 rounded-lg">
			<span className="text-gray-400 text-sm">hBTC Balance:</span>{' '}
			<span className="text-lg font-bold">{balance.formatted} hBTC</span>
		</div>
	);
}
