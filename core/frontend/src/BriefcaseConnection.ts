/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { assert, BeEvent, CompressedId64Set, Guid, GuidString, Id64String, IModelStatus, OpenMode } from "@itwin/core-bentley";
import {
  ChangesetIndex, ChangesetIndexAndId, getPullChangesIpcChannel, IModelConnectionProps, IModelError,
  PullChangesOptions as IpcAppPullChangesOptions, OpenBriefcaseProps, StandaloneOpenOptions,
} from "@itwin/core-common";
import { BriefcaseTxns } from "./BriefcaseTxns";
import { GraphicalEditingScope } from "./GraphicalEditingScope";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IpcApp } from "./IpcApp";
import { ProgressCallback } from "./request/Request";
import { disposeTileTreesForGeometricModels } from "./tile/internal";
import { Viewport } from "./Viewport";

/**
 * Download progress information.
 * @public
 */
export interface DownloadProgressInfo {
  /** Bytes downloaded. */
  loaded: number;
  /** Total size of the download in bytes. */
  total: number;
}

/**
 * Called to show progress during a download.
 * @public
 */
export type OnDownloadProgress = (progress: DownloadProgressInfo) => void;

/**
 * Partial interface of AbortSignal.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 * @beta
 */
export interface GenericAbortSignal {
  /** Add Listener for abort signal. */
  addEventListener: (type: "abort", listener: (this: GenericAbortSignal, ev: any) => any) => void;
  /** Remove Listener for abort signal. */
  removeEventListener: (type: "abort", listener: (this: GenericAbortSignal, ev: any) => any) => void;
}

/**
 * Options for pulling iModel changes.
 * @public
 */
export interface PullChangesOptions {
  /**
   * Function called regularly to report progress of changes download.
   * @deprecated in 3.6. Use [[downloadProgressCallback]] instead.
   */
  progressCallback?: ProgressCallback; // eslint-disable-line @typescript-eslint/no-deprecated
  /** Function called regularly to report progress of changes download. */
  downloadProgressCallback?: OnDownloadProgress;
  /** Interval for calling progress callback (in milliseconds). */
  progressInterval?: number;
  /** Signal for cancelling the download.
   * @beta
   */
  abortSignal?: GenericAbortSignal;
}

/** Keeps track of changes to models, buffering them until synchronization points.
 * While a GraphicalEditingScope is open, the changes are buffered until the scope exits, at which point they are processed.
 * Otherwise, the buffered changes are processed after undo/redo, commit, or pull+merge changes.
 */
class ModelChangeMonitor {
  private _editingScope?: GraphicalEditingScope;
  private readonly _briefcase: BriefcaseConnection;
  private readonly _deletedModels = new Set<string>();
  private readonly _modelIdToGuid = new Map<string, string>();
  private readonly _removals: VoidFunction[] = [];

  public constructor(briefcase: BriefcaseConnection) {
    this._briefcase = briefcase;

    // Buffer updated geometry guids.
    this._removals.push(briefcase.txns.onModelGeometryChanged.addListener((changes) => {
      for (const change of changes) {
        this._deletedModels.delete(change.id);
        this._modelIdToGuid.set(change.id, change.guid);
      }
    }));

    // Buffer deletions of models.
    this._removals.push(briefcase.txns.onModelsChanged.addListener((changes) => {
      if (changes.deleted) {
        for (const id of CompressedId64Set.iterable(changes.deleted)) {
          this._modelIdToGuid.delete(id);
          this._deletedModels.add(id);
        }
      }
    }));

    // Outside of an editing scope, we want to update viewport contents after commit, undo/redo, or merging changes.
    const maybeProcess = async () => {
      if (this.editingScope)
        return;

      const modelIds = Array.from(this._modelIdToGuid.keys());
      if (modelIds.length > 0)
        await IModelApp.tileAdmin.purgeTileTrees(this._briefcase, modelIds);

      this.processBuffered();
    };

    this._removals.push(briefcase.txns.onCommitted.addListener(maybeProcess));
    this._removals.push(briefcase.txns.onReplayedExternalTxns.addListener(maybeProcess));
    this._removals.push(briefcase.txns.onAfterUndoRedo.addListener(maybeProcess));
    this._removals.push(briefcase.txns.onChangesPulled.addListener(maybeProcess));
  }

  public async close(): Promise<void> {
    for (const removal of this._removals)
      removal();

    this._removals.length = 0;

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
    const models = this._briefcase.models;
    for (const [id, guid] of this._modelIdToGuid) {
      const model = models.getLoaded(id)?.asGeometricModel;
      if (model)
        model.geometryGuid = guid;
    }

    const modelIds = new Set<string>(this._modelIdToGuid.keys());
    for (const deleted of this._deletedModels) {
      modelIds.add(deleted);
      models.unload(deleted);
    }

    this.invalidateScenes(modelIds);
    disposeTileTreesForGeometricModels(modelIds, this._briefcase);

    this._briefcase.onBufferedModelChanges.raiseEvent(modelIds);

    this._modelIdToGuid.clear();
    this._deletedModels.clear();
  }

  private invalidateScenes(changedModels: Iterable<Id64String>): void {
    for (const user of IModelApp.tileAdmin.tileUsers) {
      if (user instanceof Viewport && user.iModel === this._briefcase) {
        for (const modelId of changedModels) {
          if (user.view.viewsModel(modelId)) {
            user.invalidateScene();
            user.setFeatureOverrideProviderChanged();
            break;
          }
        }
      }
    }
  }
}

/** Settings that can be used to control the behavior of [[Tool]]s that modify a [[BriefcaseConnection]].
 * For example, tools that want to create new elements can consult the briefcase's editor tool settings to
 * determine into which model and category to insert the elements.
 * Specialized tools are free to ignore these settings.
 * @see [[BriefcaseConnection.editorToolSettings]] to query or modify the current settings for a briefcase.
 * @see [CreateElementTool]($editor-frontend) for an example of a tool that uses these settings.
 * @beta
 */
export class BriefcaseEditorToolSettings {
  private _category?: Id64String;
  private _model?: Id64String;

  /** An event raised just after the default [[category]] is changed. */
  public readonly onCategoryChanged = new BeEvent<(previousCategory: Id64String | undefined) => void>();

  /** An event raised just after the default [[model]] is changed. */
  public readonly onModelChanged = new BeEvent<(previousModel: Id64String | undefined) => void>();

  /** The [Category]($backend) into which new elements should be inserted by default.
   * Specialized tools are free to ignore this setting and instead use their own logic to select an appropriate category.
   * @see [[onCategoryChanged]] to be notified when this property is modified.
   * @see [CreateElementTool.targetCategory]($editor-frontend) for an example of a tool that uses this setting.
   */
  public get category(): Id64String | undefined {
    return this._category;
  }
  public set category(category: Id64String | undefined) {
    const previousCategory = this.category;
    if (category !== this.category) {
      this._category = category;
      this.onCategoryChanged.raiseEvent(previousCategory);
    }
  }

  /** The [Model]($backend) into which new elements should be inserted by default.
   * Specialized tools are free to ignore this setting and instead use their own logic to select an appropriate model.
   * @see [[onModelChanged]] to be notified when this property is modified.
   * @see [CreateElementTool.targetModelId]($editor-frontend) for an example of a tool that uses this setting.
   */
  public get model(): Id64String | undefined {
    return this._model;
  }
  public set model(model: Id64String | undefined) {
    const previousModel = this.model;
    if (model !== this.model) {
      this._model = model;
      this.onModelChanged.raiseEvent(previousModel);
    }
  }
}

/** A connection to an editable briefcase on the backend. This class uses [Ipc]($docs/learning/IpcInterface.md) to communicate
 * to the backend and may only be used by [[IpcApp]]s.
 * @public
 */
export class BriefcaseConnection extends IModelConnection {
  protected _isClosed?: boolean;
  private readonly _modelsMonitor: ModelChangeMonitor;
  /** Default settings that can be used to control the behavior of [[Tool]]s that modify this briefcase.
   * @beta
   */
  public readonly editorToolSettings = new BriefcaseEditorToolSettings();

  /** Manages local changes to the briefcase via [Txns]($docs/learning/InteractiveEditing.md). */
  public readonly txns: BriefcaseTxns;

  public override isBriefcaseConnection(): this is BriefcaseConnection { return true; }

  /** The Guid that identifies the iTwin that owns this iModel. */
  public override get iTwinId(): GuidString { return super.iTwinId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString { return super.iModelId!; } // GuidString | undefined for IModelConnection, but required for BriefcaseConnection

  protected constructor(props: IModelConnectionProps, openMode: OpenMode) {
    super(props);
    this._openMode = openMode;
    this.txns = new BriefcaseTxns(this);
    this._modelsMonitor = new ModelChangeMonitor(this);
    if (OpenMode.ReadWrite === this._openMode)
      this.txns.onAfterUndoRedo.addListener(async () => { await IModelApp.toolAdmin.restartPrimitiveTool(); });
  }

  /** Open a BriefcaseConnection to a [BriefcaseDb]($backend). */
  public static async openFile(briefcaseProps: OpenBriefcaseProps): Promise<BriefcaseConnection> {
    const iModelProps = await IpcApp.appFunctionIpc.openBriefcase(briefcaseProps);
    const connection = new this({ ...briefcaseProps, ...iModelProps }, briefcaseProps.readonly ? OpenMode.Readonly : OpenMode.ReadWrite);
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  /** Open a BriefcaseConnection to a [StandaloneDb]($backend)
   * @note StandaloneDbs, by definition, may not push or pull changes. Attempting to do so will throw exceptions.
   */
  public static async openStandalone(filePath: string, openMode: OpenMode = OpenMode.ReadWrite, opts?: StandaloneOpenOptions): Promise<BriefcaseConnection> {
    const openResponse = await IpcApp.appFunctionIpc.openStandalone(filePath, openMode, opts);
    const connection = new this(openResponse, openMode);
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
    await IpcApp.appFunctionIpc.closeIModel(this._fileKey);
  }

  private requireTimeline() {
    if (this.iTwinId === Guid.empty)
      throw new IModelError(IModelStatus.WrongIModel, "iModel has no timeline");
  }

  /** Query if there are any pending Txns in this briefcase that are waiting to be pushed. */
  public async hasPendingTxns(): Promise<boolean> { // eslint-disable-line @itwin/prefer-get
    return this.txns.hasPendingTxns();
  }

  /** Commit pending changes to this briefcase.
   * @param description Optional description of the changes.
   */
  public async saveChanges(description?: string): Promise<void> {
    await IpcApp.appFunctionIpc.saveChanges(this.key, description);
  }

  /** Pull (and potentially merge if there are local changes) up to a specified changeset from iModelHub into this briefcase
   * @param toIndex The changeset index to pull changes to. If `undefined`, pull all changes.
   * @param options Options for pulling changes.
   * @see [[BriefcaseTxns.onChangesPulled]] for the event dispatched after changes are pulled.
   */
  public async pullChanges(toIndex?: ChangesetIndex, options?: PullChangesOptions): Promise<void> {
    const removeListeners: VoidFunction[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const shouldReportProgress = !!options?.progressCallback || !!options?.downloadProgressCallback;

    if (shouldReportProgress) {
      const handleProgress = (_evt: Event, data: { loaded: number, total: number }) => {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        options?.progressCallback?.(data);
        options?.downloadProgressCallback?.(data);
      };

      const removeProgressListener = IpcApp.addListener(
        getPullChangesIpcChannel(this.iModelId),
        handleProgress,
      );
      removeListeners.push(removeProgressListener);
    }

    if (options?.abortSignal) {
      const abort = () => void IpcApp.appFunctionIpc.cancelPullChangesRequest(this.key);
      options?.abortSignal.addEventListener("abort", abort);
      removeListeners.push(() => options?.abortSignal?.removeEventListener("abort", abort));
    }

    this.requireTimeline();
    const ipcAppOptions: IpcAppPullChangesOptions = {
      reportProgress: shouldReportProgress,
      progressInterval: options?.progressInterval,
      enableCancellation: !!options?.abortSignal,
    };
    try {
      this.changeset = await IpcApp.appFunctionIpc.pullChanges(this.key, toIndex, ipcAppOptions);
    } finally {
      removeListeners.forEach((remove) => remove());
    }
  }

  /** Create a changeset from local Txns and push to iModelHub. On success, clear Txn table.
   * @param description The description for the changeset
   * @returns the changesetId of the pushed changes
   * @see [[BriefcaseTxns.onChangesPushed]] for the event dispatched after changes are pushed.
   */
  public async pushChanges(description: string): Promise<ChangesetIndexAndId> {
    this.requireTimeline();
    return IpcApp.appFunctionIpc.pushChanges(this.key, description);
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
    return IpcApp.appFunctionIpc.isGraphicalEditingSupported(this.key);
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

  /** Strictly for tests - dispatched from ModelChangeMonitor.processBuffered.
   * @internal
   */
  public readonly onBufferedModelChanges = new BeEvent<(changedModelIds: Set<string>) => void>();
}
