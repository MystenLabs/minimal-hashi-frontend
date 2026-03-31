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
import * as utxo from "./utxo.js";
const $moduleName =
  "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08::deposit_queue";
export const DepositRequestQueue = new MoveStruct({
  name: `${$moduleName}::DepositRequestQueue`,
  fields: {
    requests: bag.Bag,
  },
});
export const DepositRequest = new MoveStruct({
  name: `${$moduleName}::DepositRequest`,
  fields: {
    id: bcs.Address,
    utxo: utxo.Utxo,
    timestamp_ms: bcs.u64(),
    requester_address: bcs.Address,
    sui_tx_digest: bcs.vector(bcs.u8()),
  },
});
export interface DepositRequestOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>];
}
export function depositRequest(options: DepositRequestOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null, "0x2::clock::Clock"] satisfies (
    | string
    | null
  )[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "deposit_queue",
      function: "deposit_request",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
