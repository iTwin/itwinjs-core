/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String } from "@itwin/core-bentley";
import { Viewport, ViewportDecorator } from "./Viewport";
import { HitDetail } from "./HitDetail";
import { SceneContext } from "./ViewContext";

// Describes the common interface for all SceneObjects.
// For documentation and type-checking purposes only - SceneObject is a union type.
export interface ISceneObject extends ViewportDecorator {
  readonly scene: ViewportScene;
  readonly isLoadingComplete: boolean;

  getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined>;

  addToScene(context: SceneContext): void;

  // need higher-level abstraction?
  // collectStatistics(stats: RenderMemory.Statistics): void;
}

// Necessary to have a special type, vs just a custom scene object (that maybe wraps a ViewportDecorator / Decorator)?
export interface SceneDecorator extends ISceneObject, ViewportDecorator {
  type: "decorator";
}

export interface SceneDecorators extends Iterable<SceneDecorator> {
  
}

export interface SceneRealityModel extends ISceneObject {
  type: "realityModel";
}

export interface SceneRealityModels extends Iterable<SceneRealityModel> {
  
}

export interface SceneMap extends ISceneObject {
  type: "map";
}

// This union type is open for future expansion - the `type` field should be treated as non-exhaustive.
export type SceneObject = SceneDecorator | SceneRealityModel | SceneMap;

// Exists for documentation + type-checking only.
export interface IViewportScene {
  viewport: Viewport;
}

export interface SpatialViewportScene extends IViewportScene, Iterable<SceneObject> {
  readonly type: "spatial";
  readonly decorators: SceneDecorators;
  readonly realityModels: SceneRealityModels;
  // Will we need/want individual SceneObjects for each map layer, and the globe, and whatever?
  readonly maps: SceneMap;
}

export type ViewportScene = SpatialViewportScene;

export interface SceneEntity {
  readonly id: Id64String;
  readonly object: SceneObject;
}
