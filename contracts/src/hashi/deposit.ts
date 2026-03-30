/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as utxo from './utxo.js';
import * as utxo_1 from './utxo.js';
const $moduleName = '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7::deposit';
export const DepositRequestedEvent = new MoveStruct({ name: `${$moduleName}::DepositRequestedEvent`, fields: {
        request_id: bcs.Address,
        utxo_id: utxo.UtxoId,
        amount: bcs.u64(),
        derivation_path: bcs.option(bcs.Address),
        timestamp_ms: bcs.u64(),
        requester_address: bcs.Address,
        sui_tx_digest: bcs.vector(bcs.u8())
    } });
export const DepositConfirmedEvent = new MoveStruct({ name: `${$moduleName}::DepositConfirmedEvent`, fields: {
        request_id: bcs.Address,
        utxo_id: utxo_1.UtxoId,
        amount: bcs.u64(),
        derivation_path: bcs.option(bcs.Address)
    } });
export const ExpiredDepositDeletedEvent = new MoveStruct({ name: `${$moduleName}::ExpiredDepositDeletedEvent`, fields: {
        request_id: bcs.Address
    } });
export interface DepositOptions {
    package?: string;
    arguments: [
        RawTransactionArgument<string>,
        RawTransactionArgument<string>,
        RawTransactionArgument<string>
    ];
}
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'deposit',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface ConfirmDepositOptions {
    package?: string;
    arguments: [
        RawTransactionArgument<string>,
        RawTransactionArgument<string>,
        RawTransactionArgument<string>
    ];
}
export function confirmDeposit(options: ConfirmDepositOptions) {
    const packageAddress = options.package ?? '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7';
    const argumentsTypes = [
        null,
        'address',
        null
    ] satisfies (string | null)[];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'deposit',
        function: 'confirm_deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface DeleteExpiredDepositOptions {
    package?: string;
    arguments: [
        RawTransactionArgument<string>,
        RawTransactionArgument<string>
    ];
}
export function deleteExpiredDeposit(options: DeleteExpiredDepositOptions) {
    const packageAddress = options.package ?? '0xe87f0c85488c5c442612103a08e5df93d2f190cdb0456b667f5257be506aefc7';
    const argumentsTypes = [
        null,
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'deposit',
        function: 'delete_expired_deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}