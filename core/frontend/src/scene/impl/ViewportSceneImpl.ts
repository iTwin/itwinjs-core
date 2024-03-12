/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, Guid } from "@itwin/core-bentley";
import { ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { CreateSpatialSceneArgs, Model2dScene, SpatialScene, ViewportScene } from "../ViewportScene";
import { BaseIModelViewImpl, createIModelView, IModelSpatialViewImpl, SpatialViewSceneObjectImpl } from "./IModelViewImpl";
import { ScenePresentation3dImpl, BaseScenePresentationImpl, ScenePresentationImpl, PresentationSceneObjectImpl } from "./ScenePresentationImpl";
import { SceneVolume3dImpl, SceneVolumeImpl } from "./SceneVolumeImpl";
import { SpatialViewState } from "../../SpatialViewState";
import { SubCategoriesCache } from "../../SubCategoriesCache";
import { IModelViewSceneObject, PresentationSceneObject, SceneObject } from "../SceneObject";

export abstract class ViewportSceneImpl implements ViewportScene {
  readonly backingView: ViewState;
  private readonly _subcategories = new SubCategoriesCache.Queue();

  readonly tiledGraphicsProviders = [] as any; // ###TODO
  readonly decorators = [] as any; // ###TODO
  
  abstract isSpatial(): this is SpatialScene;
  abstract is2dModel(): this is Model2dScene;
  
  abstract get presentationObject(): PresentationSceneObject;
  abstract get presentation(): ScenePresentationImpl;
  abstract get volume(): SceneVolumeImpl;
  abstract get iModels(): Iterable<IModelViewSceneObject>;
  
  protected constructor(view: ViewState) {
    this.backingView = view;
  }

  dispose(): void {
    this._subcategories.dispose();
  }

  abstract [Symbol.iterator](): Iterator<SceneObject>;
  
  protected * _iterator(): Iterable<SceneObject> {
    yield this.presentationObject;

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
  readonly presentationObject: PresentationSceneObjectImpl<ScenePresentation3dImpl, SpatialScene>;

  override get presentation(): ScenePresentation3dImpl {
    return this.presentationObject.presentation;
  }

  readonly realityModels = [] as any; // ###TODO
  readonly iModels = [] as any; // ###TODO
  readonly map?: any; // ###TODO

  constructor(args: CreateSpatialSceneArgs) {
    super(args.view);

    this.volume = new SceneVolume3dImpl(args.view);
    const presentation = new ScenePresentation3dImpl(args.view);
    const presentationGuid = args.presentationGuid ?? Guid.createValue();
    this.presentationObject = new PresentationSceneObjectImpl<ScenePresentation3dImpl, SpatialScene>(presentation, presentationGuid, this);

    // ###TODO initialize this.map
  }

  *[Symbol.iterator]() {
    for (const obj of this._iterator())
      yield obj;

    for (const realityModel of this.realityModels)
      yield realityModel;

    yield this.map;
  }
}

export function createSpatialScene(args: CreateSpatialSceneArgs): SpatialSceneImpl {
  return new SpatialSceneImpl(args);
}

export function createViewportScene(view: ViewState): ViewportScene {
  if (!view.isSpatialView())
    throw new Error("###TODO non-spatial scenes");

  const scene = createSpatialScene({ view });
  // ###TODO populate it from ViewState
  return scene;
}
