import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, POLL_DEPOSIT_STATUS, POLL_WITHDRAWAL_STATUS, formatBtc } from '../lib/constants';
import { getDepositStatusesByDigest } from '../lib/deposit-statuses';
import { formatBitcoinAddress, hashi } from '../lib/hashi';
import { ExplorerLink } from './ExplorerLink';
import { StatusBadge } from './StatusBadge';

export function LookupPanel() {
	const [digest, setDigest] = useState('');
	const [lookupDigest, setLookupDigest] = useState('');
	const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');

	const { data: depositStatuses, isLoading: depositLoading } = useQuery({
		queryKey: ['deposit-statuses', lookupDigest],
		queryFn: () => getDepositStatusesByDigest(lookupDigest),
		enabled: txType === 'deposit' && !!lookupDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const deposits = query.state.data ?? [];
			if (deposits.length > 0 && deposits.every((deposit) => deposit.status === 'confirmed' || deposit.status === 'expired')) {
				return false;
			}
			return POLL_DEPOSIT_STATUS;
		},
	});

	const { data: withdrawalStatus, isLoading: withdrawalLoading } = useQuery({
		queryKey: ['withdrawal-status', lookupDigest],
		queryFn: () => hashi.view.withdrawalStatus(lookupDigest),
		enabled: txType === 'withdrawal' && !!lookupDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			if (s === 'Confirmed' || s === 'cancelled') return false;
			return POLL_WITHDRAWAL_STATUS;
		},
	});

	const isLoading = depositLoading || withdrawalLoading;
	const hasDepositStatus = (depositStatuses?.length ?? 0) > 0;
	const status = txType === 'deposit' ? hasDepositStatus : withdrawalStatus;

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

			{txType === 'deposit' && depositStatuses && depositStatuses.length > 0 && (
				<div className="bg-gray-900 p-4 rounded-lg space-y-2">
					<h3 className="font-medium">Deposit Details</h3>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Deposit requests:</span>
						<span>{depositStatuses.length}</span>
					</div>
					{depositStatuses.map((depositStatus) => (
						<div key={depositStatus.requestId} className="border-t border-gray-800 pt-2 space-y-2">
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
								<span>{formatBtc(depositStatus.amountSats)} BTC</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Output index:</span>
								<span>{depositStatus.btcVout}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Status:</span>
								<StatusBadge status={depositStatus.status} />
							</div>
						</div>
					))}
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
						<span>{formatBtc(withdrawalStatus.btcAmountSats)} hBTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">To:</span>
						<ExplorerLink value={formatBitcoinAddress(withdrawalStatus.bitcoinAddress)} type="btc-address" />
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
