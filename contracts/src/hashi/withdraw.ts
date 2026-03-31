/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import {
  MoveStruct,
  normalizeMoveArguments,
  type RawTransactionArgument,
} from "../utils/index.js";
import { bcs } from "@mysten/sui/bcs";
import { type Transaction } from "@mysten/sui/transactions";
import * as utxo from "./utxo.js";
import * as withdrawal_queue from "./withdrawal_queue.js";
const $moduleName =
  "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08::withdraw";
export const RequestApprovalMessage = new MoveStruct({
  name: `${$moduleName}::RequestApprovalMessage`,
  fields: {
    request_id: bcs.Address,
  },
});
export const WithdrawalCommitmentMessage = new MoveStruct({
  name: `${$moduleName}::WithdrawalCommitmentMessage`,
  fields: {
    request_ids: bcs.vector(bcs.Address),
    selected_utxos: bcs.vector(utxo.UtxoId),
    outputs: bcs.vector(withdrawal_queue.OutputUtxo),
    txid: bcs.Address,
  },
});
export const WithdrawalSignedMessage = new MoveStruct({
  name: `${$moduleName}::WithdrawalSignedMessage`,
  fields: {
    withdrawal_id: bcs.Address,
    request_ids: bcs.vector(bcs.Address),
    signatures: bcs.vector(bcs.vector(bcs.u8())),
  },
});
export const WithdrawalConfirmationMessage = new MoveStruct({
  name: `${$moduleName}::WithdrawalConfirmationMessage`,
  fields: {
    withdrawal_id: bcs.Address,
  },
});
export interface RequestWithdrawalOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
    RawTransactionArgument<number[]>,
  ];
}
export function requestWithdrawal(options: RequestWithdrawalOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [
    null,
    "0x2::clock::Clock",
    null,
    "vector<u8>",
  ] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "request_withdrawal",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface ApproveRequestOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
  ];
}
export function approveRequest(options: ApproveRequestOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, "address", null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "approve_request",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface CommitWithdrawalTxOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<string[]>,
    RawTransactionArgument<string[]>,
    RawTransactionArgument<string[]>,
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
  ];
}
export function commitWithdrawalTx(options: CommitWithdrawalTxOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [
    null,
    "vector<address>",
    "vector<null>",
    "vector<null>",
    "address",
    null,
    "0x2::clock::Clock",
    "0x2::random::Random",
  ] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "commit_withdrawal_tx",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface AllocatePresigsForPendingWithdrawalOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>, RawTransactionArgument<string>];
}
export function allocatePresigsForPendingWithdrawal(
  options: AllocatePresigsForPendingWithdrawalOptions,
) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, "address"] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "allocate_presigs_for_pending_withdrawal",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface SignWithdrawalOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
    RawTransactionArgument<string[]>,
    RawTransactionArgument<number[][]>,
    RawTransactionArgument<string>,
  ];
}
export function signWithdrawal(options: SignWithdrawalOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [
    null,
    "address",
    "vector<address>",
    "vector<vector<u8>>",
    null,
  ] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "sign_withdrawal",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface ConfirmWithdrawalOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
    RawTransactionArgument<string>,
  ];
}
export function confirmWithdrawal(options: ConfirmWithdrawalOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, "address", null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "confirm_withdrawal",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface CancelWithdrawalOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>, RawTransactionArgument<string>];
}
export function cancelWithdrawal(options: CancelWithdrawalOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, "address", "0x2::clock::Clock"] satisfies (
    | string
    | null
  )[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "cancel_withdrawal",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface DeleteExpiredSpentUtxoOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>, RawTransactionArgument<string>];
}
export function deleteExpiredSpentUtxo(options: DeleteExpiredSpentUtxoOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdraw",
      function: "delete_expired_spent_utxo",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
