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
const $moduleName =
  "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08::utxo";
export const UtxoId = new MoveStruct({
  name: `${$moduleName}::UtxoId`,
  fields: {
    txid: bcs.Address,
    vout: bcs.u32(),
  },
});
export const Utxo = new MoveStruct({
  name: `${$moduleName}::Utxo`,
  fields: {
    id: UtxoId,
    amount: bcs.u64(),
    derivation_path: bcs.option(bcs.Address),
  },
});
export const UtxoInfo = new MoveStruct({
  name: `${$moduleName}::UtxoInfo`,
  fields: {
    id: UtxoId,
    amount: bcs.u64(),
    derivation_path: bcs.option(bcs.Address),
  },
});
export interface UtxoIdOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>, RawTransactionArgument<number>];
}
export function utxoId(options: UtxoIdOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = ["address", "u32"] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "utxo_id",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface UtxoOptions {
  package?: string;
  arguments: [
    RawTransactionArgument<string>,
    RawTransactionArgument<number | bigint>,
    RawTransactionArgument<string | null>,
  ];
}
export function utxo(options: UtxoOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [
    null,
    "u64",
    "0x1::option::Option<address>",
  ] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "utxo",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface IdOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>];
}
export function id(options: IdOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "id",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface AmountOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>];
}
export function amount(options: AmountOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "amount",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface DerivationPathOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>];
}
export function derivationPath(options: DerivationPathOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "derivation_path",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
export interface ToInfoOptions {
  package?: string;
  arguments: [RawTransactionArgument<string>];
}
export function toInfo(options: ToInfoOptions) {
  const packageAddress =
    options.package ??
    "0xeef9dd622a37cbb614f06faa83abfb870eebc50a4c997ba0d2d86171123c0a08";
  const argumentsTypes = [null] satisfies (string | null)[];
  return (tx: Transaction) =>
    tx.moveCall({
      package: packageAddress,
      module: "utxo",
      function: "to_info",
      arguments: normalizeMoveArguments(options.arguments, argumentsTypes),
    });
}
