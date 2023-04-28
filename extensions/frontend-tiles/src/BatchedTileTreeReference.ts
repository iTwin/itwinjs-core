/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import {
  BatchType,
  FeatureAppearance,
  FeatureAppearanceProvider,
  FeatureAppearanceSource,
  GeometryClass,
  ModelExtentsProps,
} from "@itwin/core-common";
import {
  AttachToViewportArgs,
  SpatialViewState,
  TileTreeOwner,
  TileTreeReference,
} from "@itwin/core-frontend";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";

/** @internal */
export class BatchedTileTreeReference
  extends TileTreeReference
  implements FeatureAppearanceProvider
{
  private readonly _treeOwner: TileTreeOwner;
  private readonly _view: SpatialViewState;
  private readonly _viewedModels = new Id64.Uint32Set();
  private readonly _modelRanges = new Map<Id64String, Range3d>();
  private _modelRangePromise?: Promise<void>;
  private _onModelSelectorChanged?: () => void;

  private constructor(treeOwner: TileTreeOwner, view: SpatialViewState) {
    super();
    this._treeOwner = treeOwner;
    this._view = view;
  }

  public static create(
    view: SpatialViewState,
    baseUrl: URL
  ): BatchedTileTreeReference {
    const owner = getBatchedTileTreeOwner(view.iModel, baseUrl);
    return new BatchedTileTreeReference(owner, view);
  }

  public override get treeOwner(): TileTreeOwner {
    return this._treeOwner;
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._onModelSelectorChanged = () => args.invalidateSymbologyOverrides();
    this.updateViewedModels();
  }

  public detachFromViewport(): void {
    this._onModelSelectorChanged = undefined;
  }

  public updateViewedModels(): void {
    this._viewedModels.clear();
    this._viewedModels.addIds(this._view.modelSelector.models);
    if (!this._onModelSelectorChanged) {
      // Don't bother updating model ranges if we're not attached to a viewport.
      return;
    }

    this._onModelSelectorChanged();

    this._modelRangePromise = undefined;
    const modelIds = Array.from(this._view.modelSelector.models).filter(
      (modelId) => !this._modelRanges.has(modelId)
    );
    if (modelIds.length === 0) return;

    const modelRangePromise = (this._modelRangePromise =
      this._treeOwner.iModel.models
        .queryExtents(modelIds)
        .then((extents: ModelExtentsProps[]) => {
          if (modelRangePromise !== this._modelRangePromise) return;

          this._modelRangePromise = undefined;
          for (const extent of extents)
            this._modelRanges.set(extent.id, Range3d.fromJSON(extent.extents));
        })
        .catch(() => {}));
  }

  public override unionFitRange(union: Range3d): void {
    this._viewedModels.forEach((low: number, high: number) => {
      const id = Id64.fromUint32Pair(low, high);
      const extent = this._modelRanges.get(id);
      if (extent) union.extendRange(extent);
    });
  }

  public override getAppearanceProvider():
    | FeatureAppearanceProvider
    | undefined {
    return this._onModelSelectorChanged ? this : undefined;
  }

  public getFeatureAppearance(
    source: FeatureAppearanceSource,
    elemLo: number,
    elemHi: number,
    subcatLo: number,
    subcatHi: number,
    geomClass: GeometryClass,
    modelLo: number,
    modelHi: number,
    type: BatchType,
    animationNodeId: number
  ): FeatureAppearance | undefined {
    // ###TODO: Until MultiModelPackedFeatureTable is hooked up we'll always get the transient model Id - remove check after that.
    if (modelHi !== 0xffffff00 && !this._viewedModels.has(modelLo, modelHi))
      return undefined;

    return source.getAppearance(
      elemLo,
      elemHi,
      subcatLo,
      subcatHi,
      geomClass,
      modelLo,
      modelHi,
      type,
      animationNodeId
    );
  }
}
