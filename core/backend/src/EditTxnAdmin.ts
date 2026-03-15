/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { EditTxnError } from "@itwin/core-common";
import { EditTxn } from "./EditTxn";

/**
 * Manages the active EditTxn globally.
 * Ensures only one EditTxn is active at a time across all iModels.
 * @beta
 */
export class EditTxnAdmin {
  private static _activeTxn?: EditTxn;

  /** The currently active EditTxn, or undefined if none is active. */
  public static get activeTxn(): EditTxn | undefined {
    return this._activeTxn;
  }

  /** Start the specified EditTxn, making it the active transaction.
   * @param txn The EditTxn to start.
   * @throws EditTxnError if another EditTxn is already active.
   */
  public static startTxn(txn: EditTxn): void {
    if (this._activeTxn !== undefined) {
      EditTxnError.throwError("already-active", "Another EditTxn is already active", txn.iModel.key);
    }
    this._activeTxn = txn;
    txn.iModel.activeTxn = txn;
  }

  /** Finish the currently active EditTxn.
   * If an EditTxn is active, it will be ended (canceled).
   */
  public static finishTxn(): void {
    if (this._activeTxn !== undefined) {
      this._activeTxn.iModel.activeTxn = undefined;
      this._activeTxn = undefined;
    }
  }
}