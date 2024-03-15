/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeEvent, Guid } from "@itwin/core-bentley";
import { ViewState, ViewState2d } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { CreateViewportSceneArgs, Model2dScene, SpatialScene, ViewportScene } from "../ViewportScene";
import { BaseIModelViewImpl, IModelSpatialViewImpl, SpatialViewSceneObjectImpl, SpatialViewSceneObjectsImpl, View2dImpl, View2dSceneObjectImpl } from "./IModelViewImpl";
import { ScenePresentation2dImpl, ScenePresentation3dImpl, BaseScenePresentationImpl, ScenePresentationImpl, PresentationSceneObjectImpl } from "./ScenePresentationImpl";
import { SceneVolume2dImpl, SceneVolume3dImpl, SceneVolumeImpl } from "./SceneVolumeImpl";
import { SpatialViewState } from "../../SpatialViewState";
import { SubCategoriesCache } from "../../SubCategoriesCache";
import { IModelView2dSceneObject, IModelViewSceneObject, PresentationSceneObject, SceneObject, TiledGraphicsSceneObjects } from "../SceneObject";
import { TiledGraphicsSceneObjectsImpl } from "./TiledGraphicsSceneObjectImpl";
import { SceneContext } from "../../ViewContext";
import { Decorations } from "../../core-frontend";

export abstract class ViewportSceneImpl implements ViewportScene {
  readonly onContentsChanged = new BeEvent<(object: SceneObject, change: "add" | "delete") => void>;
  readonly onObjectDisplayChanged = new BeEvent<(object: SceneObject) => void>();
  
  readonly backingView: ViewState;
  readonly viewport: Viewport;
  private readonly _subcategories = new SubCategoriesCache.Queue();

  readonly tiledGraphics: TiledGraphicsSceneObjects;
  readonly decorators = [] as any; // ###TODO
  
  abstract isSpatial(): this is SpatialScene;
  abstract is2dModel(): this is Model2dScene;
  
  abstract get presentationObject(): PresentationSceneObject;
  abstract get presentation(): ScenePresentationImpl;
  abstract get volume(): SceneVolumeImpl;
  // abstract get iModels(): Iterable<IModelViewSceneObject>;
  
  protected constructor(viewport: Viewport, view: ViewState) {
    this.backingView = view;
    this.viewport = viewport;

    this.tiledGraphics = new TiledGraphicsSceneObjectsImpl(this);

    this.onObjectDisplayChanged.addListener(() => this.viewport.invalidateScene());
    this.onContentsChanged.addListener(() => this.viewport.invalidateScene());
  }

  dispose(): void {
    this._subcategories.dispose();
  }

  abstract [Symbol.iterator](): Iterator<SceneObject>;
  
  protected * _iterator(): Iterable<SceneObject> {
    yield this.presentationObject;

    for (const provider of this.tiledGraphics)
      yield provider;

    for (const decorator of this.decorators)
      yield decorator;
  }

  draw(context: SceneContext) {
    for (const object of this)
      object.draw(context);
  }

  decorate(): Decorations {
    const decorations = new Decorations();
    // ###TODO
    return decorations;
  }
}

export class SpatialSceneImpl extends ViewportSceneImpl implements SpatialScene {
  override isSpatial(): this is SpatialScene { return true; }
  override is2dModel(): this is Model2dScene { return false; }
  
  readonly volume: SceneVolume3dImpl;
  readonly presentationObject: PresentationSceneObjectImpl<ScenePresentation3dImpl, SpatialScene>;

  override get presentation(): ScenePresentation3dImpl {
    return this.presentationObject.presentation;
  }

  readonly realityModels = [] as any; // ###TODO
  readonly iModels: SpatialViewSceneObjectsImpl;
  readonly map?: any; // ###TODO

  constructor(viewport: Viewport, args: CreateViewportSceneArgs) {
    assert(args.view.isSpatialView());
    super(viewport, args.view);

    this.volume = new SceneVolume3dImpl(args.view);

    const presentation = new ScenePresentation3dImpl(args.view);
    const presentationGuid = args.presentationGuid ?? Guid.createValue();
    this.presentationObject = new PresentationSceneObjectImpl<ScenePresentation3dImpl, SpatialScene>(presentation, presentationGuid, this);

    this.iModels = new SpatialViewSceneObjectsImpl(this);
    
    // ###TODO initialize this.map

    if (!args.view.iModel.isBlank) {
      const viewGuid = args.iModelViewGuid ?? Guid.createValue();
      this.iModels.add(new IModelSpatialViewImpl(args.view), { guid: viewGuid });
    }

    // ###TODO initialize this.realityModels
  }

  *[Symbol.iterator]() {
    for (const obj of this._iterator())
      yield obj;

    for (const iModel of this.iModels)
      yield iModel;
    
    for (const realityModel of this.realityModels)
      yield realityModel;

    yield this.map;
  }
}

export class Model2dSceneImpl extends ViewportSceneImpl implements Model2dScene {
  override isSpatial(): this is SpatialScene { return false; }
  override is2dModel(): this is Model2dScene { return true; }

  readonly volume: SceneVolume2dImpl;
  readonly presentationObject: PresentationSceneObjectImpl<ScenePresentation2dImpl, Model2dScene>;
  readonly viewObject: View2dSceneObjectImpl;

  constructor(viewport: Viewport, args: CreateViewportSceneArgs) {
    assert(args.view.is2d());
    super(viewport, args.view);

    this.volume = new SceneVolume2dImpl(args.view);

    const presentation = new ScenePresentation2dImpl(args.view);
    const presentationGuid = args.presentationGuid ?? Guid.createValue();
    this.presentationObject = new PresentationSceneObjectImpl<ScenePresentation2dImpl, Model2dScene>(presentation, presentationGuid, this);

    const viewGuid = args.iModelViewGuid ?? Guid.createValue();
    const view = new View2dImpl(args.view);
    this.viewObject = new View2dSceneObjectImpl(view, viewGuid, this);
  }

  get view(): ViewState2d {
    assert(this.backingView.is2d());
    assert(this.backingView === this.viewObject.view.impl);
    return this.backingView;
  }

  override get presentation(): ScenePresentation2dImpl {
    return this.presentationObject.presentation;
  }

  *[Symbol.iterator]() {
    for (const obj of this._iterator())
      yield obj;

    yield this.viewObject;
  }
}

export function createViewportScene(viewport: Viewport, args: CreateViewportSceneArgs): ViewportScene {
  if (args.view.isSpatialView())
    return new SpatialSceneImpl(viewport, args);

  assert(args.view.is2d());
  return new Model2dSceneImpl(viewport, args);
}
