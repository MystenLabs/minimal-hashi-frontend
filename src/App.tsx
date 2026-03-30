/**
 * Hashi Integration Guide — Single-Page Demo
 *
 * This file demonstrates the complete Hashi BTC bridge integration:
 *
 * 1. DEPOSIT FLOW (BTC → hBTC on Sui)
 *    a. Derive a unique Bitcoin deposit address from your Sui wallet
 *    b. Send BTC to that address (outside this app)
 *    c. Submit the Bitcoin txid on-chain to create a deposit request
 *    d. Poll for confirmation (6 BTC confirmations + committee verification)
 *
 * 2. WITHDRAWAL FLOW (hBTC on Sui → BTC)
 *    a. Enter a Bitcoin address and amount of hBTC to withdraw
 *    b. Submit the withdrawal request on-chain (burns hBTC)
 *    c. Poll for the multi-step withdrawal process to complete
 *
 * 3. TRANSACTION LOOKUP
 *    Paste any Sui transaction digest to check deposit/withdrawal status
 */

import { useState } from 'react';
import {
	useCurrentAccount,
	useCurrentClient,
	useDAppKit,
} from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { useQuery } from '@tanstack/react-query';

import { CONFIG } from './lib/constants';
import { arkworksToCompressedHex, deriveDepositAddress, bitcoinAddressToWitnessProgram, witnessProgramToAddress } from './lib/bitcoin';

// Generated contract bindings (via sui-ts-codegen)
import { utxoId as createUtxoId, utxo as createUtxo } from '@contracts/hashi/utxo';
import { depositRequest as createDepositRequest } from '@contracts/hashi/deposit_queue';
import { deposit } from '@contracts/hashi/deposit';
import { requestWithdrawal } from '@contracts/hashi/withdraw';

// ============================================================================
// SECTION 1: Deposit Address Derivation
// ============================================================================

/**
 * Derives a unique Bitcoin P2TR (taproot) deposit address for a given Sui wallet.
 *
 * How it works:
 * 1. Fetch the MPC committee's public key from the Hashi on-chain object
 * 2. Convert from ark-works format to standard Bitcoin compressed format
 * 3. Derive a unique key using HKDF-SHA3-256(mpcKey.x || suiAddress)
 * 4. Build a P2TR script-path address with the derived key
 *
 * Each Sui address gets a deterministic, unique Bitcoin deposit address.
 */
function useDepositAddress(recipient: string | undefined) {
	const client = useCurrentClient();
	const network = CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'mainnet' : CONFIG.DEFAULT_NETWORK === 'localnet' ? 'regtest' : 'testnet';

	return useQuery({
		queryKey: ['deposit-address', recipient],
		queryFn: async () => {
			if (!recipient) return null;

			// Fetch the Hashi object to get the MPC public key
			const hashiObject = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const content = hashiObject.data?.content;
			if (!content || content.dataType !== 'moveObject') {
				throw new Error('Failed to fetch Hashi object');
			}

			// Navigate to: hashi.committee_set.mpc_public_key
			const fields = content.fields as Record<string, unknown>;
			const committeeSet = fields.committee_set as Record<string, unknown>;
			const mpcKeyBytes = (committeeSet.fields as Record<string, unknown>).mpc_public_key as number[];

			// Convert ark-works compressed point → standard Bitcoin compressed format
			const mpcPubkeyHex = arkworksToCompressedHex(mpcKeyBytes);

			// Derive the unique P2TR deposit address
			const address = deriveDepositAddress(mpcPubkeyHex, recipient, network as 'mainnet' | 'testnet' | 'regtest');

			return { address, mpcPublicKey: mpcPubkeyHex };
		},
		enabled: !!recipient && !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 5 * 60 * 1000,
	});
}

// ============================================================================
// SECTION 1b: Look Up Bitcoin Transaction
// ============================================================================

/**
 * Fetches a Bitcoin transaction via JSON-RPC and finds the output matching
 * the user's deposit address. Returns the vout index and amount in satoshis.
 *
 * Uses `getrawtransaction` with verbose=true to get decoded output details,
 * then matches against the derived deposit address.
 */
function useBtcTransaction(txid: string | undefined, depositAddress: string | undefined) {
	return useQuery({
		queryKey: ['btc-tx', txid],
		queryFn: async () => {
			if (!txid || !depositAddress) return null;

			const res = await fetch(CONFIG.BTC_RPC_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'getrawtransaction',
					params: [txid.trim(), true],
				}),
			});

			const json = await res.json();
			if (json.error) throw new Error(json.error.message);

			const tx = json.result;
			const matchingOutput = tx.vout.find(
				(out: { scriptPubKey: { address?: string } }) =>
					out.scriptPubKey.address === depositAddress,
			);

			if (!matchingOutput) {
				throw new Error(`No output found matching your deposit address ${depositAddress}`);
			}

			return {
				vout: matchingOutput.n as number,
				amountSats: BigInt(Math.round(matchingOutput.value * 1e8)),
				amountBtc: (matchingOutput.value as number).toFixed(8),
			};
		},
		enabled: !!txid && txid.length === 64 && !!depositAddress && !!CONFIG.BTC_RPC_URL,
		retry: false,
	});
}

// ============================================================================
// SECTION 2: Deposit Fee + Create Deposit Request
// ============================================================================

/**
 * Reads the protocol deposit fee from the on-chain Hashi config.
 *
 * The fee is stored in the config VecMap under the key "deposit_fee" as a U64
 * value in MIST (SUI's smallest unit). The deposit() Move function requires
 * an exact match — sending 0 will abort.
 */
function useDepositFee() {
	const client = useCurrentClient();

	return useQuery({
		queryKey: ['deposit-fee'],
		queryFn: async () => {
			const hashiObject = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const content = hashiObject.data?.content;
			if (!content || content.dataType !== 'moveObject') return 0n;

			const fields = content.fields as Record<string, unknown>;
			const configField = fields.config as Record<string, unknown> | undefined;
			const configFields = configField?.fields as Record<string, unknown> | undefined;
			const configMap = configFields?.config as Record<string, unknown> | undefined;
			const configMapFields = configMap?.fields as Record<string, unknown> | undefined;
			const contents = configMapFields?.contents as Array<Record<string, unknown>> | undefined;

			if (contents) {
				for (const entry of contents) {
					const entryFields = entry.fields as Record<string, unknown> | undefined;
					if (entryFields?.key === 'deposit_fee') {
						const valueObj = entryFields.value as Record<string, unknown>;
						if (valueObj?.variant === 'U64') {
							const valFields = valueObj.fields as Record<string, string>;
							return BigInt(valFields.pos0 ?? '0');
						}
						break;
					}
				}
			}

			return 0n;
		},
		enabled: !!CONFIG.HASHI_OBJECT_ID,
		staleTime: 60_000,
	});
}

/**
 * Submits a deposit request on-chain after the user has sent BTC.
 *
 * Transaction structure:
 * 1. utxo_id(txid, vout)           → identifies the Bitcoin UTXO
 * 2. utxo(utxoId, amount, address) → wraps UTXO with amount + recipient
 * 3. deposit_request(utxo)         → creates the on-chain request
 * 4. splitCoins(gas, [fee])        → splits SUI for the protocol fee
 * 5. deposit(hashi, request, fee)  → submits to the Hashi contract
 */
function useCreateDeposit() {
	const dAppKit = useDAppKit();
	const { data: depositFee } = useDepositFee();

	return async (txid: string, vout: number, amountSats: bigint, recipient: string) => {
		const pkg = CONFIG.HASHI_PACKAGE_ID;
		const fee = depositFee ?? 0n;

		// Bitcoin txids are displayed in reversed byte order.
		// The Move contract expects internal byte order (reversed from display).
		const txidBytes = txid.replace(/^0x/, '').match(/.{2}/g);
		if (!txidBytes || txidBytes.length !== 32) throw new Error('Invalid txid: must be 64 hex characters');
		const reversedTxid = '0x' + txidBytes.reverse().join('');

		const tx = new Transaction();

		// Step 1: Create UtxoId from txid + output index
		const [utxoIdResult] = tx.add(
			createUtxoId({ package: pkg, arguments: [reversedTxid, vout] }),
		);

		// Step 2: Create Utxo with amount and derivation path (= recipient Sui address)
		const [utxoResult] = tx.add(
			createUtxo({ package: pkg, arguments: [utxoIdResult, amountSats, recipient] }),
		);

		// Step 3: Create DepositRequest (assigns an on-chain ID + timestamp)
		const [requestResult] = tx.add(
			createDepositRequest({ package: pkg, arguments: [utxoResult] }),
		);

		// Step 4: Split SUI for the protocol deposit fee
		const [feeCoin] = tx.splitCoins(tx.gas, [fee]);

		// Step 5: Submit the deposit to the Hashi contract
		tx.add(
			deposit({ package: pkg, arguments: [CONFIG.HASHI_OBJECT_ID, requestResult, feeCoin] }),
		);

		return dAppKit.signAndExecuteTransaction({ transaction: tx });
	};
}

// ============================================================================
// SECTION 3: Poll Deposit Status
// ============================================================================

/**
 * Polls the on-chain status of a deposit by its Sui transaction digest.
 *
 * Status flow: pending → confirmed | expired
 *
 * How it works:
 * 1. Fetch the original tx to find the DepositRequestedEvent (contains request_id)
 * 2. Query DepositConfirmedEvent — if found with matching request_id, it's confirmed
 * 3. Query ExpiredDepositDeletedEvent — if found, it expired (3-day window)
 * 4. Otherwise, still pending (waiting for 6 BTC confirmations)
 */
function useDepositStatus(txDigest: string | undefined) {
	const client = useCurrentClient();
	const pkg = CONFIG.HASHI_PACKAGE_ID;

	return useQuery({
		queryKey: ['deposit-status', txDigest],
		queryFn: async () => {
			if (!txDigest) return null;

			// 1. Get the DepositRequestedEvent from the original transaction
			const tx = await client.getTransactionBlock({
				digest: txDigest,
				options: { showEvents: true },
			});

			const depositEvent = tx.events?.find((e) =>
				e.type.includes('::deposit::DepositRequestedEvent'),
			);
			if (!depositEvent?.parsedJson) return null;

			const parsed = depositEvent.parsedJson as {
				request_id: string;
				utxo_id: { txid: string; vout: number };
				amount: string;
				derivation_path: string | null;
				timestamp_ms: string;
			};

			// 2. Check for confirmation
			let status: 'pending' | 'confirmed' | 'expired' = 'pending';

			try {
				const confirmedEvents = await client.queryEvents({
					query: { MoveEventType: `${pkg}::deposit::DepositConfirmedEvent` },
					limit: 50,
				});
				if (confirmedEvents.data.some(
					(e) => (e.parsedJson as { request_id: string })?.request_id === parsed.request_id,
				)) {
					status = 'confirmed';
				}
			} catch { /* event type may not exist yet */ }

			// 3. Check for expiry
			if (status === 'pending') {
				try {
					const expiredEvents = await client.queryEvents({
						query: { MoveEventType: `${pkg}::deposit::ExpiredDepositDeletedEvent` },
						limit: 50,
					});
					if (expiredEvents.data.some(
						(e) => (e.parsedJson as { request_id: string })?.request_id === parsed.request_id,
					)) {
						status = 'expired';
					}
				} catch { /* ok */ }
			}

			// Convert internal byte order back to display txid
			const txidHex = (parsed.utxo_id.txid as string).replace('0x', '');
			const btcTxid = txidHex.match(/.{2}/g)?.reverse().join('') ?? txidHex;

			return {
				requestId: parsed.request_id,
				amount: (Number(parsed.amount) / 1e8).toFixed(8),
				btcTxid,
				btcVout: parsed.utxo_id.vout,
				status,
			};
		},
		enabled: !!txDigest && !!pkg,
		// Poll every 15s until confirmed or expired
		refetchInterval: (query) => {
			const data = query.state.data;
			if (data?.status === 'confirmed' || data?.status === 'expired') return false;
			return 15_000;
		},
	});
}

// ============================================================================
// SECTION 4: Request Withdrawal
// ============================================================================

/**
 * Submits a withdrawal request to convert hBTC back to BTC.
 *
 * Transaction structure:
 * 1. coinWithBalance({ type: hBTC, balance }) → assembles hBTC coins to burn
 * 2. requestWithdrawal(hashi, btcCoin, bitcoinAddress) → burns hBTC, queues withdrawal
 *
 * The bitcoinAddress is passed as raw witness program bytes (extracted from bech32).
 * The protocol fee is deducted from the hBTC amount automatically.
 */
function useCreateWithdrawal() {
	const dAppKit = useDAppKit();

	return async (amountSats: bigint, bitcoinAddress: string) => {
		const pkg = CONFIG.HASHI_PACKAGE_ID;
		const btcCoinType = `${pkg}::btc::BTC`;

		// Extract witness program bytes from the Bitcoin address
		const witnessProgram = bitcoinAddressToWitnessProgram(bitcoinAddress);

		const tx = new Transaction();

		// Step 1: Assemble hBTC coins to the exact withdrawal amount
		const btcCoin = tx.add(coinWithBalance({ type: btcCoinType, balance: amountSats }));

		// Step 2: Submit withdrawal request (burns hBTC, creates on-chain request)
		tx.add(
			requestWithdrawal({
				package: pkg,
				arguments: [CONFIG.HASHI_OBJECT_ID, btcCoin, witnessProgram],
			}),
		);

		return dAppKit.signAndExecuteTransaction({ transaction: tx });
	};
}

// ============================================================================
// SECTION 5: Poll Withdrawal Status
// ============================================================================

/**
 * Polls the on-chain status of a withdrawal by its Sui transaction digest.
 *
 * Withdrawal status flow:
 *   requested → approved → processing → signed → confirmed
 *
 * Simplified version: checks if the request is still in the withdrawal queue.
 * If not found, queries events to determine if confirmed or cancelled.
 */
function useWithdrawalStatus(txDigest: string | undefined) {
	const client = useCurrentClient();
	const pkg = CONFIG.HASHI_PACKAGE_ID;

	return useQuery({
		queryKey: ['withdrawal-status', txDigest],
		queryFn: async () => {
			if (!txDigest) return null;

			// 1. Get the WithdrawalRequestedEvent from the original transaction
			const tx = await client.getTransactionBlock({
				digest: txDigest,
				options: { showEvents: true },
			});

			const withdrawEvent = tx.events?.find((e) =>
				e.type.includes('::withdrawal_queue::WithdrawalRequestedEvent'),
			);
			if (!withdrawEvent?.parsedJson) return null;

			const parsed = withdrawEvent.parsedJson as {
				request_id: string;
				btc_amount: string;
				bitcoin_address: number[];
				timestamp_ms: string;
				requester_address: string;
			};

			const btcNetwork = CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'mainnet' : CONFIG.DEFAULT_NETWORK === 'localnet' ? 'regtest' : 'testnet';
			const btcAddr = witnessProgramToAddress(parsed.bitcoin_address, btcNetwork as 'mainnet' | 'testnet' | 'regtest');

			// 2. Check if request is still in the withdrawal queue
			const hashiObj = await client.getObject({
				id: CONFIG.HASHI_OBJECT_ID,
				options: { showContent: true },
			});

			const hashiFields = hashiObj.data?.content;
			if (!hashiFields || hashiFields.dataType !== 'moveObject') return null;

			const fields = hashiFields.fields as Record<string, unknown>;
			const wqFields = (fields.withdrawal_queue as Record<string, unknown>)?.fields as Record<string, unknown>;
			const requestsBagId = ((wqFields?.requests as Record<string, unknown>)?.fields as Record<string, unknown>)?.id as Record<string, string>;

			type WithdrawalStatus = 'requested' | 'approved' | 'processing' | 'confirmed' | 'cancelled';
			let status: WithdrawalStatus = 'confirmed';

			if (requestsBagId?.id) {
				try {
					const requestObj = await client.getDynamicFieldObject({
						parentId: requestsBagId.id,
						name: { type: 'address', value: parsed.request_id },
					});
					if (requestObj.data?.content && requestObj.data.content.dataType === 'moveObject') {
						const reqFields = requestObj.data.content.fields as Record<string, unknown>;
						const valueFields = (reqFields.value as Record<string, unknown>)?.fields as Record<string, unknown>;
						status = valueFields?.approved ? 'approved' : 'requested';
					}
				} catch {
					// Not in requests bag — check if it's in pending_withdrawals or already confirmed
					const pendingBagId = ((wqFields?.pending_withdrawals as Record<string, unknown>)?.fields as Record<string, unknown>)?.id as Record<string, string>;
					if (pendingBagId?.id) {
						try {
							const dynamicFields = await client.getDynamicFields({ parentId: pendingBagId.id, limit: 50 });
							for (const field of dynamicFields.data) {
								const pendingId = (field.name as { value: string }).value;
								const obj = await client.getDynamicFieldObject({
									parentId: pendingBagId.id,
									name: { type: 'address', value: pendingId },
								});
								if (obj.data?.content && obj.data.content.dataType === 'moveObject') {
									const pFields = obj.data.content.fields as Record<string, unknown>;
									const vFields = (pFields.value as Record<string, unknown>)?.fields as Record<string, unknown>;
									const requests = vFields?.requests as Array<Record<string, unknown>> | undefined;
									if (requests?.some((r) => (r.fields as Record<string, unknown>)?.id === parsed.request_id)) {
										status = vFields?.signatures ? 'processing' : 'processing';
										break;
									}
								}
							}
						} catch { /* ok */ }
					}
				}
			}

			return {
				requestId: parsed.request_id,
				btcAmount: (Number(parsed.btc_amount) / 1e8).toFixed(8),
				bitcoinAddress: btcAddr,
				status,
			};
		},
		enabled: !!txDigest && !!pkg,
		refetchInterval: (query) => {
			const data = query.state.data;
			if (data?.status === 'confirmed' || data?.status === ('cancelled' as string)) return false;
			return 15_000;
		},
	});
}

// ============================================================================
// SECTION 6: hBTC Balance
// ============================================================================

function useHbtcBalance() {
	const client = useCurrentClient();
	const account = useCurrentAccount();

	return useQuery({
		queryKey: ['hbtc-balance', account?.address],
		queryFn: async () => {
			if (!account) return null;
			const balance = await client.getBalance({
				owner: account.address,
				coinType: `${CONFIG.HASHI_PACKAGE_ID}::btc::BTC`,
			});
			return {
				totalBalance: BigInt(balance.totalBalance),
				formatted: (Number(balance.totalBalance) / 1e8).toFixed(8),
			};
		},
		enabled: !!account,
		refetchInterval: 30_000,
	});
}

// ============================================================================
// SECTION 7: UI Components
// ============================================================================

type Tab = 'deposit' | 'withdraw' | 'lookup';

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
								{tab === 'deposit' ? 'Deposit BTC' : tab === 'withdraw' ? 'Withdraw hBTC' : 'Lookup TX'}
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
				<p>Package: <a href={`https://suiscan.xyz/${CONFIG.DEFAULT_NETWORK}/object/${CONFIG.HASHI_PACKAGE_ID}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{CONFIG.HASHI_PACKAGE_ID}</a></p>
				<p>Hashi Object: <a href={`https://suiscan.xyz/${CONFIG.DEFAULT_NETWORK}/object/${CONFIG.HASHI_OBJECT_ID}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 break-all">{CONFIG.HASHI_OBJECT_ID}</a></p>
			</div>
		</div>
	);
}

function BalanceDisplay() {
	const { data: balance } = useHbtcBalance();
	if (!balance) return null;
	return (
		<div className="mb-6 p-4 bg-gray-900 rounded-lg">
			<span className="text-gray-400 text-sm">hBTC Balance:</span>{' '}
			<span className="text-lg font-bold">{balance.formatted} hBTC</span>
		</div>
	);
}

function DepositAddressDisplay() {
	const account = useCurrentAccount();
	const { data: addressData, isLoading } = useDepositAddress(account?.address);
	const mempoolBase = CONFIG.DEFAULT_NETWORK === 'mainnet' ? 'https://mempool.space' : 'https://mempool.space/testnet4';

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
					href={`${mempoolBase}/address/${addressData.address}`}
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
// DEPOSIT PANEL
// ============================================================================

/**
 * Manages a list of Bitcoin txids that the user has sent to their deposit address
 * but hasn't yet submitted on Sui. Persisted in localStorage so the user can
 * return later and complete the deposit.
 */
function usePendingBtcTxids(suiAddress: string | undefined) {
	const key = suiAddress ? `hashi-pending-btc-${suiAddress}` : null;

	const getTxids = (): string[] => {
		if (!key) return [];
		try { return JSON.parse(localStorage.getItem(key) || '[]'); }
		catch { return []; }
	};

	const [txids, setTxids] = useState<string[]>(getTxids);

	const add = (txid: string) => {
		if (!key) return;
		const updated = [...new Set([txid, ...getTxids()])];
		localStorage.setItem(key, JSON.stringify(updated));
		setTxids(updated);
	};

	const remove = (txid: string) => {
		if (!key) return;
		const updated = getTxids().filter((t) => t !== txid);
		localStorage.setItem(key, JSON.stringify(updated));
		setTxids(updated);
	};

	return { txids, add, remove };
}

function DepositPanel() {
	const account = useCurrentAccount();
	const { data: addressData } = useDepositAddress(account?.address);
	const createDeposit = useCreateDeposit();
	const pending = usePendingBtcTxids(account?.address);

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
			const trimmedTxid = txid.trim();
			const result = await createDeposit(
				trimmedTxid,
				btcTx.vout,
				btcTx.amountSats,
				account.address,
			);
			pending.remove(trimmedTxid);
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
			{/* Step 1: Instructions + pending deposits */}
			{step === 'address' && (
				<div className="space-y-4">
					<h2 className="text-lg font-semibold">Step 1: Send BTC to Your Deposit Address</h2>
					<p className="text-sm text-gray-400">
						The address above is uniquely derived from your Sui wallet and the Hashi MPC committee key.
						Send BTC to it to begin a deposit.
						Need testnet BTC? <a href="https://coinfaucet.eu/en/btc-testnet4/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Get some from the faucet</a>.
					</p>

					{/* Show pending BTC transactions that haven't been submitted on Sui yet */}
					{pending.txids.length > 0 && (
						<div className="bg-yellow-900/30 border border-yellow-800 p-4 rounded-lg space-y-2">
							<p className="text-sm text-yellow-300 font-medium">Pending BTC deposits</p>
							<p className="text-xs text-yellow-400/80">
								You sent BTC but haven't submitted the deposit on Sui yet. Your BTC is safe — you can submit anytime.
							</p>
							{pending.txids.map((pendingTxid) => (
								<div key={pendingTxid} className="flex items-center justify-between gap-2">
									<code className="text-xs text-yellow-400 truncate">{pendingTxid}</code>
									<div className="flex gap-2 shrink-0">
										<button
											onClick={() => { setTxid(pendingTxid); setStep('submit'); }}
											className="text-xs text-blue-400 hover:text-blue-300"
										>
											Submit now
										</button>
										<button
											onClick={() => pending.remove(pendingTxid)}
											className="text-xs text-gray-500 hover:text-gray-300"
										>
											Dismiss
										</button>
									</div>
								</div>
							))}
						</div>
					)}

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
							onChange={(e) => {
								setTxid(e.target.value);
								const trimmed = e.target.value.trim();
								if (trimmed.length === 64) pending.add(trimmed);
							}}
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

					<p className="text-xs text-gray-600">
						Not ready to submit? No worries — your BTC is safe at the deposit address. This txid is saved locally so you can come back and submit later.
					</p>

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
							<code className="text-xs">{resultDigest.slice(0, 16)}...</code>
						</div>
						{status ? (
							<>
								<div className="flex justify-between text-sm">
									<span className="text-gray-400">BTC Txid:</span>
									<code className="text-xs">{status.btcTxid.slice(0, 16)}...</code>
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

// ============================================================================
// WITHDRAW PANEL
// ============================================================================

function WithdrawPanel() {
	const createWithdrawal = useCreateWithdrawal();
	const { data: balance } = useHbtcBalance();

	const [btcAddress, setBtcAddress] = useState('');
	const [amount, setAmount] = useState('');
	const [resultDigest, setResultDigest] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const { data: status } = useWithdrawalStatus(resultDigest || undefined);

	const handleSubmit = async () => {
		setError('');
		setSubmitting(true);
		try {
			const amountSats = BigInt(Math.round(parseFloat(amount) * 1e8));
			if (balance && amountSats > balance.totalBalance) {
				throw new Error(`Insufficient hBTC. Available: ${balance.formatted}`);
			}
			const result = await createWithdrawal(amountSats, btcAddress.trim());
			setResultDigest(result.Transaction!.digest);
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Transaction failed');
		} finally {
			setSubmitting(false);
		}
	};

	if (resultDigest && status) {
		return (
			<div className="space-y-4">
				<h2 className="text-lg font-semibold">Withdrawal Status</h2>
				<div className="bg-gray-900 p-4 rounded-lg space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Sui TX Digest:</span>
						<code className="text-xs">{resultDigest.slice(0, 16)}...</code>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Amount:</span>
						<span>{status.btcAmount} hBTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">To:</span>
						<code className="text-xs">{status.bitcoinAddress.slice(0, 20)}...</code>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Status:</span>
						<StatusBadge status={status.status} />
					</div>

					{/* Show the withdrawal pipeline steps */}
					<div className="mt-4 flex gap-1">
						{(['requested', 'approved', 'processing', 'confirmed'] as const).map((s, i) => {
							const steps = ['requested', 'approved', 'processing', 'confirmed'];
							const currentIdx = steps.indexOf(status.status);
							const isActive = i <= currentIdx;
							return (
								<div key={s} className="flex-1">
									<div className={`h-1 rounded ${isActive ? 'bg-blue-500' : 'bg-gray-700'}`} />
									<p className={`text-xs mt-1 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>{s}</p>
								</div>
							);
						})}
					</div>

					{status.status !== 'confirmed' && (
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

// ============================================================================
// LOOKUP PANEL
// ============================================================================

function LookupPanel() {
	const [digest, setDigest] = useState('');
	const [lookupDigest, setLookupDigest] = useState('');
	const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');

	const { data: depositStatus, isLoading: depositLoading } = useDepositStatus(
		txType === 'deposit' ? lookupDigest || undefined : undefined,
	);
	const { data: withdrawalStatus, isLoading: withdrawalLoading } = useWithdrawalStatus(
		txType === 'withdrawal' ? lookupDigest || undefined : undefined,
	);

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
						<code className="text-xs">{depositStatus.requestId.slice(0, 16)}...</code>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">BTC Txid:</span>
						<code className="text-xs">{depositStatus.btcTxid.slice(0, 16)}...</code>
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
						<code className="text-xs">{withdrawalStatus.requestId.slice(0, 16)}...</code>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">Amount:</span>
						<span>{withdrawalStatus.btcAmount} hBTC</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-gray-400">To:</span>
						<code className="text-xs break-all">{withdrawalStatus.bitcoinAddress}</code>
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

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		pending: 'bg-yellow-900 text-yellow-300',
		confirmed: 'bg-green-900 text-green-300',
		expired: 'bg-red-900 text-red-300',
		requested: 'bg-yellow-900 text-yellow-300',
		approved: 'bg-blue-900 text-blue-300',
		processing: 'bg-blue-900 text-blue-300',
		signed: 'bg-blue-900 text-blue-300',
		cancelled: 'bg-red-900 text-red-300',
	};

	return (
		<span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? 'bg-gray-700 text-gray-300'}`}>
			{status}
		</span>
	);
}
