/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { SpatialViewState } from "@itwin/core-frontend";

export class BatchedModels {
  private _viewedModels!: Set<Id64String>;
  private readonly _viewedExtents = new Range3d();
  private readonly _viewedModelIdPairs = new Id64.Uint32Set();
  private readonly _ranges: Map<Id64String, Range3d>;

  public constructor(view: SpatialViewState, ranges: Map<Id64String, Range3d>) {
    this._ranges = ranges;
    this.setViewedModels(view.modelSelector.models);
  }

  public setViewedModels(models: Set<Id64String>): void {
    this._viewedModels = models;
    this._viewedModelIdPairs.clear();
    this._viewedModelIdPairs.addIds(models);
    this._viewedExtents.setNull();

    for (const modelId of models) {
      const range = this._ranges.get(modelId);
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
