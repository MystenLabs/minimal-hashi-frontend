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
import * as bag from "./deps/0x0000000000000000000000000000000000000000000000000000000000000002/bag.js";
import * as bag_1 from "./deps/0x0000000000000000000000000000000000000000000000000000000000000002/bag.js";
import * as balance from "./deps/0x0000000000000000000000000000000000000000000000000000000000000002/balance.js";
import * as utxo from "./utxo.js";
import * as utxo_1 from "./utxo.js";
import * as utxo_2 from "./utxo.js";
const $moduleName =
  "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08::withdrawal_queue";
export const OutputUtxo = new MoveStruct({
  name: `${$moduleName}::OutputUtxo`,
  fields: {
    amount: bcs.u64(),
    bitcoin_address: bcs.vector(bcs.u8()),
  },
});
export const WithdrawalRequestQueue = new MoveStruct({
  name: `${$moduleName}::WithdrawalRequestQueue`,
  fields: {
    requests: bag.Bag,
    pending_withdrawals: bag_1.Bag,
    num_consumed_presigs: bcs.u64(),
  },
});
export const WithdrawalRequestInfo = new MoveStruct({
  name: `${$moduleName}::WithdrawalRequestInfo`,
  fields: {
    id: bcs.Address,
    btc_amount: bcs.u64(),
    bitcoin_address: bcs.vector(bcs.u8()),
    timestamp_ms: bcs.u64(),
    requester_address: bcs.Address,
    sui_tx_digest: bcs.vector(bcs.u8()),
  },
});
export const WithdrawalRequest = new MoveStruct({
  name: `${$moduleName}::WithdrawalRequest`,
  fields: {
    info: WithdrawalRequestInfo,
    btc: balance.Balance,
    approved: bcs.bool(),
  },
});
export const PendingWithdrawal = new MoveStruct({
  name: `${$moduleName}::PendingWithdrawal`,
  fields: {
    id: bcs.Address,
    txid: bcs.Address,
    requests: bcs.vector(WithdrawalRequestInfo),
    inputs: bcs.vector(utxo.Utxo),
    withdrawal_outputs: bcs.vector(OutputUtxo),
    change_output: bcs.option(OutputUtxo),
    timestamp_ms: bcs.u64(),
    randomness: bcs.vector(bcs.u8()),
    signatures: bcs.option(bcs.vector(bcs.vector(bcs.u8()))),
    presig_start_index: bcs.u64(),
    epoch: bcs.u64(),
  },
});
export const WithdrawalRequestedEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalRequestedEvent`,
  fields: {
    request_id: bcs.Address,
    btc_amount: bcs.u64(),
    bitcoin_address: bcs.vector(bcs.u8()),
    timestamp_ms: bcs.u64(),
    requester_address: bcs.Address,
    sui_tx_digest: bcs.vector(bcs.u8()),
  },
});
export const WithdrawalApprovedEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalApprovedEvent`,
  fields: {
    request_id: bcs.Address,
  },
});
export const WithdrawalPickedForProcessingEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalPickedForProcessingEvent`,
  fields: {
    pending_id: bcs.Address,
    txid: bcs.Address,
    request_ids: bcs.vector(bcs.Address),
    inputs: bcs.vector(utxo_1.UtxoInfo),
    withdrawal_outputs: bcs.vector(OutputUtxo),
    change_output: bcs.option(OutputUtxo),
    timestamp_ms: bcs.u64(),
    randomness: bcs.vector(bcs.u8()),
  },
});
export const WithdrawalSignedEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalSignedEvent`,
  fields: {
    withdrawal_id: bcs.Address,
    request_ids: bcs.vector(bcs.Address),
    signatures: bcs.vector(bcs.vector(bcs.u8())),
  },
});
export const WithdrawalConfirmedEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalConfirmedEvent`,
  fields: {
    pending_id: bcs.Address,
    txid: bcs.Address,
    change_utxo_id: bcs.option(utxo_2.UtxoId),
    request_ids: bcs.vector(bcs.Address),
    change_utxo_amount: bcs.option(bcs.u64()),
  },
});
export const WithdrawalCancelledEvent = new MoveStruct({
  name: `${$moduleName}::WithdrawalCancelledEvent`,
  fields: {
    request_id: bcs.Address,
    requester_address: bcs.Address,
    btc_amount: bcs.u64(),
  },
});
export interface OutputUtxoOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<number | bigint>,
    RawTransactionArgument<number[]>,
  ];
}
export function outputUtxo(options: OutputUtxoOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = ["u64", "vector<u8>"] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "withdrawal_queue",
      function: "output_utxo",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
