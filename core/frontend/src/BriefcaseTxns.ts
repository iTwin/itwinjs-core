/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import {
  ChangedEntities, IModelStatus, IpcAppChannel, ModelIdAndGeometryGuid, RemoveFunction, TxnNotifications,
} from "@bentley/imodeljs-common";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { IpcApp, NotificationHandler } from "./IpcApp";

/**
 * Base class for notification handlers for events from the backend that are specific to a [[BriefcaseConnection]].
 * @beta
 */
export abstract class BriefcaseNotificationHandler extends NotificationHandler {
  constructor(private _key: string) { super(); }
  public abstract get briefcaseChannelName(): string;
  public get channelName() { return `${this.briefcaseChannelName}:${this._key}`; }
}

/** Manages local changes to a [[BriefcaseConnection]] via [Txns]($docs/learning/InteractiveEditing.md).
 * @see [[BriefcaseConnection.txns]].
 * @see [TxnManager]($backend) for the backend counterpart.
 * @beta
 */
export class BriefcaseTxns extends BriefcaseNotificationHandler implements TxnNotifications {
  private readonly _iModel: BriefcaseConnection;
  private _cleanup?: RemoveFunction;

  /** @internal */
  public get briefcaseChannelName() {
    return IpcAppChannel.Txns;
  }

  /** Event raised after Txn validation or changeset application to indicate the set of changed elements.
   * @note If there are many changed elements in a single Txn, the notifications are sent in batches so this event *may be called multiple times* per Txn.
   */
  public readonly onElementsChanged = new BeEvent<(changes: Readonly<ChangedEntities>) => void>();

  /** Event raised after Txn validation or changeset application to indicate the set of changed models.
   * @note If there are many changed models in a single Txn, the notifications are sent in batches so this event *may be called multiple times* per Txn.
   */
  public readonly onModelsChanged = new BeEvent<(changes: Readonly<ChangedEntities>) => void>();

  /** Event raised after the geometry within one or more [[GeometricModelState]]s is modified by applying a changeset or validation of a transaction.
   * A model's geometry can change as a result of:
   *  - Insertion or deletion of a geometric element within the model; or
   *  - Modification of an existing element's geometric properties; or
   *  - An explicit request to flag it as changed via [IModelDb.Models.updateModel]($backend).
   */
  public readonly onModelGeometryChanged = new BeEvent<(changes: ReadonlyArray<ModelIdAndGeometryGuid>) => void>();

  /** Event raised before a commit operation is performed. Initiated by a call to [[BriefcaseConnection.saveChanges]], unless there are no changes to save.
   * @see [[onCommitted]] for the event raised after the operation.
   */
  public readonly onCommit = new BeEvent<() => void>();

  /** Event raised after a commit operation is performed. Initiated by a call to [[BriefcaseConnection.saveChanges]], even if there were no changes to save.
   * @see [[onCommit]] for the event raised before the operation.
   */
  public readonly onCommitted = new BeEvent<() => void>();

  /** Event raised after a changeset has been applied to the briefcase.
   * Changesets may be applied as a result of [[BriefcaseConnection.pullAndMergeChanges]], or by undo/redo operations.
   */
  public readonly onChangesApplied = new BeEvent<() => void>();

  /** Event raised before an undo/redo operation is performed.
   * @see [[onAfterUndoRedo]] for the event raised after the operation.
   */
  public readonly onBeforeUndoRedo = new BeEvent<(isUndo: boolean) => void>();

  /** Event raised after an undo/redo operation is performed.
   * @see [[onBeforeUndoRedo]] for the event raised before to the operation.
   */
  public readonly onAfterUndoRedo = new BeEvent<(isUndo: boolean) => void>();

  /** @internal */
  public constructor(iModel: BriefcaseConnection) {
    super(iModel.key);
    this._iModel = iModel;
    this._cleanup = this.registerImpl();
  }

  /** @internal */
  public dispose(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;

      this.onElementsChanged.clear();
      this.onModelsChanged.clear();
      this.onModelGeometryChanged.clear();
      this.onCommit.clear();
      this.onCommitted.clear();
      this.onChangesApplied.clear();
      this.onBeforeUndoRedo.clear();
      this.onAfterUndoRedo.clear();
    }
  }

  /** Query if the briefcase has any pending Txns waiting to be pushed. */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return IpcApp.callIpcHost("hasPendingTxns", this._iModel.key);
  }

  /** Determine if any reversible (undoable) changes exist.
   * @see [[reverseSingleTxn]] or [[reverseAll]] to undo changes.
   */
  public async isUndoPossible(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return IpcApp.callIpcHost("isUndoPossible", this._iModel.key);
  }

  /** Determine if any reinstatable (redoable) changes exist.
   * @see [[reinstateTxn]] to redo changes.
   */
  public async isRedoPossible(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return IpcApp.callIpcHost("isRedoPossible", this._iModel.key);
  }

  /** Get the description of the operation that would be reversed by calling [[reverseTxns]]`(1)`.
   * This is useful for showing the operation that would be undone, for example in a menu.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   */
  public async getUndoString(allowCrossSessions?: boolean): Promise<string> {
    return IpcApp.callIpcHost("getUndoString", this._iModel.key, allowCrossSessions);
  }

  /** Get a description of the operation that would be reinstated by calling [[reinstateTxn]].
   * This is useful for showing the operation that would be redone, in a pull-down menu for example.
   */
  public async getRedoString(): Promise<string> {
    return IpcApp.callIpcHost("getRedoString", this._iModel.key);
  }

  /** Reverse (undo) the most recent operation.
   * @see [[reinstateTxn]] to redo operations.
   * @see [[reverseAll]] to undo all operations.
   * @see [[isUndoPossible]] to determine if any reversible operations exist.
   */
  public async reverseSingleTxn(): Promise<IModelStatus> {
    return this.reverseTxns(1);
  }

  /** Reverse (undo) the most recent operation(s) to the briefcase.
   * @param numOperations the number of operations to reverse. If this is greater than 1, the entire set of operations will
   *  be reinstated together when/if [[reinstateTxn]] is called.
   * @param allowCrossSessions if true, allow undo from previous sessions.
   * @note If there are any outstanding uncommitted changes, they are reversed.
   * @note The term "operation" is used rather than Txn, since multiple Txns can be grouped together via [TxnManager.beginMultiTxnOperation]($backend). So,
   * even if numOperations is 1, multiple Txns may be reversed if they were grouped together when they were made.
   * @note If numOperations is too large only the number of reversible operations are reversed.
   */
  public async reverseTxns(numOperations: number, allowCrossSessions?: boolean): Promise<IModelStatus> {
    return IpcApp.callIpcHost("reverseTxns", this._iModel.key, numOperations, allowCrossSessions);
  }

  /** Reverse (undo) all changes back to the beginning of the session.
   * @see [[reinstateTxn]] to redo changes.
   * @see [[reverseSingleTxn]] to undo only the most recent operation.
   * @see [[isUndoPossible]] to determine if any reversible operations exist.
   */
  public async reverseAll(): Promise<IModelStatus> {
    return IpcApp.callIpcHost("reverseAllTxn", this._iModel.key);
  }

  /** Reinstate (redo) the most recently reversed transaction. Since at any time multiple transactions can be reversed, it
   * may take multiple calls to this method to reinstate all reversed operations.
   * @returns Success if a reversed transaction was reinstated, error status otherwise.
   * @note If there are any outstanding uncommited changes, they are canceled before the Txn is reinstated.
   * @see [[isRedoPossible]] to determine if any reinstatable operations exist.
   * @see [[reverseSingleTxn]] or [[reverseAll]] to undo changes.
   */
  public async reinstateTxn(): Promise<IModelStatus> {
    return IpcApp.callIpcHost("reinstateTxn", this._iModel.key);
  }

  /** @internal */
  public notifyElementsChanged(changed: ChangedEntities): void {
    this.onElementsChanged.raiseEvent(changed);
  }

  /** @internal */
  public notifyModelsChanged(changed: ChangedEntities): void {
    this.onModelsChanged.raiseEvent(changed);
  }

  /** @internal */
  public notifyGeometryGuidsChanged(changes: ModelIdAndGeometryGuid[]): void {
    this.onModelGeometryChanged.raiseEvent(changes);
  }

  /** @internal */
  public notifyCommit() {
    this.onCommit.raiseEvent();
  }

  /** @internal */
  public notifyCommitted() {
    this.onCommitted.raiseEvent();
  }

  /** @internal */
  public notifyChangesApplied() {
    this.onChangesApplied.raiseEvent();
  }

  /** @internal */
  public notifyBeforeUndoRedo(isUndo: boolean) {
    this.onBeforeUndoRedo.raiseEvent(isUndo);
  }

  /** @internal */
  public notifyAfterUndoRedo(isUndo: boolean) {
    this.onAfterUndoRedo.raiseEvent(isUndo);
  }
}
