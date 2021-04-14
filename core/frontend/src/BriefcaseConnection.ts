/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { assert, Guid, GuidString, Id64String, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import {
  IModelConnectionProps, IModelError, IModelVersionProps, OpenBriefcaseProps,
  StandaloneOpenOptions,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { IpcApp } from "./IpcApp";
import { GraphicalEditingScope } from "./GraphicalEditingScope";
import { BriefcaseTxns } from "./BriefcaseTxns";
import { IModelApp } from "./IModelApp";

class ModelChangeMonitor {
  private _editingScope?: GraphicalEditingScope;
  private readonly _briefcase: BriefcaseConnection;

  public constructor(briefcase: BriefcaseConnection) {
    this._briefcase = briefcase;
  }

  public async close(): Promise<void> {
    if (this._editingScope) {
      await this._editingScope.exit();
      this._editingScope = undefined;
    }
  }

  public get editingScope(): GraphicalEditingScope | undefined {
    return this._editingScope;
  }

  public async enterEditingScope(): Promise<GraphicalEditingScope> {
    if (this._editingScope)
      throw new Error("Cannot create an editing scope for an iModel that already has one");

    this._editingScope = await GraphicalEditingScope.enter(this._briefcase);

    const removeGeomListener = this._editingScope.onGeometryChanges.addListener((changes) => {
      const modelIds = [];
      for (const change of changes)
        modelIds.push(change.id);

      this.invalidateScenes(modelIds);
    });

    this._editingScope.onExited.addOnce((scope) => {
      assert(scope === this._editingScope);
      this._editingScope = undefined;
      removeGeomListener();
      this.processBuffered();
    });

    return this._editingScope;
  }

  private processBuffered(): void {
  }

  private async purgeAndProcessBuffered(): Promise<void> {
    // ###TODO purgeTileTrees
    this.processBuffered();
  }

  private invalidateScenes(changedModels: Iterable<Id64String>): void {
    IModelApp.tileAdmin.forEachViewport((vp) => {
      if (vp.iModel === this._briefcase) {
        for (const modelId of changedModels) {
          if (vp.view.viewsModel(modelId)) {
            vp.invalidateScene();
            vp.setFeatureOverrideProviderChanged();
            break;
          }
        }
      }
    });
  }
}

/** A connection to an editable briefcase on the backend. This class uses [Ipc]($docs/learning/IpcInterface.md) to communicate
 * to the backend and may only be used by [[IpcApp]]s.
 * @public
 */
export class BriefcaseConnection extends IModelConnection {
  protected _isClosed?: boolean;
  private readonly _modelsMonitor: ModelChangeMonitor;

  /** Manages local changes to the briefcase via [Txns]($docs/learning/InteractiveEditing.md). */
  public readonly txns: BriefcaseTxns;

  /** @internal */
  public isBriefcaseConnection(): this is BriefcaseConnection { return true; }

  /** The Guid that identifies the *context* that owns this iModel. */
  public get contextId(): GuidString { return super.contextId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  /** The Guid that identifies this iModel. */
  public get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  protected constructor(props: IModelConnectionProps) {
    super(props);
    this.txns = new BriefcaseTxns(this);
    this._modelsMonitor = new ModelChangeMonitor(this);
  }

  /** Open a BriefcaseConnection to a [BriefcaseDb]($backend). */
  public static async openFile(briefcaseProps: OpenBriefcaseProps): Promise<BriefcaseConnection> {
    const iModelProps = await IpcApp.callIpcHost("openBriefcase", briefcaseProps);
    const connection = new this({ ...briefcaseProps, ...iModelProps });
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Open a BriefcaseConnection to a [StandaloneDb]($backend)
   * @note StandaloneDbs, by definition, may not push or pull changes. Attempting to do so will throw exceptions.
   */
  public static async openStandalone(filePath: string, openMode: OpenMode = OpenMode.ReadWrite, opts?: StandaloneOpenOptions): Promise<BriefcaseConnection> {
    const openResponse = await IpcApp.callIpcHost("openStandalone", filePath, openMode, opts);
    const connection = new this(openResponse);
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean { return this._isClosed === true; }

  /**
   * Close this BriefcaseConnection.
   * @note make sure to call [[saveChanges]] before calling this method. Unsaved local changes are abandoned.
   */
  public async close(): Promise<void> {
    if (this.isClosed)
      return;

    await this._modelsMonitor.close();

    this.beforeClose();
    this.txns.dispose();

    this._isClosed = true;
    await IpcApp.callIpcHost("closeIModel", this._fileKey);
  }

  private requireTimeline() {
    if (this.contextId === Guid.empty)
      throw new IModelError(IModelStatus.WrongIModel, "iModel has no timeline");
  }

  /** Query if there are any pending Txns in this briefcase that are waiting to be pushed. */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @bentley/prefer-get
    return this.txns.hasPendingTxns();
  }

  /** Commit pending changes to this briefcase.
   * @param description Optional description of the changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    await IpcApp.callIpcHost("saveChanges", this.key, description);
  }

  /** Pull (and potentially merge if there are local changes) up to a specified changeset from iModelHub into this briefcase
   * @param version The version to pull changes to. If `undefined`, pull all changes.
   */
  public async pullAndMergeChanges(version?: IModelVersionProps): Promise<void> {
    this.requireTimeline();
    return IpcApp.callIpcHost("pullAndMergeChanges", this.key, version);
  }

  /** Create a changeset from local Txns and push to iModelHub. On success, clear Txn table.
   * @param description The description for the changeset
   * @returns the changesetId of the pushed changes
   */
  public async pushChanges(description: string): Promise<string> {
    this.requireTimeline();
    return IpcApp.callIpcHost("pushChanges", this.key, description);
  }

  /** The current graphical editing scope, if one is in progress.
   * @see [[enterEditingScope]] to begin graphical editing.
   */
  public get editingScope(): GraphicalEditingScope | undefined {
    return this._modelsMonitor.editingScope;
  }

  /** Return whether graphical editing is supported for this briefcase. It is not supported if the briefcase is read-only, or the briefcase contains a version of
   * the BisCore ECSchema older than v0.1.11.
   * @see [[enterEditingScope]] to enable graphical editing.
   */
  public async supportsGraphicalEditing(): Promise<boolean> {
    return IpcApp.callIpcHost("isGraphicalEditingSupported", this.key);
  }

  /** Begin a new graphical editing scope.
   * @throws Error if an editing scope already exists or one could not be created.
   * @see [[GraphicalEditingScope.exit]] to exit the scope.
   * @see [[supportsGraphicalEditing]] to determine whether this method should be expected to succeed.
   * @see [[editingScope]] to obtain the current editing scope, if one is in progress.
   */
  public async enterEditingScope(): Promise<GraphicalEditingScope> {
    return this._modelsMonitor.enterEditingScope();
  }
}
