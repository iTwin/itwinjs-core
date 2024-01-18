/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";
import {
  AnimationNodeId,
  AttachToViewportArgs, createSpatialTileTreeReferences, IModelConnection, SpatialTileTreeReferences, SpatialViewState,
  TileTreeLoadStatus, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import {  BatchedTileTreeReference, BatchedTileTreeReferenceArgs  } from "./BatchedTileTreeReference";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";
import { BatchedModels } from "./BatchedModels";
import { ComputeSpatialTilesetBaseUrl } from "./FrontendTiles";
import { BatchedTilesetSpec } from "./BatchedTilesetReader";
import { loggerCategory } from "./LoggerCategory";
import { BatchedModelGroups } from "./BatchedModelGroups";

// Obtains tiles pre-published by mesh export service.
class BatchedSpatialTileTreeReferences implements SpatialTileTreeReferences {
  private readonly _view: SpatialViewState;
  private readonly _models: BatchedModels;
  private readonly _groups: BatchedModelGroups;
  private readonly _spec: BatchedTilesetSpec;
  private _treeOwner: TileTreeOwner;
  private _refs: BatchedTileTreeReference[] = [];
  private _currentScript?: RenderSchedule.Script;
  private _onModelSelectorChanged?: () => void;
  /** Provides tile trees for models that are not included in the batched tile set. */
  private readonly _excludedRefs: SpatialTileTreeReferences;
  private _removeSceneInvalidationListener?: () => void;

  public constructor(spec: BatchedTilesetSpec, view: SpatialViewState) {
    this._view = view;
    this._models = new BatchedModels(view, spec.models);
    this._spec = spec;

    const script = view.displayStyle.scheduleScript;
    this._currentScript = script?.requiresBatching ? script : undefined;

    const includedModels = new Set(spec.models.keys());
    this._excludedRefs = createSpatialTileTreeReferences(view, includedModels);

    this._groups = new BatchedModelGroups(view, this._currentScript, includedModels, spec.models);
    this._treeOwner = this.getTreeOwner();
    this.loadRefs();

    this.listenForScriptChange();
  }

  private ensureLoaded(): void {
    if (!this._groups.update())
      return;

    this._treeOwner = this.getTreeOwner();
    this.loadRefs();
  }

  private getTreeOwner(): TileTreeOwner {
    return getBatchedTileTreeOwner(this._view.iModel, {
      spec: this._spec,
      script: this._currentScript,
      modelGroups: this._groups.guid,
    });
  }

  private listenForScriptChange(): void {
    const onScriptChanged = (newScript: RenderSchedule.Script | undefined) => {
      if (!newScript?.requiresBatching)
        newScript = undefined;

      const currentScript = this._currentScript;
      this._currentScript = newScript;

      if (newScript !== currentScript)
        if (!newScript || !currentScript || !newScript.equals(currentScript))
          this._groups.setScript(newScript);
    };

    let rmListener = this._view.displayStyle.onScheduleScriptChanged.addListener((newScript) => onScriptChanged(newScript));
    this._view.onDisplayStyleChanged.addListener((newStyle) => {
      rmListener();
      onScriptChanged(newStyle.scheduleScript);
      rmListener = this._view.displayStyle.onScheduleScriptChanged.addListener((newScript) => onScriptChanged(newScript));
    });
  }

  private loadRefs(): void {
    this._refs.length = 0;
    const groups = this._groups.groups;
    const args: BatchedTileTreeReferenceArgs = {
      models: this._models,
      groups,
      treeOwner: this._treeOwner,
      getCurrentTimePoint: () => this._currentScript ? (this._view.displayStyle.settings.timePoint ?? this._currentScript.duration.low) : 0,
    };

    for (let i = 0; i < groups.length; i++) {
      const timeline = groups[i].timeline;
      this._refs.push(new BatchedTileTreeReference(args, i, timeline ? AnimationNodeId.Untransformed : undefined));
      if (timeline) {
        for (const nodeId of timeline.transformBatchIds)
          this._refs.push(new BatchedTileTreeReference(args, i, nodeId));
      }
    }
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    this.ensureLoaded();
    for (const ref of this._refs)
      yield ref;

    for (const ref of this._excludedRefs)
      yield ref;
  }

  public update(): void {
    this._excludedRefs.update();
    this._models.setViewedModels(this._view.modelSelector.models);
    if (this._onModelSelectorChanged)
      this._onModelSelectorChanged();
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._onModelSelectorChanged = () => args.invalidateSymbologyOverrides();
    this._excludedRefs.attachToViewport(args);
    this._removeSceneInvalidationListener = args.onSceneInvalidated.addListener(() => this._groups.invalidateTransforms());
  }

  public detachFromViewport(): void {
    this._onModelSelectorChanged = undefined;
    this._excludedRefs.detachFromViewport();

    if (this._removeSceneInvalidationListener) {
      this._removeSceneInvalidationListener();
      this._removeSceneInvalidationListener = undefined;
    }
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

  public constructor(view: SpatialViewState, getSpec: Promise<BatchedTilesetSpec | null>) {
    this._proxyRef = new ProxyTileTreeReference(view.iModel);
    getSpec.then((spec: BatchedTilesetSpec | null) => {
      if (spec) {
        this.setTreeRefs(new BatchedSpatialTileTreeReferences(spec, view));
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

const iModelToTilesetSpec = new Map<IModelConnection, BatchedTilesetSpec | null | Promise<BatchedTilesetSpec | null>>();

async function fetchTilesetSpec(iModel: IModelConnection, computeBaseUrl: ComputeSpatialTilesetBaseUrl): Promise<BatchedTilesetSpec | null> {
  try {
    const baseUrl = await computeBaseUrl(iModel);
    if (undefined === baseUrl)
      return null;

    const url = new URL("tileset.json", baseUrl);
    url.search = baseUrl.search;
    const response = await fetch(url.toString());
    const json = await response.json();
    return BatchedTilesetSpec.create(baseUrl, json);
  } catch (err) {
    Logger.logException(loggerCategory, err);
    return null;
  }
}

/** @internal */
export function createBatchedSpatialTileTreeReferences(view: SpatialViewState, computeBaseUrl: ComputeSpatialTilesetBaseUrl): SpatialTileTreeReferences {
  const iModel = view.iModel;
  let entry = iModelToTilesetSpec.get(iModel);
  if (undefined === entry) {
    const promise = entry = fetchTilesetSpec(iModel, computeBaseUrl);
    iModelToTilesetSpec.set(iModel, entry);
    iModel.onClose.addOnce(() => iModelToTilesetSpec.delete(iModel));

    promise.then((spec: BatchedTilesetSpec | null) => {
      if (iModelToTilesetSpec.has(iModel))
        iModelToTilesetSpec.set(iModel, spec);
    }).catch(() => {
      if (iModelToTilesetSpec.has(iModel))
        iModelToTilesetSpec.set(iModel, null);
    });
  }

  if (null === entry) {
    // No tileset could be obtained for this iModel - use default tile generation instead.
    return createSpatialTileTreeReferences(view);
  }

  if (entry instanceof Promise)
    return new ProxySpatialTileTreeReferences(view, entry);

  return new BatchedSpatialTileTreeReferences(entry, view);
}

