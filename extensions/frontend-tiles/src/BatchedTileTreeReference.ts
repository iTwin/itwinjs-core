/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";
import { BatchType, FeatureAppearance, FeatureAppearanceProvider, FeatureAppearanceSource, GeometryClass } from "@itwin/core-common";
import {
  AttachToViewportArgs, SpatialViewState, TileTreeOwner, TileTreeReference,
} from "@itwin/core-frontend";
import { getBatchedTileTreeOwner } from "./BatchedTileTreeSupplier";

/** @internal */
export class BatchedTileTreeReference extends TileTreeReference implements FeatureAppearanceProvider {
  private readonly _treeOwner: TileTreeOwner;
  private readonly _view: SpatialViewState;
  private readonly _viewedModels = new Id64.Uint32Set();
  private _onModelSelectorChanged?: () => void;

  private constructor(treeOwner: TileTreeOwner, view: SpatialViewState) {
    super();
    this._treeOwner = treeOwner;
    this._view = view;
  }

  public static create(view: SpatialViewState, baseUrl: URL): BatchedTileTreeReference {
    const owner = getBatchedTileTreeOwner(view.iModel, baseUrl);
    return new BatchedTileTreeReference(owner, view);
  }

  public override get treeOwner(): TileTreeOwner {
    return this._treeOwner;
  }

  public attachToViewport(args: AttachToViewportArgs): void {
    this._onModelSelectorChanged = () => args.invalidateSymbologyOverrides;
    this.updateViewedModels();
  }

  public detachFromViewport(): void {
    this._onModelSelectorChanged = undefined;
  }

  public updateViewedModels(): void {
    this._viewedModels.clear();
    this._viewedModels.addIds(this._view.modelSelector.models);
    if (this._onModelSelectorChanged)
      this._onModelSelectorChanged();
  }

  public override getAppearanceProvider(): FeatureAppearanceProvider | undefined {
    return this._onModelSelectorChanged ? this : undefined;
  }

  public getFeatureAppearance(
    source: FeatureAppearanceSource,
    elemLo: number, elemHi: number,
    subcatLo: number, subcatHi: number,
    geomClass: GeometryClass,
    modelLo: number, modelHi: number,
    type: BatchType,
    animationNodeId: number
  ): FeatureAppearance | undefined {
    // ###TODO: Until MultiModelPackedFeatureTable is hooked up we'll always get the transient model Id - remove check after that.
    if (modelHi !== 0xffffff00 && !this._viewedModels.has(modelLo, modelHi))
      return undefined;

    return source.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }
}
