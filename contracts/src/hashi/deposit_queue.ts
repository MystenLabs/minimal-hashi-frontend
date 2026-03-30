/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as bag from './deps/0x0000000000000000000000000000000000000000000000000000000000000002/bag.js';
import * as utxo from './utxo.js';
const $moduleName = '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7::deposit_queue';
export const DepositRequestQueue = new MoveStruct({ name: `${$moduleName}::DepositRequestQueue`, fields: {
        requests: bag.Bag
    } });
export const DepositRequest = new MoveStruct({ name: `${$moduleName}::DepositRequest`, fields: {
        id: bcs.Address,
        utxo: utxo.Utxo,
        timestamp_ms: bcs.u64(),
        requester_address: bcs.Address,
        sui_tx_digest: bcs.vector(bcs.u8())
    } });
export interface DepositRequestOptions {
    package?: string;
    arguments: [
        RawTransactionArgument<string>
    ];
}
export function depositRequest(options: DepositRequestOptions) {
    const packageAddress = options.package ?? '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'deposit_queue',
        function: 'deposit_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}