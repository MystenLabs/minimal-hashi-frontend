import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, POLL_DEPOSIT_STATUS, POLL_WITHDRAWAL_STATUS } from '../lib/constants';
import { hashi } from '../lib/hashi';
import { ExplorerLink } from './ExplorerLink';
import { StatusBadge } from './StatusBadge';

export function LookupPanel() {
	const [digest, setDigest] = useState('');
	const [lookupDigest, setLookupDigest] = useState('');
	const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');

	const { data: depositStatus, isLoading: depositLoading } = useQuery({
		queryKey: ['deposit-status', lookupDigest],
		queryFn: () => hashi.getDepositStatus(lookupDigest),
		enabled: txType === 'deposit' && !!lookupDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			if (s === 'confirmed' || s === 'expired') return false;
			return POLL_DEPOSIT_STATUS;
		},
	});

	const { data: withdrawalStatus, isLoading: withdrawalLoading } = useQuery({
		queryKey: ['withdrawal-status', lookupDigest],
		queryFn: () => hashi.getWithdrawalStatus(lookupDigest),
		enabled: txType === 'withdrawal' && !!lookupDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			if (s === 'confirmed' || s === 'cancelled') return false;
			return POLL_WITHDRAWAL_STATUS;
		},
	});

	const isLoading = depositLoading || withdrawalLoading;
	const status = txType === 'deposit' ? depositStatus : withdrawalStatus;

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Transaction Lookup</h2>
			<p className="text-sm text-gray-400">
				Paste a Sui transaction digest to check the status of a deposit or withdrawal.
			</p>

			<div className="flex gap-2 mb-2">
				<button
					onClick={() => setTxType('deposit')}
					className={`px-3 py-1 rounded text-sm ${txType === 'deposit' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
				>
					Deposit
				</button>
				<button
					onClick={() => setTxType('withdrawal')}
					className={`px-3 py-1 rounded text-sm ${txType === 'withdrawal' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}
				>
					Withdrawal
				</button>
			</div>

			<div className="flex gap-2">
				<input
					type="text"
					value={digest}
					onChange={(e) => setDigest(e.target.value)}
					placeholder="Sui transaction digest..."
					className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
				/>
				<button
					onClick={() => setLookupDigest(digest.trim())}
					disabled={!digest.trim()}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
				>
					Lookup
				</button>
			</div>

			{isLoading && lookupDigest && (
				<p className="text-gray-500 text-sm">Looking up transaction...</p>
			)}

			{lookupDigest && !isLoading && !status && (
				<p className="text-yellow-400 text-sm">
					No {txType} event found for this digest. Try the other transaction type.
				</p>
			)}

			{status && txType === 'deposit' && depositStatus && (
				<div className="bg-gray-900 p-4 rounded-lg space-y-2">
					<h3 className="font-medium">Deposit Details</h3>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Request ID:</span>
						<ExplorerLink value={depositStatus.requestId} type="sui-object" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">BTC Txid:</span>
						<ExplorerLink value={depositStatus.btcTxid} type="btc-tx" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Amount:</span>
						<span>{depositStatus.amount} BTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Status:</span>
						<StatusBadge status={depositStatus.status} />
					</div>
				</div>
			)}

			{status && txType === 'withdrawal' && withdrawalStatus && (
				<div className="bg-gray-900 p-4 rounded-lg space-y-2">
					<h3 className="font-medium">Withdrawal Details</h3>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Request ID:</span>
						<ExplorerLink value={withdrawalStatus.requestId} type="sui-object" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Amount:</span>
						<span>{withdrawalStatus.btcAmount} hBTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">To:</span>
						<ExplorerLink value={withdrawalStatus.bitcoinAddress} type="btc-address" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Status:</span>
						<StatusBadge status={withdrawalStatus.status} />
					</div>
				</div>
			)}
		</div>
	);
}
