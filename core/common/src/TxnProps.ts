/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Id64String } from "@itwin/core-bentley";

/**
 * @alpha
 * Transaction types
 */
export type TxnType = "Data" | "ECSchema" | "Schema" | "Ddl"; // TODO: Remove "Schema" in favor of "ECSchema". Currently thats a bug in native code....for schema txns we get txn type as "Schema" instead of "ECSchema".

/**
 * @alpha
 * Represents the properties of a transaction within the transaction manager.
 *
 * @property id - The unique identifier for the transaction.
 * @property sessionId - The identifier of the session to which the transaction belongs.
 * @property nextId - (Optional) The identifier of the next transaction in the sequence.
 * @property prevId - (Optional) The identifier of the previous transaction in the sequence.
 * @property props - The arguments or properties associated with the save changes operation.
 * @property type - The type of transaction, which can be "Data", "ECSchema", or "Ddl".
 * @property reversed - Indicates whether the transaction has been reversed.
 * @property grouped - Indicates whether the transaction is grouped with others.
 * @property timestamp - The timestamp when the transaction was created.
 */
export interface TxnProps {
  id: Id64String;
  sessionId: number;
  nextId?: Id64String;
  prevId?: Id64String;
  props: SaveChangesArgs;
  type: TxnType;
  reversed: boolean;
  grouped: boolean;
  timestamp: string;
}

/**
 * Arguments for saving changes to the iModel.
 * @beta
 */
export interface SaveChangesArgs {
  /**
   * Optional description of the changes being saved.
   */
  description?: string;
  /**
   * Optional source of the changes being saved.
   */
  source?: string;
  /**
   * Optional application-specific data to include with the changes.
   */
  appData?: { [key: string]: any };
}

/** Arguments to [[TxnManager]]'s async reverse and cancel methods.
 * @beta
 */
export interface ReverseTxnArgs {
  /** If `true`, locks acquired when the reversed Txns were originally created are retained. If `false` or not specified,
   * these locks are abandoned. */
  readonly retainLocks?: boolean;
}

/** Arguments to [[TxnManager]]'s async reinstate methods.
 * @beta
 */
export interface ReinstateTxnArgs {
  /** If `true`, locks acquired during the current, unsaved Txn are retained, even while the unsaved changes
   * themselves are abandoned. If `false` or not specified, the locks are abandoned along with the changes. */
  readonly retainLocks?: boolean;
}
