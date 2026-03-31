import { useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';

import { CONFIG, POLL_BALANCE } from '../lib/constants';

export function useHbtcBalance() {
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
		refetchInterval: POLL_BALANCE,
	});
}
