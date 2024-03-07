/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Viewport, ViewportDecorator } from "../Viewport";
import { HitDetail } from "../HitDetail";
import { SceneContext } from "../ViewContext";
import { AmbientOcclusion, ColorDef, Environment, FeatureAppearance, PlanarClipMaskSettings, RealityDataSourceKey, RealityModelDisplaySettings, SolarShadowSettings, SpatialClassifiers, ViewFlags } from "@itwin/core-common";
import { IModelSpatialView, IModelView, IModelView2d } from "./IModelView";
import { TiledGraphicsProvider } from "../tile/internal";
import { SceneVolume3d, TestSceneVolume2d } from "./SceneVolume";
import { GuidString, Id64String } from "@itwin/core-bentley";

// Describes the common interface for all SceneObjects.
// For documentation and type-checking purposes only - SceneObject is a union type.
export interface ISceneObject extends ViewportDecorator {
  /** A GUID uniquely identifying this scene object. GUIDs can be used to define relationships between scene objects.
   * If no GUID is supplied when creating a scene object, one will be generated and assigned.
   */
  readonly guid: GuidString;
  /** Specifies whether this scene object is currently being rendered into the [[Viewport]]. */
  isDisplayed: boolean;
  readonly scene: ViewportScene;
  readonly isLoadingComplete: boolean;
  readonly isGlobal: boolean;

  getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined>;

  draw(context: SceneContext): void;

  // ###TODO need higher-level abstraction?
  // collectStatistics(stats: RenderMemory.Statistics): void;

  // ###TODO reprojection between local and scene coordinate spaces
  // ###TODO query bounding boxes (or union thereof) for scene entities
  // ###TODO bounding box of the entire scene object
}

export interface BaseSceneObject {
  readonly customType?: never;
  readonly view?: never;
  readonly presentation?: never;
  readonly realityModel?: never;
  readonly graphicsProvider?: never;
  readonly map?: never;
}

export interface ModelClassifierParams {
  readonly type: "model";
  readonly modelId: Id64String;
  readonly expand: number; // default 0
}

export type SceneObjectClassifierParams = ModelClassifierParams | {
  readonly type: unknown;
};

export interface SceneObjectClassifier {
  readonly source: GuidString;
  readonly name: string;
  readonly inside: "on" | "off" | "dimmed" | "hilite" | "source";
  readonly outside: "on" | "off" | "dimmed";
  readonly isVolume: boolean;
  readonly params?: SceneObjectClassifierParams;
}

export interface SceneObjectClassifiers extends Iterable<SceneObjectClassifier> {
  active: SceneObjectClassifier | undefined;
  readonly size: number;
  find(criterion: (classifier: SceneObjectClassifier) => boolean): SceneObjectClassifier | undefined;
  findEquivalent(classifier: SceneObjectClassifier): SceneObjectClassifier | undefined;
  has(classifier: SceneObjectClassifier): boolean;
  add(classifier: SceneObjectClassifier): SceneObjectClassifier;
  replace(toReplace: SceneObjectClassifier, replaceWith: SceneObjectClassifier): boolean;
  delete(classifier: SceneObjectClassifier): SceneObjectClassifier | undefined;
  clear(): void;
}

export interface ModelClipMaskParams {
  readonly type: "imodel";
  readonly models: Iterable<Id64String>;
  readonly elements?: never;
  readonly subCategories?: never;
}

export interface SubCategoryClipMaskParams {
  readonly type: "imodel";
  readonly models?: Iterable<Id64String>;
  readonly subCategories: Iterable<Id64String>;
  readonly elements?: never;
}

export interface ElementClipMaskParams {
  readonly type: "imodel";
  readonly models?: Iterable<Id64String>;
  readonly elements: Iterable<Id64String>;
  readonly exclude?: boolean;
  readonly subCategories?: never;
}

export type IModelClipMaskParams = ModelClipMaskParams | SubCategoryClipMaskParams | ElementClipMaskParams;
export type ClipMaskParams = IModelClipMaskParams | { type: unknown };

export interface SceneObjectClipMask {
  readonly source: GuidString;
  readonly params?: ClipMaskParams;
}
export interface BaseClipMaskSettings {
  readonly invert: boolean;
  readonly transparency?: number;
}

export interface PriorityClipMaskSettings extends BaseClipMaskSettings {
  readonly priority: number;
  readonly mask?: never;
}

export interface SceneObjectClipMaskSettings extends BaseClipMaskSettings {
  readonly mask: SceneObjectClipMask;
  readonly priority?: never;
}

export type ClipMaskSettings = PriorityClipMaskSettings | SceneObjectClipMaskSettings;

export interface RealityModel {
  readonly sourceKey: RealityDataSourceKey;
  readonly name: string;
  readonly description: string;
  readonly realityDataId?: string;
  readonly classifiers: SceneObjectClassifiers;
  clipMask?: ClipMaskSettings;
  appearanceOverrides?: FeatureAppearance;
  displaySettings: RealityModelDisplaySettings;
  // Is this actually needed, or just confusing?
  // readonly modelId: Id64String;
}

export interface RealityModelSceneObject extends ISceneObject, Omit<BaseSceneObject, "realityModel"> {
  readonly scene: SpatialScene;
  readonly realityModel: RealityModel;
}

export type RealityModelSceneObjects = Iterable<RealityModelSceneObject>;

export interface IModelSceneObject extends ISceneObject, Omit<BaseSceneObject, "view"> {
  readonly view: IModelView;
}

export type IModelSceneObjects<T extends IModelView> = Iterable<T>;

export interface ScenePresentation2d {
  // ###TODO grid
  is2d: true;
  is3d?: never;
  viewFlags: ViewFlags;
  backgroundColor: ColorDef;
}

export interface ScenePresentation3d {
  // ###TODO grid
  is3d: true;
  is2d?: never;
  viewFlags: ViewFlags;
  backgroundColor:  ColorDef;
  // ###TODO Environment contains iModel-specific things like texture Ids.
  // environment: Environment;
  // toggleSkyBox(display?: boolean): void;
  // toggleAtmosphere(display?: boolean): void;
  ambientOcclusion: AmbientOcclusion.Settings;
  solarShadows: SolarShadowSettings;
}

export interface PresentationSceneObject extends ISceneObject, Omit<BaseSceneObject, "presentation"> {
  readonly presentation: ScenePresentation2d | ScenePresentation3d;
}

export interface CustomSceneObject extends ISceneObject, Omit<BaseSceneObject, "customType"> {
  customType?: string;
}

export type CustomSceneObjects = Iterable<CustomSceneObject>;

export interface MapSceneObject extends ISceneObject, Omit<BaseSceneObject, "map"> {
  readonly map: any; // ###TODO
}

export interface TiledGraphicsSceneObject extends ISceneObject, Omit<BaseSceneObject, "graphicsProvider"> {
  readonly graphicsProvider: TiledGraphicsProvider;
}

export type TiledGraphicsSceneObjects = Iterable<TiledGraphicsSceneObject>;

export type SceneObject = RealityModelSceneObject | IModelSceneObject | PresentationSceneObject | CustomSceneObject | MapSceneObject | TiledGraphicsSceneObject;

export interface SpatialScene {
  // ###TODO I'd rather not have this bidirectional coupling... readonly viewport: Viewport;
  // ###TODO need to design ahead for future types - ViewState3d - not spatial, but not 2d.
  readonly isSpatial: true;
  readonly is2d?: never;

  readonly volume: SceneVolume3d;

  readonly realityModels: RealityModelSceneObjects;
  readonly maps?: MapSceneObject;
  readonly iModels: IModelSceneObjects<IModelSpatialView>;
  // ###TODO want to keep SceneObject interface open for expansion for now, without incurring backwards compatibility tax
  // readonly custom: CustomSceneObjects;
  readonly presentation: ScenePresentation3d;
  readonly tiledGraphicsProviders: TiledGraphicsSceneObjects;
}

export interface TestScene2d {
  readonly viewport: Viewport;
  readonly is2d: true;
  readonly isSpatial?: never;

  readonly volume: TestSceneVolume2d;

  readonly views: IModelSceneObjects<IModelView2d>;
  readonly presentation: ScenePresentation2d;
  readonly tiledGraphicsProviders: TiledGraphicsSceneObjects;
  // ###TODO want to keep SceneObject interface open for expansion for now, without incurring backwards compatibility tax
  // readonly custom: CustomSceneObjects;
}

export type ViewportScene = SpatialScene | TestScene2d;
