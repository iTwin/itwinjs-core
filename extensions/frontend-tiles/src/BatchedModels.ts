/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { ModelExtentsProps } from "@itwin/core-common";
import { IModelConnection, SpatialViewState } from "@itwin/core-frontend";

export class BatchedModels {
  private readonly _iModel: IModelConnection;
  private _viewedModels!: Set<Id64String>;
  private readonly _viewedModelIdPairs = new Id64.Uint32Set();
  private readonly _modelRanges = new Map<Id64String, Range3d>();
  private _modelRangePromise?: Promise<void>;

  public constructor(view: SpatialViewState) {
    this._iModel = view.iModel;
    this.setViewedModels(view.modelSelector.models);
  }

  public setViewedModels(models: Set<Id64String>): void {
    this._viewedModels = models;
    this._viewedModelIdPairs.clear();
    this._viewedModelIdPairs.addIds(models);

    this._modelRangePromise = undefined;
    const modelIds = Array.from(models).filter((modelId) => !this._modelRanges.has(modelId));
    if (modelIds.length === 0)
      return;

    const modelRangePromise = this._modelRangePromise = this._iModel.models.queryExtents(modelIds).then((extents: ModelExtentsProps[]) => {
      if (modelRangePromise !== this._modelRangePromise)
        return;

      this._modelRangePromise = undefined;
      for (const extent of extents)
        this._modelRanges.set(extent.id, Range3d.fromJSON(extent.extents));
    }).catch(() => { });
  }

  public views(modelId: Id64String): boolean {
    return this._viewedModels.has(modelId);
  }

  public isViewed(modelIdLo: number, modelIdHi: number): boolean {
    return this._viewedModelIdPairs.has(modelIdLo, modelIdHi);
  }

  public unionRange(range: Range3d): void {
    for (const id of this._viewedModels) {
      const extent = this._modelRanges.get(id);
      if (extent)
        range.extendRange(extent);
    }
  }
}
