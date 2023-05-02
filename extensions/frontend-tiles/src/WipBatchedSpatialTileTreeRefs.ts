/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RenderSchedule } from "@itwin/core-common";
import {
  AttachToViewportArgs, IModelConnection, SpatialTileTreeReferences, SpatialViewState, TileTreeLoadStatus, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { AnimatedBatchedTileTreeReference, PrimaryBatchedTileTreeReference, } from "./WipBatchedTileTreeReference";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";
import { BatchedModels } from "./BatchedModels";
import { ComputeSpatialTilesetBaseUrl, createFallbackSpatialTileTreeReferences } from "./FrontendTiles";

// Obtains tiles pre-published by mesh export service.
class BatchedSpatialTileTreeReferences implements SpatialTileTreeReferences {
  private readonly _view: SpatialViewState;
  private readonly _models: BatchedModels;
  private _currentScript?: RenderSchedule.Script;
  private _primaryRef: PrimaryBatchedTileTreeReference;
  private readonly _animatedRefs: AnimatedBatchedTileTreeReference[] = [];
  private _onModelSelectorChanged?: () => void;

  public constructor(baseUrl: URL, view: SpatialViewState) {
    this._view = view;
    this._models = new BatchedModels(view);

    const script = view.displayStyle.scheduleScript;
    this._currentScript = script?.requiresBatching ? script : undefined;

    const treeOwner = getBatchedTileTreeOwner(view.iModel, { baseUrl, script: this._currentScript });
    this._primaryRef = new PrimaryBatchedTileTreeReference(treeOwner, this._models);

    // ###TODO populate animated references

    // ###TODO listen for changes to script and display style to update tree refs when script changes.
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    yield this._primaryRef;

    for (const animatedRef of this._animatedRefs)
      yield animatedRef;
  }

  public update(): void {
    this._models.setViewedModels(this._view.modelSelector.models);

    // ###TODO update animated references

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
    // ###TODO
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
        this.setTreeRefs(createFallbackSpatialTileTreeReferences(view));
      }
    }).catch(() => {
      this.setTreeRefs(createFallbackSpatialTileTreeReferences(view));
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
    return createFallbackSpatialTileTreeReferences(view);
  }

  if (entry instanceof Promise)
    return new ProxySpatialTileTreeReferences(view, entry);

  return new BatchedSpatialTileTreeReferences(entry, view);
}
