/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { Model2dScene, SpatialScene, ViewportScene } from "../ViewportScene";
import { BaseIModelViewImpl, createIModelView } from "./IModelViewImpl";
import { ScenePresentation3dImpl, BaseScenePresentationImpl, ScenePresentationImpl } from "./ScenePresentationImpl";
import { SceneVolume3dImpl, SceneVolumeImpl } from "./SceneVolumeImpl";
import { SpatialViewState } from "../../SpatialViewState";
import { SubCategoriesCache } from "../../SubCategoriesCache";
import { IModelViewSceneObject, SceneObject } from "../SceneObject";

export abstract class ViewportSceneImpl implements ViewportScene {
  private _backingView: BaseIModelViewImpl;
  private readonly _subcategories = new SubCategoriesCache.Queue();

  readonly tiledGraphicsProviders = [] as any; // ###TODO
  readonly decorators = [] as any; // ###TODO
  

  /** An IModelView created from the ViewState supplied to the constructor.
   * this.presentation and this.volume are created from the same ViewState.
   * Unless the view refers to a blank iModel, this view is also added to this.iModels.
   * This is used as a shim for deprecated Viewport methods+properties like Viewport.iModel, Viewport.perModelCategoryVisibility, etc.
   */
  get backingView(): BaseIModelViewImpl { return this._backingView; }

  abstract isSpatial(): this is SpatialScene;
  abstract is2dModel(): this is Model2dScene;
  
  abstract get presentation(): ScenePresentationImpl;
  abstract get volume(): SceneVolumeImpl;
  abstract get iModels(): Iterable<IModelViewSceneObject>;
  
  protected constructor(view: ViewState) {
    this._backingView = createIModelView(view);
  }

  dispose(): void {
    this._subcategories.dispose();
  }

  abstract [Symbol.iterator](): Iterator<SceneObject>;
  
  protected * _iterator(): Iterable<SceneObject> {
    // ###TODO as a PresentationSceneObject yield this.presentation;
    for (const iModel of this.iModels)
      yield iModel;

    for (const provider of this.tiledGraphicsProviders)
      yield provider;

    for (const decorator of this.decorators)
      yield decorator;
  }
}

// ###TODO rework this to subclass ViewportSceneImpl
export class SpatialSceneImpl extends ViewportSceneImpl implements SpatialScene {
  override isSpatial(): this is SpatialScene { return true; }
  override is2dModel() { return false; }
  
  readonly volume: SceneVolume3dImpl;
  readonly presentation: ScenePresentation3dImpl;

  readonly realityModels = [] as any; // ###TODO
  readonly iModels = [] as any; // ###TODO
  readonly map?: any; // ###TODO

  constructor(view: SpatialViewState) {
    super(view);

    this.volume = new SceneVolume3dImpl(view);
    this.presentation = new ScenePresentation3dImpl(view);
  }

  *[Symbol.iterator]() {
    for (const obj of this._iterator())
      yield obj;

    for (const realityModel of this.realityModels)
      yield realityModel;

    yield this.map;
  }
}

export function createViewportScene(view: ViewState): ViewportScene {
  if (view.isSpatialView())
    return new SpatialSceneImpl(view);

  throw new Error("###TODO non-spatial scenes");
}
