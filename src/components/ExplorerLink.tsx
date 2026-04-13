import { useState, useCallback } from 'react';
import { MEMPOOL_BASE_URL, SUISCAN_BASE_URL } from '../lib/constants';

export function ExplorerLink({ value, type, truncate = true }: {
	value: string;
	type: 'sui-tx' | 'sui-object' | 'btc-tx' | 'btc-address';
	truncate?: boolean;
}) {
	const [copied, setCopied] = useState(false);

	const href = {
		'sui-tx': `${SUISCAN_BASE_URL}/tx/${value}`,
		'sui-object': `${SUISCAN_BASE_URL}/object/${value}`,
		'btc-tx': `${MEMPOOL_BASE_URL}/tx/${value}`,
		'btc-address': `${MEMPOOL_BASE_URL}/address/${value}`,
	}[type];

	const display = truncate ? `${value.slice(0, 16)}...` : value;

	const handleCopy = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}, [value]);

	return (
		<span className="inline-flex items-center gap-1.5">
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				className="text-xs text-blue-400 hover:text-blue-300 font-mono break-all"
				title={value}
			>
				{display}
			</a>
			<button
				onClick={handleCopy}
				className="text-gray-500 hover:text-white shrink-0"
				title="Copy to clipboard"
			>
				{copied ? (
					<svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
				) : (
					<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
				)}
			</button>
		</span>
	);
}
