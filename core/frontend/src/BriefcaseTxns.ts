/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import {
  ChangedEntities, IpcAppChannel, ModelIdAndGeometryGuid, RemoveFunction,
  TxnAction, TxnNotifications,
} from "@bentley/imodeljs-common";
import { BriefcaseConnection } from "./BriefcaseConnection";
import { NotificationHandler } from "./IpcApp";

/**
 * Base class for notification handlers for events from the backend that are specific to a [[BriefcaseConnection]].
 * @beta
 */
export abstract class BriefcaseNotificationHandler extends NotificationHandler {
  constructor(private _key: string) { super(); }
  public abstract get briefcaseChannelName(): string;
  public get channelName() { return `${this.briefcaseChannelName}:${this._key}`; }
}

/** Dispatches events corresponding to local changes made to a [[BriefcaseConnection]] via [Txns]($docs/learning/InteractiveEditing.md).
 * @see [[BriefcaseConnection.txns]].
 * @see [TxnManager]($backend) for the backend counterpart from which the events originate.
 * @beta
 */
export class BriefcaseTxns extends BriefcaseNotificationHandler implements TxnNotifications {
  private readonly _iModel: BriefcaseConnection;
  private _cleanup?: RemoveFunction;

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

  /** Event raised after the geometry within one or more [[GeometricModelState]]s is modified by application of a changeset or validation of a transaction.
   * A model's geometry can change as a result of:
   *  - Insertion or deletion of a geometric element within the model; or
   *  - Modification of an existing element's geometric properties; or
   *  - An explicit request to flag it as changed via [IModelDb.updateModel]($backend).
   */
  public readonly onModelGeometryChanged = new BeEvent<(changes: ReadonlyArray<ModelIdAndGeometryGuid>) => void>();

  /** Event raised before a commit operation is performed. Initiated by a call to [[BriefcaseConnection.saveChanges]].
   * @see [[onCommitted]] for the event raised after the operation.
   */
  public readonly onCommit = new BeEvent<() => void>();

  /** Event raised after a commit operation is performed. Initiated by a call to [[BriefcaseConnection.saveChanges]].
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
  public readonly onBeforeUndoRedo = new BeEvent<() => void>();

  /** Event raised after an undo/redo operation is performed.
   * @see [[onBeforeUndoRedo]] for the event raised before to the operation.
   */
  public readonly onAfterUndoRedo = new BeEvent<(action: TxnAction) => void>();

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
    }
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
  public notifyBeforeUndoRedo() {
    this.onBeforeUndoRedo.raiseEvent();
  }

  /** @internal */
  public notifyAfterUndoRedo(action: TxnAction) {
    this.onAfterUndoRedo.raiseEvent(action);
  }
}
