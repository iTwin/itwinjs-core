/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { SpatialViewState } from "@itwin/core-frontend";
import { ModelMetadata } from "./BatchedTilesetReader";

export class BatchedModels {
  private _viewedModels!: Set<Id64String>;
  private readonly _viewedExtents = new Range3d();
  private readonly _viewedModelIdPairs = new Id64.Uint32Set();
  private readonly _metadata: Map<Id64String, ModelMetadata>;

  public constructor(view: SpatialViewState, metadata: Map<Id64String, ModelMetadata>) {
    this._metadata = metadata;
    this.setViewedModels(view.modelSelector.models);
  }

  public setViewedModels(models: Set<Id64String>): void {
    this._viewedModels = models;
    this._viewedModelIdPairs.clear();
    this._viewedModelIdPairs.addIds(models);
    this._viewedExtents.setNull();

    for (const modelId of models) {
      const range = this._metadata.get(modelId)?.extents;
      if (range)
        this._viewedExtents.extendRange(range);
    }
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
