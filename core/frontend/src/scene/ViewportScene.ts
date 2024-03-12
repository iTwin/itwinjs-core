/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { DecoratorSceneObjects, IModelViewSceneObject, MapSceneObject, RealityModelSceneObjects, SceneObject, SpatialViewSceneObjects, IModelView2dSceneObject, TiledGraphicsSceneObjects } from "./SceneObject";
import { ScenePresentation, ScenePresentation2d, ScenePresentation3d } from "./ScenePresentation";
import { SceneVolume, SceneVolume3d } from "./SceneVolume";

export interface ViewportScene extends Iterable<SceneObject> {
 isSpatial(): this is SpatialScene;
 is2dModel(): this is Model2dScene;

 readonly volume: SceneVolume;
 readonly presentation: ScenePresentation;
 readonly iModels: Iterable<IModelViewSceneObject>;
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
 readonly iModels: Iterable<IModelView2dSceneObject>;
}

// ###TODO export interface DrawingModelScene extends Model2dScene
// ###TODO export interface SheetModelScene extends Model2dScene
