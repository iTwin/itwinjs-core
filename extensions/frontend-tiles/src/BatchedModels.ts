/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { ModelExtentsProps } from "@itwin/core-common";
import { IModelConnection, SpatialViewState } from "@itwin/core-frontend";

interface ModelMetadata {
  extents?: Range3d;
}

export class BatchedModels {
  private readonly _iModel: IModelConnection;
  private _viewedModels!: Set<Id64String>;
  private readonly _viewedExtents = new Range3d();
  private readonly _viewedModelIdPairs = new Id64.Uint32Set();
  private readonly _metadata = new Map<Id64String, ModelMetadata>();
  private _modelRangePromise?: Promise<void>;

  public constructor(view: SpatialViewState) {
    this._iModel = view.iModel;
    this.setViewedModels(view.modelSelector.models);
  }

  public setViewedModels(models: Set<Id64String>): void {
    this._viewedModels = models;
    this._viewedModelIdPairs.clear();
    this._viewedModelIdPairs.addIds(models);
    this._viewedExtents.setNull();

    this._modelRangePromise = undefined;
    const rangeQueryModels: Id64String[] = [];

    for (const modelId of models) {
      let metadata = this._metadata.get(modelId);
      if (!metadata)
        this._metadata.set(modelId, metadata = { });

      if (undefined === metadata.extents)
        rangeQueryModels.push(modelId);
      else
        this._viewedExtents.extendRange(metadata.extents);
    }

    if (rangeQueryModels.length === 0)
      return;

    const modelRangePromise = this._modelRangePromise = this._iModel.models.queryExtents(rangeQueryModels).then((extents: ModelExtentsProps[]) => {
      if (modelRangePromise !== this._modelRangePromise)
        return;

      this._modelRangePromise = undefined;
      for (const extent of extents) {
        const metadata = this._metadata.get(extent.id);
        if (metadata) {
          metadata.extents = Range3d.fromJSON(extent.extents);
          this._viewedExtents.extendRange(metadata.extents);
        }
      }
    }).catch(() => { });
  }

  public views(modelId: Id64String): boolean {
    return this._viewedModels.has(modelId);
  }

  public isViewed(modelIdLo: number, modelIdHi: number): boolean {
    return this._viewedModelIdPairs.has(modelIdLo, modelIdHi);
  }

  public unionRange(range: Range3d): void {
    range.extendRange(this._viewedExtents);
  }
}
