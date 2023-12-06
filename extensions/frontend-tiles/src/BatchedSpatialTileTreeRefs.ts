/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Id64String } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import {
  AttachToViewportArgs, createSpatialTileTreeReferences, IModelConnection, SpatialModelState, SpatialTileTreeReferences, SpatialViewState,
  TileTreeLoadStatus, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { AnimatedBatchedTileTreeReference, PrimaryBatchedTileTreeReference } from "./BatchedTileTreeReference";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";
import { BatchedModels } from "./BatchedModels";
import { ComputeSpatialTilesetBaseUrl } from "./FrontendTiles";

// Obtains tiles pre-published by mesh export service.
class BatchedSpatialTileTreeReferences implements SpatialTileTreeReferences {
  private readonly _view: SpatialViewState;
  private readonly _models: BatchedModels;
  private _currentScript?: RenderSchedule.Script;
  private _primaryRef!: PrimaryBatchedTileTreeReference;
  private readonly _animatedRefs: AnimatedBatchedTileTreeReference[] = [];
  private _realityTreeRefs = new Map<Id64String, TileTreeReference>();
  private _onModelSelectorChanged?: () => void;
  /** Provides tile trees for models that were not included in the batched tileset.
   * Initialized after the TileTree is loaded.
   */
  private _excludedRefs?: SpatialTileTreeReferences | "none";

  private get excludedRefs(): SpatialTileTreeReferences | undefined {
    if (undefined === this._excludedRefs) {
      const tree = this._primaryRef.batchedTree;
      if (tree)
        this._excludedRefs = tree.includedModels ? createSpatialTileTreeReferences(this._view, tree.includedModels) : "none";
    }

    return typeof this._excludedRefs === "object" ? this._excludedRefs : undefined;
  }

  public constructor(baseUrl: URL, view: SpatialViewState) {
    this._view = view;
    this._models = new BatchedModels(view);

    const script = view.displayStyle.scheduleScript;
    this._currentScript = script?.requiresBatching ? script : undefined;

    this.load(baseUrl, view.iModel);

    assert(undefined !== this._primaryRef);
  }

  private load(baseUrl: URL, iModel: IModelConnection): void {
    const treeOwner = getBatchedTileTreeOwner(iModel, { baseUrl, script: this._currentScript });
    this._primaryRef = new PrimaryBatchedTileTreeReference(treeOwner, this._models);

    this.populateAnimatedReferences(treeOwner);
    this.populateRealityModels();

    const onScriptChanged = (newScript: RenderSchedule.Script | undefined) => {
      if (!newScript?.requiresBatching)
        newScript = undefined;

      const currentScript = this._currentScript;
      this._currentScript = newScript;

      if (newScript !== currentScript)
        if (!newScript || !currentScript || !newScript.equals(currentScript))
          this.load(baseUrl, iModel);
    };

    let removeScriptChangedListener = this._view.displayStyle.onScheduleScriptChanged.addListener((newScript) => onScriptChanged(newScript));
    this._view.onDisplayStyleChanged.addListener((newStyle) => {
      removeScriptChangedListener();
      onScriptChanged(newStyle.scheduleScript);
      removeScriptChangedListener = this._view.displayStyle.onScheduleScriptChanged.addListener((newScript) => onScriptChanged(newScript));
    });
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    yield this._primaryRef;

    for (const animatedRef of this._animatedRefs)
      yield animatedRef;

    for (const realityTreeRef of this._realityTreeRefs.values())
      yield realityTreeRef;

    const excluded = this.excludedRefs;
    if (excluded)
      for (const ref of excluded)
        yield ref;
  }

  private populateAnimatedReferences(treeOwner: TileTreeOwner): void {
    this._animatedRefs.length = 0;
    const script = this._currentScript;
    if (!script)
      return;

    const getCurrentTimePoint = () => this._view.displayStyle.settings.timePoint ?? script.duration.low;
    for (const timeline of script.modelTimelines) {
      const nodeIds = timeline.transformBatchIds;
      for (const nodeId of nodeIds) {
        this._animatedRefs.push(new AnimatedBatchedTileTreeReference(treeOwner, {
          timeline,
          nodeId,
          getCurrentTimePoint,
        }));
      }
    }
  }

  private populateRealityModels(): void {
    const prevRefs = this._realityTreeRefs;
    this._realityTreeRefs = new Map<Id64String, TileTreeReference>();
    for (const modelId of this._models.viewedRealityModelIds) {
      let ref = prevRefs.get(modelId);
      if (!ref) {
        const model = this._view.iModel.models.getLoaded(modelId);
        if (model && model instanceof SpatialModelState) {
          assert(model.isRealityModel);
          ref = model.createTileTreeReference(this._view);
        }
      }

      if (ref)
        this._realityTreeRefs.set(modelId, ref);
    }
  }

  public update(): void {
    this._models.setViewedModels(this._view.modelSelector.models);
    this.populateRealityModels();
    if (this._onModelSelectorChanged)
      this._onModelSelectorChanged();
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._onModelSelectorChanged = () => args.invalidateSymbologyOverrides();
  }

  public detachFromViewport(): void {
    this._onModelSelectorChanged = undefined;
  }

  public setDeactivated(): void {
    // Used for debugging. Unimplemented here.
  }
}

// A placeholder used by [[ProxySpatialTileTreeReferences]] until asynchronous loading completes.
// It provides a TileTreeOwner that never loads a tile tree.
// This ensures that [ViewState.areAllTileTreesLoaded]($frontend) will not return `true` while we are loading.
class ProxyTileTreeReference extends TileTreeReference {
  private readonly _treeOwner: TileTreeOwner;

  public constructor(iModel: IModelConnection) {
    super();
    this._treeOwner = {
      iModel,
      tileTree: undefined,
      loadStatus: TileTreeLoadStatus.NotLoaded,
      load: () => undefined,
      dispose: () => { },
      loadTree: async () => Promise.resolve(undefined),
    };
  }

  public override get treeOwner() {
    return this._treeOwner;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  public override get _isLoadingComplete() {
    return false;
  }
}

// Serves as a placeholder while we asynchronously obtain the base URL for a pre-published tileset (or asynchronously determine
// that no such tileset exists).
class ProxySpatialTileTreeReferences implements SpatialTileTreeReferences {
  // Once async loading completes, all methods will be forwarded to this implementation.
  private _impl?: SpatialTileTreeReferences;
  private readonly _proxyRef: ProxyTileTreeReference;
  // Retained if attachToViewport is called while we are still loading; and reset if detachFromViewport is called while loading.
  private _attachArgs?: AttachToViewportArgs;

  public constructor(view: SpatialViewState, getBaseUrl: Promise<URL | undefined>) {
    this._proxyRef = new ProxyTileTreeReference(view.iModel);
    getBaseUrl.then((url: URL | undefined) => {
      if (url) {
        this.setTreeRefs(new BatchedSpatialTileTreeReferences(url, view));
      } else {
        this.setTreeRefs(createSpatialTileTreeReferences(view));
      }
    }).catch(() => {
      this.setTreeRefs(createSpatialTileTreeReferences(view));
    });
  }

  private setTreeRefs(refs: SpatialTileTreeReferences): void {
    this._impl = refs;
    if (this._attachArgs) {
      this._impl.attachToViewport(this._attachArgs);
      this._attachArgs.invalidateSymbologyOverrides();
      this._attachArgs = undefined;
    }
  }

  public update(): void {
    this._impl?.update();
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    if (this._impl)
      this._impl.attachToViewport(args);
    else
      this._attachArgs = args;
  }

  public detachFromViewport(): void {
    if (this._impl)
      this._impl.detachFromViewport();
    else
      this._attachArgs = undefined;
  }

  public setDeactivated(): void { }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    if (this._impl) {
      for (const ref of this._impl)
        yield ref;
    } else {
      yield this._proxyRef;
    }
  }
}

const iModelToBaseUrl = new Map<IModelConnection, URL | null | Promise<URL | undefined>>();

/** @internal */
export function createBatchedSpatialTileTreeReferences(view: SpatialViewState, computeBaseUrl: ComputeSpatialTilesetBaseUrl): SpatialTileTreeReferences {
  const iModel = view.iModel;
  let entry = iModelToBaseUrl.get(iModel);
  if (undefined === entry) {
    const promise = computeBaseUrl(iModel);
    iModelToBaseUrl.set(iModel, entry = promise);
    iModel.onClose.addOnce(() => iModelToBaseUrl.delete(iModel));
    promise.then((url: URL | undefined) => {
      if (iModelToBaseUrl.has(iModel))
        iModelToBaseUrl.set(iModel, url ?? null);
    }).catch(() => {
      if (iModelToBaseUrl.has(iModel))
        iModelToBaseUrl.set(iModel, null);
    });
  }

  if (null === entry) {
    // No tileset exists for this iModel - use default tile generation instead.
    return createSpatialTileTreeReferences(view);
  }

  if (entry instanceof Promise)
    return new ProxySpatialTileTreeReferences(view, entry);

  return new BatchedSpatialTileTreeReferences(entry, view);
}

