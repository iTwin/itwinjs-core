/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { SpatialScene, ViewportScene } from "../ViewportScene";
import { IIModelViewImpl, createIModelView } from "./IModelViewImpl";
import { ScenePresentation3dImpl, ScenePresentationImpl } from "./ScenePresentationImpl";
import { SceneVolume3dImpl, SceneVolumeImpl } from "./SceneVolumeImpl";
import { SpatialViewState } from "../../SpatialViewState";
import { SubCategoriesCache } from "../../SubCategoriesCache";

export abstract class ViewportSceneImpl {
  private _primaryView: IIModelViewImpl;
  private readonly _subcategories = new SubCategoriesCache.Queue();

  readonly tiledGraphicsProviders = []; // ###TODO

  /** An IModelView created from the ViewState supplied to the constructor.
   * this.presentation and this.volume are created from the same ViewState.
   * Unless the view refers to a blank iModel, this view is also added to this.iModels.
   * This is used as a shim for deprecated Viewport methods+properties like Viewport.iModel, Viewport.perModelCategoryVisibility, etc.
   */
  get primaryView(): IIModelViewImpl { return this._primaryView; }

  abstract get presentation(): ScenePresentationImpl;
  abstract get volume(): SceneVolumeImpl;
  
  protected constructor(view: ViewState) {
    this._primaryView = createIModelView(view);
  }

  dispose(): void {
    this._subcategories.dispose();
  }
}

// ###TODO rework this to subclass ViewportSceneImpl
export class SpatialSceneImpl extends ViewportSceneImpl implements SpatialScene {
  readonly isSpatial = true;
  readonly volume: SceneVolume3dImpl;
  readonly presentation: ScenePresentation3dImpl;

  readonly realityModels = []; // ###TODO
  readonly iModels = []; // ###TODO

  constructor(view: SpatialViewState) {
    super(view);

    this.volume = new SceneVolume3dImpl(view);
    this.presentation = new ScenePresentation3dImpl(view);
  }
}

export function createViewportScene(view: ViewState): ViewportScene {
  if (view.isSpatialView())
    return new SpatialSceneImpl(view);

  throw new Error("###TODO non-spatial scenes");
}
