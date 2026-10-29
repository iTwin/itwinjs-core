/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Id64String } from "@itwin/core-bentley";

/**
 * The type of changes contained in a transaction.
 * - `"Data"`: data changes only.
 * - `"ECSchema"` or `"Schema"`: EC schema changes. Both values may be reported for schema transactions.
 * - `"Ddl"`: database schema (DDL) changes.
 * @beta
 */
export type TxnType = "Data" | "ECSchema" | "Schema" | "Ddl"; // TODO: Remove "Schema" in favor of "ECSchema". Currently thats a bug in native code....for schema txns we get txn type as "Schema" instead of "ECSchema".

/**
 * Represents the properties of a transaction within the transaction manager.
 * @beta
 */
export interface TxnProps {
  /** The unique identifier for the transaction. */
  id: Id64String;
  /** The identifier of the session in which the transaction was created. */
  sessionId: number;
  /** The identifier of the next transaction in the sequence, if any. */
  nextId?: Id64String;
  /** The identifier of the previous transaction in the sequence, if any. */
  prevId?: Id64String;
  /** The arguments supplied when the transaction's changes were saved. */
  props: SaveChangesArgs;
  /** The type of changes contained in the transaction. */
  type: TxnType;
  /** Whether the transaction has been reversed. */
  reversed: boolean;
  /** Whether the transaction is grouped with others. */
  grouped: boolean;
  /** The time at which the transaction was created. */
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
