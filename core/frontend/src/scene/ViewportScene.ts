/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { GuidString } from "@itwin/core-bentley";
import { DecoratorSceneObjects, IModelViewSceneObject, MapSceneObject, RealityModelSceneObjects, SceneObject, SpatialViewSceneObjects, IModelView2dSceneObject, TiledGraphicsSceneObjects } from "./SceneObject";
import { ScenePresentation, ScenePresentation2d, ScenePresentation3d } from "./ScenePresentation";
import { SceneVolume, SceneVolume3d } from "./SceneVolume";
import { SpatialViewState } from "../SpatialViewState";
import { ViewState } from "../ViewState";
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
 readonly tiledGraphicsProviders: TiledGraphicsSceneObjects;
 readonly decorators: DecoratorSceneObjects;

 dispose(): void;
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
 readonly view: IModelView2dSceneObject;
 // readonly iModels: Iterable<IModelView2dSceneObject>;
}

// ###TODO export interface DrawingModelScene extends Model2dScene
// ###TODO export interface SheetModelScene extends Model2dScene

export interface CreateSpatialSceneArgs {
 view: SpatialViewState;
 mapGuid?: GuidString;
 presentationGuid?: GuidString;
}

export namespace ViewportScene {
 export function createSpatial(args: CreateSpatialSceneArgs): SpatialScene {
  return createSpatialScene(args);
 }

 export function fromViewState(view: ViewState): ViewportScene {
  return createViewportScene(view);
 }
}
