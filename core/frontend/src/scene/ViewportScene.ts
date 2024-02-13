/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String, assert } from "@itwin/core-bentley";
import { Viewport, ViewportDecorator } from "../Viewport";
import { HitDetail } from "../HitDetail";
import { SceneContext } from "../ViewContext";
import { AmbientOcclusion, ColorDef, ContextRealityModelProps, Environment, FeatureAppearance, PlanarClipMaskSettings, RealityDataSourceKey, RealityModelDisplaySettings, SolarShadowSettings, SpatialClassifiers, ViewFlags } from "@itwin/core-common";
import { SpatialView } from "./View";

// Describes the common interface for all SceneObjects.
// For documentation and type-checking purposes only - SceneObject is a union type.
export interface ISceneObject extends ViewportDecorator {
  readonly scene: ViewportScene;
  readonly isLoadingComplete: boolean;
  readonly isGlobal: boolean;

  getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined>;

  draw(context: SceneContext): void;

  // need higher-level abstraction?
  // collectStatistics(stats: RenderMemory.Statistics): void;
}

export interface SceneRealityModel extends ISceneObject {
  readonly rdSourceKey: RealityDataSourceKey;
  readonly name: string;
  readonly description: string;
  readonly realityDataId?: string;
  // SpatialClassifiers is implemented on top of a JSON container, it's weird.
  readonly classifiers?: SpatialClassifiers;
  planarClipMaskSettings?: PlanarClipMaskSettings;
  appearanceOverrides?: FeatureAppearance;
  displaySettings: RealityModelDisplaySettings;
  // Is this actually needed, or just confusing?
  // readonly modelId: Id64String;
}

export namespace SceneRealityModel {
  export function fromContextRealityModel(props: ContextRealityModelProps, scene: ViewportScene): SceneRealityModel {
    assert(!props && !scene);
    throw new Error("TODO");
  }
}

export interface RealityModelSceneObject extends ISceneObject {
  readonly type: "realityModel";
  readonly model: SceneRealityModel;
}
export interface SceneRealityModels extends Iterable<RealityModelSceneObject> {
  
}

// ###TODO
export interface SceneMap extends ISceneObject {
  readonly type: "map";
}

export interface IScenePresentation extends ISceneObject {
  readonly type: "presentation";
  readonly backgroundColor: ColorDef;
  readonly viewFlags: ViewFlags;
}

export interface ScenePresentation2d extends IScenePresentation {
  readonly is3d: false;
}

export interface ScenePresentation3d extends IScenePresentation {
  readonly is3d: true;
  environment: Environment;
  toggleSkyBox(display?: boolean): void;
  toggleAtmosphere(display?: boolean): void;
  // We would need to know in what coordinate reference frame to draw the ground plane.
  // Perhaps each iModel can individually toggle+draw its own ground plane.
  // toggleGroundPlane(display?: boolean): void;

  ambientOcclusion: AmbientOcclusion.Settings;
  solarShadows: SolarShadowSettings;
}

export type ScenePresentation = ScenePresentation2d | ScenePresentation3d;

export interface CustomSceneObject extends ISceneObject {
  readonly type: "custom";
  readonly customType: string;
}

export interface CustomSceneObjects extends Iterable<CustomSceneObject> {

}

export interface IViewSceneObject extends ISceneObject {
  readonly type: "view";
}

export interface SpatialViewSceneObject extends IViewSceneObject {
  readonly viewType: "spatial";
  readonly view: SpatialView;
}

export type ViewSceneObject = SpatialViewSceneObject;

// This union type is open for future expansion - the `type` field should be treated as non-exhaustive.
export type SceneObject = RealityModelSceneObject| SceneMap | ScenePresentation | CustomSceneObject | ViewSceneObject;

// Exists for documentation + type-checking only.
export interface IViewportScene {
  viewport: Viewport;
}

export interface SpatialViewportScene extends IViewportScene, Iterable<SceneObject>, ViewportDecorator {
  readonly type: "spatial";
  readonly realityModels: SceneRealityModels;
  // Will we need/want individual SceneObjects for each map layer, and the globe, and whatever?
  readonly maps: SceneMap;
  readonly presentation: ScenePresentation3d;
  readonly customObjects: CustomSceneObjects;

  // Something for computing/providing a coordinate reference frame for nav cube and standard orientations.
}

export type ViewportScene = SpatialViewportScene;

export interface SceneEntity {
  readonly id: Id64String;
  readonly object: SceneObject;
}
