import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, POLL_BALANCE, POLL_WITHDRAWAL_STATUS, formatBtc } from '../lib/constants';
import { hashi } from '../lib/hashi';
import { ExplorerLink } from './ExplorerLink';
import { StatusBadge } from './StatusBadge';

const WITHDRAWAL_STEPS = ['requested', 'approved', 'processing', 'signed', 'confirmed'] as const;

export function WithdrawPanel() {
	const account = useCurrentAccount();
	const dAppKit = useDAppKit();

	const { data: balance } = useQuery({
		queryKey: ['hbtc-balance', account?.address],
		queryFn: async () => {
			const b = await hashi.getBalance(account!.address);
			return { totalBalance: b.totalBalance, formatted: formatBtc(b.totalBalance) };
		},
		enabled: !!account,
		refetchInterval: POLL_BALANCE,
	});

	const { data: withdrawalFees } = useQuery({
		queryKey: ['withdrawal-fees', account?.address],
		queryFn: () => hashi.getWithdrawalFees(account?.address),
		enabled: !!account,
	});

	const [btcAddress, setBtcAddress] = useState('');
	const [amount, setAmount] = useState('');
	const [resultDigest, setResultDigest] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const { data: status } = useQuery({
		queryKey: ['withdrawal-status', resultDigest],
		queryFn: () => hashi.getWithdrawalStatus(resultDigest),
		enabled: !!resultDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const s = query.state.data?.status;
			if (s === 'confirmed' || s === 'cancelled') return false;
			return POLL_WITHDRAWAL_STATUS;
		},
	});

	const handleSubmit = async () => {
		setError('');
		setSubmitting(true);
		try {
			const amountSats = BigInt(Math.round(parseFloat(amount) * 1e8));
			if (amountSats <= 0n) {
				throw new Error('Enter a valid withdrawal amount.');
			}
			if (balance && amountSats > balance.totalBalance) {
				throw new Error(`Insufficient hBTC. Available: ${balance.formatted}`);
			}
			if (withdrawalFees && amountSats < withdrawalFees.withdrawalMinimumSats) {
				throw new Error(
					`Withdrawal amount must be at least ${formatBtc(withdrawalFees.withdrawalMinimumSats)} hBTC.`,
				);
			}
			const { transaction } = hashi.buildWithdrawalTransaction({
				amountSats,
				bitcoinAddress: btcAddress.trim(),
			});
			const result = await dAppKit.signAndExecuteTransaction({ transaction });
			setResultDigest(result.Transaction!.digest);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Transaction failed');
		} finally {
			setSubmitting(false);
		}
	};

	if (resultDigest && status) {
		const currentIdx = WITHDRAWAL_STEPS.indexOf(status.status as typeof WITHDRAWAL_STEPS[number]);

		return (
			<div className="space-y-4">
				<h2 className="text-lg font-semibold">Withdrawal Status</h2>
				<div className="bg-gray-900 p-4 rounded-lg space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Sui TX Digest:</span>
						<ExplorerLink value={resultDigest} type="sui-tx" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Amount:</span>
						<span>{status.btcAmount} hBTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">To:</span>
						<ExplorerLink value={status.bitcoinAddress} type="btc-address" />
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Status:</span>
						<StatusBadge status={status.status} />
					</div>

					{/* Show the withdrawal pipeline steps */}
					<div className="mt-4 flex gap-1">
						{WITHDRAWAL_STEPS.map((s, i) => {
							const isActive = i <= currentIdx;
							return (
								<div key={s} className="flex-1">
									<div className={`h-1 rounded ${isActive ? 'bg-blue-500' : 'bg-gray-700'}`} />
									<p className={`text-xs mt-1 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>{s}</p>
								</div>
							);
						})}
					</div>

					{status.status !== 'confirmed' && status.status !== 'cancelled' && (
						<p className="text-xs text-gray-500 mt-2">Polling every 15s...</p>
					)}
				</div>
				<button
					onClick={() => { setResultDigest(''); setBtcAddress(''); setAmount(''); }}
					className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
				>
					New Withdrawal
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Withdraw hBTC to Bitcoin</h2>
			<p className="text-sm text-gray-400">
				Burn hBTC on Sui to receive BTC at a Bitcoin address. Supports P2WPKH (bc1q...) and P2TR (bc1p...) addresses.
			</p>

			<div className="space-y-3">
				<div>
					<label className="block text-xs text-gray-500 mb-1">Bitcoin Address</label>
					<input
						type="text"
						value={btcAddress}
						onChange={(e) => setBtcAddress(e.target.value)}
						placeholder="tb1q... or tb1p..."
						className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
					/>
				</div>
				<div>
					<label className="block text-xs text-gray-500 mb-1">Amount (hBTC)</label>
					<input
						type="text"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						placeholder="0.001"
						className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
					/>
					{balance && (
						<p className="text-xs text-gray-500 mt-1">
							Available: {balance.formatted} hBTC
							<button
								onClick={() => setAmount((Number(balance.totalBalance) / 1e8).toString())}
								className="ml-2 text-blue-400 hover:text-blue-300"
							>
								Max
							</button>
						</p>
					)}
					{withdrawalFees && (
						<p className="text-xs text-gray-500 mt-1">
							Minimum: {formatBtc(withdrawalFees.withdrawalMinimumSats)} hBTC. Worst-case BTC network fee:
							{' '}{formatBtc(withdrawalFees.worstCaseNetworkFeeSats)} BTC.
						</p>
					)}
				</div>
			</div>

			{error && <p className="text-red-400 text-sm">{error}</p>}

			<button
				onClick={handleSubmit}
				disabled={submitting || !btcAddress || !amount}
				className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
			>
				{submitting ? 'Signing...' : 'Withdraw hBTC'}
			</button>
		</div>
	);
}
