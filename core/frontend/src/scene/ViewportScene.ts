/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { ViewportDecorator } from "../Viewport";
import { HitDetail } from "../HitDetail";
import { SceneContext } from "../ViewContext";
import { AmbientOcclusion, ColorDef, Environment, FeatureAppearance, PlanarClipMaskSettings, RealityDataSourceKey, RealityModelDisplaySettings, SolarShadowSettings, SpatialClassifiers, ViewFlags } from "@itwin/core-common";
import { SpatialView, IModelView, IModelView2d } from "./IModelView";
import { TiledGraphicsProvider } from "../tile/internal";
import { SceneVolume3d, TestSceneVolume2d } from "./SceneVolume";

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

export interface BaseSceneObject {
  customType?: never;
  view?: never;
  presentation?: never;
  realityModel?: never;
  graphicsProvider?: never;
  map?: never;
}

export interface RealityModel {
  readonly rdSourceKey: RealityDataSourceKey;
  readonly name: string;
  readonly description: string;
  readonly realityDataId?: string;
  // ###TODO SpatialClassifiers is implemented on top of a JSON container, it's weird.
  // It also contains model Ids that assume a specific iModel
  readonly classifiers?: SpatialClassifiers;
  planarClipMaskSettings?: PlanarClipMaskSettings;
  appearanceOverrides?: FeatureAppearance;
  displaySettings: RealityModelDisplaySettings;
  // Is this actually needed, or just confusing?
  // readonly modelId: Id64String;
}

export interface RealityModelSceneObject extends ISceneObject, Omit<BaseSceneObject, "realityModel"> {
  readonly scene: SpatialScene;
  readonly realityModel: RealityModel;
}

export interface RealityModelSceneObjects extends Iterable<RealityModelSceneObject> {
  
}

export interface IModelSceneObject extends ISceneObject, Omit<BaseSceneObject, "view"> {
  readonly view: IModelView;
}

export interface IModelSceneObjects<T extends IModelView> extends Iterable<T> {
  
}

export interface ScenePresentation2d {
  is2d: true;
  is3d?: false;
  viewFlags: ViewFlags;
  backgroundColor: ColorDef;
}

export interface ScenePresentation3d {
  is3d: true;
  is2d?: false;
  viewFlags: ViewFlags;
  backgroundColor:  ColorDef;
  environment: Environment;
  toggleSkyBox(display?: boolean): void;
  toggleAtmosphere(display?: boolean): void;
  ambientOcclusion: AmbientOcclusion.Settings;
  solarShadows: SolarShadowSettings;
}

export interface PresentationSceneObject extends ISceneObject, Omit<BaseSceneObject, "presentation"> {
  readonly presentation: ScenePresentation2d | ScenePresentation3d;
}

export interface CustomSceneObject extends ISceneObject, Omit<BaseSceneObject, "customType"> {
  customType?: string;
}

export interface CustomSceneObjects extends Iterable<CustomSceneObject> {
  
}

export interface MapSceneObject extends ISceneObject, Omit<BaseSceneObject, "map"> {
  readonly map: any; // ###TODO
}

export interface TiledGraphicsSceneObject extends ISceneObject, Omit<BaseSceneObject, "graphicsProvider"> {
  readonly graphicsProvider: TiledGraphicsProvider;
}

export interface TiledGraphicsSceneObjects extends Iterable<TiledGraphicsSceneObject> {
  
}

export type SceneObject = RealityModelSceneObject | IModelSceneObject | PresentationSceneObject | CustomSceneObject | MapSceneObject | TiledGraphicsSceneObject;

export interface SpatialScene {
  readonly isSpatial: true;
  readonly is2d?: never;

  volume: SceneVolume3d;

  readonly realityModels: RealityModelSceneObjects;
  readonly maps: MapSceneObject;
  readonly iModels: IModelSceneObjects<SpatialView>;
  readonly custom: CustomSceneObjects;
  readonly presentation: ScenePresentation3d;
  readonly tiledGraphicsProviders: TiledGraphicsSceneObjects;
}

export interface TestScene2d {
  readonly is2d: true;
  readonly isSpatial?: never;

  volume: TestSceneVolume2d;

  readonly views: IModelSceneObjects<IModelView2d>;
  readonly presentation: ScenePresentation2d;
  readonly tiledGraphicsProviders: TiledGraphicsSceneObjects;
  readonly custom: CustomSceneObjects;
}

export type ViewportScene = SpatialScene | TestScene2d;
