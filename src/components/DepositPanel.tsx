import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';

import { mempoolBaseUrl } from '../lib/constants';
import { useDepositAddress, useBtcTransaction, useCreateDeposit, useDepositStatus } from '../hooks/useDeposit';
import { ExplorerLink } from './ExplorerLink';
import { StatusBadge } from './StatusBadge';

// ============================================================================
// Deposit Address Display
// ============================================================================

export function DepositAddressDisplay() {
	const account = useCurrentAccount();
	const { data: addressData, isLoading } = useDepositAddress(account?.address);

	if (isLoading) return <p className="mb-6 text-gray-500">Deriving deposit address...</p>;
	if (!addressData) return null;

	return (
		<div className="mb-6 p-4 bg-gray-900 rounded-lg space-y-2">
			<label className="text-xs text-gray-500">Your BTC deposit address:</label>
			<code className="block text-sm break-all text-blue-400">{addressData.address}</code>
			<div className="flex gap-3">
				<button
					onClick={() => navigator.clipboard.writeText(addressData.address)}
					className="text-xs text-gray-400 hover:text-white"
				>
					Copy to clipboard
				</button>
				<a
					href={`${mempoolBaseUrl()}/address/${addressData.address}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-blue-400 hover:text-blue-300"
				>
					View on mempool.space
				</a>
			</div>
		</div>
	);
}

// ============================================================================
// Deposit Panel
// ============================================================================

export function DepositPanel() {
	const account = useCurrentAccount();
	const { data: addressData } = useDepositAddress(account?.address);
	const createDeposit = useCreateDeposit();

	const [step, setStep] = useState<'address' | 'submit' | 'status'>('address');
	const [txid, setTxid] = useState('');
	const [resultDigest, setResultDigest] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const { data: btcTx, error: btcTxError, isLoading: btcTxLoading } = useBtcTransaction(
		txid.trim().length === 64 ? txid.trim() : undefined,
		addressData?.address,
	);

	const { data: status } = useDepositStatus(resultDigest || undefined);

	const handleSubmit = async () => {
		if (!account || !btcTx) return;
		setError('');
		setSubmitting(true);
		try {
			const result = await createDeposit(
				txid.trim(),
				btcTx.vout,
				btcTx.amountSats,
				account.address,
			);
			setResultDigest(result.Transaction!.digest);
			setStep('status');
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Transaction failed');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Step 1: Instructions */}
			{step === 'address' && (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Step 1: Send BTC to Your Deposit Address</h2>
					<p className="text-sm text-gray-400">
						The address above is uniquely derived from your Sui wallet and the Hashi MPC committee key.
						Send BTC to it to begin a deposit.
						Need testnet BTC? <a href="https://signetfaucet.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Get some from the faucet</a>.
					</p>

					<button
						onClick={() => setStep('submit')}
						className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
					>
						I've sent BTC — Enter transaction details
					</button>
				</div>
			)}

			{/* Step 2: Enter Bitcoin txid — vout and amount are auto-detected */}
			{step === 'submit' && (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Step 2: Submit Deposit Request</h2>
					<p className="text-sm text-gray-400">
						Enter the Bitcoin transaction ID. The output and amount are detected automatically.
					</p>

					<div>
						<label className="block text-xs text-gray-500 mb-1">Bitcoin Transaction ID</label>
						<input
							type="text"
							value={txid}
							onChange={(e) => setTxid(e.target.value)}
							placeholder="64-character hex txid"
							className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					{btcTxLoading && (
						<p className="text-gray-500 text-sm">Looking up transaction...</p>
					)}

					{btcTx && (
						<div className="bg-gray-900 p-4 rounded-lg space-y-2">
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Output index (vout):</span>
								<span>{btcTx.vout}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Amount:</span>
								<span>{btcTx.amountBtc} BTC</span>
							</div>
						</div>
					)}

					{btcTxError && (
						<p className="text-red-400 text-sm">{btcTxError instanceof Error ? btcTxError.message : 'Failed to look up transaction'}</p>
					)}

					{error && <p className="text-red-400 text-sm">{error}</p>}

					<div className="flex gap-3">
						<button
							onClick={() => setStep('address')}
							className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
						>
							Back
						</button>
						<button
							onClick={handleSubmit}
							disabled={submitting || !btcTx}
							className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
						>
							{submitting ? 'Signing...' : 'Submit Deposit'}
						</button>
					</div>
				</div>
			)}

			{/* Step 3: Deposit status */}
			{step === 'status' && (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Step 3: Deposit Status</h2>
					<div className="bg-gray-900 p-4 rounded-lg space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-gray-400">Sui TX Digest:</span>
							<ExplorerLink value={resultDigest} type="sui-tx" />
						</div>
						{status ? (
							<>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">BTC Txid:</span>
									<ExplorerLink value={status.btcTxid} type="btc-tx" />
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Amount:</span>
									<span>{status.amount} BTC</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">Status:</span>
									<StatusBadge status={status.status} />
								</div>
								{status.status === 'pending' && (
									<p className="text-xs text-gray-500 mt-2">
										Waiting for 6 Bitcoin confirmations + committee verification. Polling every 15s...
									</p>
								)}
							</>
						) : (
							<p className="text-gray-500 text-sm">Loading status...</p>
						)}
					</div>
					<button
						onClick={() => { setStep('address'); setResultDigest(''); setTxid(''); }}
						className="w-full py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
					>
						New Deposit
					</button>
				</div>
			)}
		</div>
	);
}
