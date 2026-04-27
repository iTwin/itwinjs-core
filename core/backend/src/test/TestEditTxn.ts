/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SaveChangesArgs } from "@itwin/core-common";
import { EditTxn } from "../EditTxn";
import type { IModelDb } from "../IModelDb";

export function withEditTxn<T>(iModel: IModelDb, fn: (txn: EditTxn) => T): T;
export function withEditTxn<T>(iModel: IModelDb, saveArgs: string | SaveChangesArgs, fn: (txn: EditTxn) => T): T;
export function withEditTxn<T>(iModel: IModelDb, fn: (txn: EditTxn) => Promise<T>): Promise<T>;
export function withEditTxn<T>(iModel: IModelDb, saveArgs: string | SaveChangesArgs, fn: (txn: EditTxn) => Promise<T>): Promise<T>;
export function withEditTxn<T>(iModel: IModelDb, saveArgsOrFn: string | SaveChangesArgs | ((txn: EditTxn) => T | Promise<T>), maybeFn?: (txn: EditTxn) => T | Promise<T>): T | Promise<T> {
  const saveArgs = "function" === typeof saveArgsOrFn ? undefined : saveArgsOrFn;
  const fn = "function" === typeof saveArgsOrFn ? saveArgsOrFn : maybeFn;

  if (undefined === fn)
    throw new Error("withEditTxn requires a callback");

  const txn = new EditTxn(iModel, "test");
  txn.start();

  try {
    const result = fn(txn);
    if (result instanceof Promise) {
      return result.then((value) => {
        txn.end("save", saveArgs);
        return value;
      }, (err) => {
        if (txn.isActive)
          txn.end("abandon");

        throw err;
      });
    }

    txn.end("save", saveArgs);
    return result;
  } catch (err) {
    if (txn.isActive)
      txn.end("abandon");

    throw err;
  }
}

