/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SaveChangesArgs } from "@itwin/core-common";
import { EditTxn } from "../EditTxn";
import type { BriefcaseDb, IModelDb, StandaloneDb } from "../IModelDb";

export class TestEditTxn extends EditTxn {
  public constructor(iModel: IModelDb, description: string = "test") {
    super(iModel, description);
  }
}

/** A {@link TestEditTxn} typed to a {@link BriefcaseDb}, providing access to {@link briefcase} without casting. */
export class BriefcaseTestTxn extends TestEditTxn {
  public readonly briefcase: BriefcaseDb;
  public constructor(briefcase: BriefcaseDb, description?: string) {
    super(briefcase, description ?? "test");
    this.briefcase = briefcase;
  }
}

/** A {@link TestEditTxn} typed to a {@link StandaloneDb}, providing access to {@link db} without casting. */
export class StandaloneTestTxn extends TestEditTxn {
  public readonly db: StandaloneDb;
  public constructor(db: StandaloneDb, description?: string) {
    super(db, description ?? "test");
    this.db = db;
  }
}

export function withTestEditTxn<T>(iModel: IModelDb, fn: (txn: TestEditTxn) => T): T;
export function withTestEditTxn<T>(iModel: IModelDb, commitArgs: string | SaveChangesArgs, fn: (txn: TestEditTxn) => T): T;
export function withTestEditTxn<T>(iModel: IModelDb, fn: (txn: TestEditTxn) => Promise<T>): Promise<T>;
export function withTestEditTxn<T>(iModel: IModelDb, commitArgs: string | SaveChangesArgs, fn: (txn: TestEditTxn) => Promise<T>): Promise<T>;
export function withTestEditTxn<T>(iModel: IModelDb, commitArgsOrFn: string | SaveChangesArgs | ((txn: TestEditTxn) => T | Promise<T>), maybeFn?: (txn: TestEditTxn) => T | Promise<T>): T | Promise<T> {
  const commitArgs = "function" === typeof commitArgsOrFn ? undefined : commitArgsOrFn;
  const fn = "function" === typeof commitArgsOrFn ? commitArgsOrFn : maybeFn;

  if (undefined === fn)
    throw new Error("withTestEditTxn requires a callback");

  const txn = new TestEditTxn(iModel);
  txn.start();

  try {
    const result = fn(txn);
    if (result instanceof Promise) {
      return result.then((value) => {
        txn.end(true, commitArgs);
        return value;
      }, (err) => {
        if (txn.isActive)
          txn.end(false);

        throw err;
      });
    }

    txn.end(true, commitArgs);
    return result;
  } catch (err) {
    if (txn.isActive)
      txn.end(false);

    throw err;
  }
}

