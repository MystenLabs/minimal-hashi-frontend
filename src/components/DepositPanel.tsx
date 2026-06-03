import { useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, MEMPOOL_BASE_URL, POLL_DEPOSIT_STATUS, formatBtc, formatTimestampMs } from '../lib/constants';
import { getDepositStatusesByDigest } from '../lib/deposit-statuses';
import { hashi } from '../lib/hashi';
import { ExplorerLink } from './ExplorerLink';
import { StatusBadge } from './StatusBadge';

// ============================================================================
// Deposit Address Display
// ============================================================================

export function DepositAddressDisplay() {
	const account = useCurrentAccount();

	const { data: depositAddress, isLoading } = useQuery({
		queryKey: ['deposit-address', account?.address],
		queryFn: () => hashi.generateDepositAddress({ suiAddress: account!.address }),
		enabled: !!account?.address && !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 5 * 60 * 1000,
	});

	if (isLoading) return <p className="mb-6 text-gray-500">Deriving deposit address...</p>;
	if (!depositAddress) return null;

	return (
		<div className="mb-6 p-4 bg-gray-900 rounded-lg space-y-2">
			<label className="text-xs text-gray-500">Your BTC deposit address:</label>
			<code className="block text-sm break-all text-blue-400">{depositAddress}</code>
			<div className="flex gap-3">
				<button
					onClick={() => navigator.clipboard.writeText(depositAddress)}
					className="text-xs text-gray-400 hover:text-white"
				>
					Copy to clipboard
				</button>
				<a
					href={`${MEMPOOL_BASE_URL}/address/${depositAddress}`}
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
	const dAppKit = useDAppKit();

	const { data: depositAddress } = useQuery({
		queryKey: ['deposit-address', account?.address],
		queryFn: () => hashi.generateDepositAddress({ suiAddress: account!.address }),
		enabled: !!account?.address && !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 5 * 60 * 1000,
	});

	const [step, setStep] = useState<'address' | 'submit' | 'status'>('address');
	const [txid, setTxid] = useState('');
	const [resultDigest, setResultDigest] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const txidHex = txid.trim().replace(/^0x/i, '').toLowerCase();
	const suiTxid = `0x${txidHex}`;
	const isValidTxid = /^[0-9a-f]{64}$/i.test(txidHex);

	const { data: btcTx, error: btcTxError, isLoading: btcTxLoading } = useQuery({
		queryKey: ['btc-tx', account?.address, depositAddress, txidHex],
		queryFn: async () => {
			const utxos = await hashi.bitcoin.lookupAllVouts(txidHex, depositAddress!);
			if (utxos.length === 0) {
				throw new Error(`No output found matching your deposit address ${depositAddress}`);
			}
			const usedUtxos = (await hashi.view.findUsedUtxos(
				utxos.map(({ vout }) => ({ txid: suiTxid, vout })),
			)).filter(({ isUsed }) => isUsed).map(({ utxoId }) => utxoId);
			const usedKeys = new Set(
				usedUtxos.map(({ txid, vout }) => `${txid.toLowerCase()}:${vout}`),
			);
			const availableUtxos = utxos.filter(
				({ vout }) => !usedKeys.has(`${suiTxid.toLowerCase()}:${vout}`),
			);
			if (availableUtxos.length === 0) {
				throw new Error('All matching outputs in this Bitcoin transaction have already been used in Hashi.');
			}

			const totalAmountSats = availableUtxos.reduce((sum, utxo) => sum + utxo.amountSats, 0n);
			return {
				utxos: availableUtxos,
				usedUtxos,
				totalAmountSats,
				totalAmountBtc: formatBtc(totalAmountSats),
			};
		},
		enabled: isValidTxid && !!depositAddress && !!CONFIG.BTC_RPC_URL,
		retry: false,
	});

	const { data: submittedDeposits } = useQuery({
		queryKey: ['submitted-deposits', resultDigest],
		queryFn: () => getDepositStatusesByDigest(resultDigest),
		enabled: !!resultDigest && !!CONFIG.HASHI_PACKAGE_ID,
		refetchInterval: (query) => {
			const deposits = query.state.data ?? [];
			if (deposits.length > 0 && deposits.every((deposit) => deposit.status === 'confirmed' || deposit.status === 'expired')) {
				return false;
			}
			return POLL_DEPOSIT_STATUS;
		},
	});
	const hasPendingSubmittedDeposit = submittedDeposits?.some(
		(deposit) => deposit.status === 'pending' || deposit.status === 'unknown',
	);

	const handleSubmit = async () => {
		if (!account || !btcTx) return;
		setError('');
		setSubmitting(true);
		try {
			const transaction = hashi.tx.deposit({
				txid: suiTxid,
				utxos: btcTx.utxos,
				recipient: account.address,
			});
			const result = await dAppKit.signAndExecuteTransaction({ transaction });
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
						Enter the Bitcoin transaction ID. All matching outputs to your deposit address are detected automatically.
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
								<span className="text-gray-400">Matched outputs:</span>
								<span>{btcTx.utxos.length}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-gray-400">Total deposit amount:</span>
								<span>{btcTx.totalAmountBtc} BTC</span>
							</div>
							{btcTx.utxos.map((utxo) => (
								<div key={utxo.vout} className="flex justify-between text-xs text-gray-400">
									<span>vout {utxo.vout}</span>
									<span>{formatBtc(utxo.amountSats)} BTC</span>
								</div>
							))}
							{btcTx.usedUtxos.length > 0 && (
								<p className="text-xs text-yellow-400">
									Skipped already-used outputs: {btcTx.usedUtxos.map((utxo) => utxo.vout).join(', ')}
								</p>
							)}
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
							{submittedDeposits && submittedDeposits.length > 0 ? (
								<>
									<div className="flex justify-between text-sm">
										<span className="text-gray-400">Deposit requests:</span>
										<span>{submittedDeposits.length}</span>
									</div>
									{submittedDeposits.map((deposit) => (
										<div key={deposit.requestId} className="border-t border-gray-800 pt-2 space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-gray-400">BTC Txid:</span>
												<ExplorerLink value={deposit.btcTxid ?? txidHex} type="btc-tx" />
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-gray-400">Amount:</span>
												<span>{formatBtc(deposit.amountSats)} BTC</span>
											</div>
											{deposit.btcVout !== undefined && (
												<div className="flex justify-between text-sm">
													<span className="text-gray-400">Output index:</span>
													<span>{deposit.btcVout}</span>
												</div>
											)}
											<div className="flex justify-between text-sm">
												<span className="text-gray-400">Status:</span>
												<StatusBadge status={deposit.status} />
											</div>
											{deposit.status === 'pending' && formatTimestampMs(deposit.confirmableAtMs) && (
												<div className="flex justify-between text-sm">
													<span className="text-gray-400">Confirmable after:</span>
													<span>{formatTimestampMs(deposit.confirmableAtMs)}</span>
												</div>
											)}
										</div>
									))}
									{hasPendingSubmittedDeposit && (
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
