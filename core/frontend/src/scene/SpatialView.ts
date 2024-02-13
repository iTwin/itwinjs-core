/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "../IModelConnection";
import { View3d } from "./View";
import { ComputeSpatialViewFitRangeOptions } from "../SpatialViewState";
import { AxisAlignedBox3d } from "@itwin/core-common";
import { GeometricModel3dState, GeometricModelState } from "../ModelState";

export abstract class ViewModelSelector {
  /** @internal */
  protected constructor() { }

  abstract get iModel(): IModelConnection;

  abstract models: Set<Id64String>;

  equalState(other: ViewModelSelector): boolean {
    if (this.models.size !== other.models.size)
      return false;

    for (const model of this.models)
      if (!other.models.has(model))
        return false;

    return true;
  }

  addModels(arg: Id64Arg): void {
    for (const id of Id64.iterable(arg))
      this.models.add(id);
  }

  dropModels(arg: Id64Arg): void {
    for (const id of Id64.iterable(arg))
      this.models.delete(id);
  }

  has(id: Id64String): boolean {
    return this.models.has(id);
  }

  containsModel(modelId: Id64String): boolean {
    return this.has(modelId);
  }
}

export abstract class SpatialView extends View3d {
  /** @internal */
  protected constructor() { super(); }

  abstract modelSelector: ViewModelSelector;

  override isSpatialView(): this is SpatialView { return true; }

  abstract computeSpatialFitRange(options?: ComputeSpatialViewFitRangeOptions): AxisAlignedBox3d;
  
  public viewsModel(modelId: Id64String): boolean { return this.modelSelector.containsModel(modelId); }
  public clearViewedModels() { this.modelSelector.models.clear(); }
  public addViewedModel(id: Id64String) { this.modelSelector.addModels(id); }
  public removeViewedModel(id: Id64String) { this.modelSelector.dropModels(id); }

  public forEachModel(func: (model: GeometricModelState) => void) {
    for (const modelId of this.modelSelector.models) {
      const model = this.iModel.models.getLoaded(modelId);
      if (undefined !== model && undefined !== model.asGeometricModel3d)
        func(model as GeometricModel3dState);
    }
  }
}
