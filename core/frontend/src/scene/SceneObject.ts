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
import { IModelView } from "./IModelView";
import { TiledGraphicsProvider } from "../tile/internal";
import { SceneRealityModel } from "./SceneRealityModel";
import { ScenePresentation, ScenePresentation2d, ScenePresentation3d } from "./ScenePresentation";
import { SceneMap } from "./SceneMap";
import { ViewportScene } from "./Scene";

export interface SceneObjectPayload {
  readonly customType?: string;
  readonly view?: IModelView;
  readonly presentation?: ScenePresentation;
  readonly realityModel?: SceneRealityModel;
  readonly graphicsProvider?: TiledGraphicsProvider;
  readonly map?: SceneMap;
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
