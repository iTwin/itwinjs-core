/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { GuidString } from "@itwin/core-bentley";
import { ViewportDecorator } from "../Viewport";
import { HitDetail } from "../HitDetail";
import { SceneContext } from "../ViewContext";
import { IModelSpatialView, IModelView, IModelView2d } from "./IModelView";
import { TiledGraphicsProvider } from "../tile/internal";
import { SceneRealityModel } from "./SceneRealityModel";
import { ScenePresentation, ScenePresentation2d, ScenePresentation3d } from "./ScenePresentation";
import { SceneMap } from "./SceneMap";
import { ViewportScene } from "./Scene";
import { IModelConnection } from "../IModelConnection";
import { Decorator } from "../ViewManager";

export interface SceneObjectPayload {
  readonly customType?: string;
  readonly view?: IModelView;
  readonly presentation?: ScenePresentation;
  readonly realityModel?: SceneRealityModel;
  readonly graphicsProvider?: TiledGraphicsProvider;
  readonly map?: SceneMap;
  readonly decorator?: Decorator;
}

export interface SceneObject extends ViewportDecorator, SceneObjectPayload {
  readonly guid: GuidString;
  isDisplayed: boolean;
  readonly scene: ViewportScene;
  readonly isLoadingComplete: boolean;
  // ###TODO needed? readonly isGlobal: boolean;

  getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined>;
  draw(context: SceneContext): void;
  // ###TODO conversion between local and scene coordinate spaces
  // ###TODO higher-level abstraction? collectStatistics(stats: RenderMemory.Statistics): void;
  // ###TODO query bounding boxes (or union thereof) for scene entities?
  // ###TODO bounding box of the entire scene object? or unionFitRange (extents may be loaded async; global tilesets and presentation won't have bounding boxes).
}

export type RealityModelSceneObject = SceneObject & { readonly realityModel: SceneRealityModel; };

export type PresentationSceneObject = SceneObject & { readonly presentation: ScenePresentation; }
export type Presentation2dSceneObject = SceneObject & { readonly presentation: ScenePresentation2d; }
export type Presentation3dSceneObject = SceneObject & { readonly presentation: ScenePresentation3d; }

export type CustomSceneObject = SceneObject & { readonly customType: string; }
export type TiledGraphicsSceneObject = SceneObject & { readonly graphicsProvider: TiledGraphicsProvider; }
export type MapSceneObject = SceneObject & { readonly map: SceneMap; }
export type DecoratorSceneObject = SceneObject & { readonly decorator: Decorator; }

export type IModelViewSceneObject = SceneObject & { readonly view: IModelView; };
export type SpatialViewSceneObject = SceneObject & { readonly view: IModelSpatialView; }
export type TestIModelView2dSceneObject = SceneObject & { readonly view: IModelView2d; };

export interface SpatialViewSceneObjects extends Iterable<SpatialViewSceneObject> {
  add(view: IModelSpatialView): SpatialViewSceneObject;
  delete(view: SpatialViewSceneObject): void; // ###TODO return type?
  clear(): void;
  findFirstForIModel(iModel: IModelConnection): SpatialViewSceneObject | undefined;
}

export type SceneRealityModelProps = Pick<SceneRealityModel, "sourceKey" | "name" | "description" | "realityDataId">;

export interface RealityModelSceneObjects extends Iterable<RealityModelSceneObject> {
  add(props: SceneRealityModelProps): RealityModelSceneObject;
  delete(model: RealityModelSceneObject): void; // ###TODO return type?
  clear(): void;
}

export interface TiledGraphicsSceneObjects extends Iterable<TiledGraphicsSceneObject> {
  add(provider: TiledGraphicsProvider): TiledGraphicsSceneObject;
  delete(object: TiledGraphicsSceneObject): void; // ###TODO return type?
  clear(): void;
}

// For Decorators registered with ViewManager.
// Add/remove is handled by ViewManager API, not here - we react to it by updating this collection though.
export interface DecoratorSceneObjects extends Iterable<DecoratorSceneObject> {
  find(decorator: Decorator): DecoratorSceneObject | undefined;
}
