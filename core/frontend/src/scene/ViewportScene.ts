/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, GuidString } from "@itwin/core-bentley";
import {
  DecoratorSceneObjects, MapSceneObject, RealityModelSceneObjects, SceneObject, SpatialViewSceneObjects, IModelView2dSceneObject, TiledGraphicsSceneObjects, SceneRealityModelProps,
} from "./SceneObject";
import { ScenePresentation, ScenePresentation2d, ScenePresentation3d } from "./ScenePresentation";
import { SceneVolume, SceneVolume3d } from "./SceneVolume";
import { ViewState, ViewState2d } from "../ViewState";
import { Decorations } from "../render/Decorations";
import { SceneContext } from "../ViewContext";
import { Viewport } from "../Viewport";
import { SpatialViewState } from "../SpatialViewState";
import { createSpatialScene, createViewportScene } from "./impl/ViewportSceneImpl";

export interface ViewportScene extends Iterable<SceneObject> {
  /** An IModelView created from the ViewState supplied to the constructor.
   * this.presentation and this.volume are created from the same ViewState.
   * This is used as a shim for deprecated Viewport methods+properties like Viewport.iModel, Viewport.perModelCategoryVisibility, etc.
   * @internal
   */
  readonly backingView: ViewState;

  isSpatial(): this is SpatialScene;
  is2dModel(): this is Model2dScene;

  readonly volume: SceneVolume;
  readonly presentation: ScenePresentation;
  // readonly iModels: Iterable<IModelViewSceneObject>; // ###TODO needed, or just confusing for 2d?
  readonly tiledGraphics: TiledGraphicsSceneObjects;
  readonly decorators: DecoratorSceneObjects;

  dispose(): void;

  readonly onContentsChanged: BeEvent<(object: SceneObject, change: "add" | "delete") => void>;
  readonly onObjectDisplayChanged: BeEvent<(object: SceneObject) => void>;

  /** @internal */
  draw(context: SceneContext): void;

  /** @internal */
  decorate(): Decorations;

  /** @internal */
  attachToViewport(viewport: Viewport): void;

  /** @internal */
  detachFromViewport(): void;

  /** @internal */
  changeBackingView(view: ViewState): ViewportScene;
}

export interface SpatialScene extends ViewportScene {
  readonly volume: SceneVolume3d;
  readonly presentation: ScenePresentation3d;
  readonly iModels: SpatialViewSceneObjects;
  readonly realityModels: RealityModelSceneObjects;
  readonly map?: MapSceneObject;
}

export interface Model2dScene extends ViewportScene {
  readonly volume: SceneVolume;
  readonly presentation: ScenePresentation2d;
  readonly viewObject: IModelView2dSceneObject;
  // ###TODO refine this
  readonly view: ViewState2d;
  // readonly iModels: Iterable<IModelView2dSceneObject>;
}

// ###TODO export interface DrawingModelScene extends Model2dScene
// ###TODO export interface SheetModelScene extends Model2dScene

export interface CreateViewportSceneArgs {
  view: ViewState;
  iModelViewGuid?: GuidString;
  presentationGuid?: GuidString;
}

export interface CreateSpatialSceneArgs extends CreateViewportSceneArgs {
  view: SpatialViewState;
  mapGuid?: GuidString;
  getRealityModelGuid?: (args: { props: SceneRealityModelProps, index: number }) => GuidString | undefined;
}

export interface CreateModel2dSceneArgs extends CreateViewportSceneArgs {
  view: ViewState2d;
}

export namespace ViewportScene {
  export function create(args: CreateViewportSceneArgs): ViewportScene {
    return createViewportScene(args);
  }

  export function createSpatial(args: CreateSpatialSceneArgs): SpatialScene {
    return createSpatialScene(args);
  }
}
