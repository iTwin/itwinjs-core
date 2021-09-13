/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

/** Describes the types of actions associated with [Txns]($docs/learning/InteractiveEditing.md).
 * @public
 */
export enum TxnAction {
  /** Not currently processing anything. */
  None = 0,
  /** Processing a commit initiated by a call to [IModelDb.saveChanges]($backend) or [BriefcaseConnection.saveChanges]($frontend). */
  Commit = 1,
  /** Abandoning the current Txn, e.g., via [IModelDb.abandonChanges]($backend). */
  Abandon = 2,
  /** Reversing a previously-committed changeset, e.g., via [TxnManager.reverseTxns]($backend) [BriefcaseTxns.reverseTxns]($frontend). */
  Reverse = 3,
  /** Reinstating a previously reversed changeset, e.g., via [TxnManager.reinstateTxn]($backend) or [BriefcaseTxns.reinstateTxn]($frontend). */
  Reinstate = 4,
  /** Merging a changeset produced by a different briefcase, e.g., via [BriefcaseDb.pullChanges]($backend). */
  Merge = 5,
}
