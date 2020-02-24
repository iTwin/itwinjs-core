/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import {
  Id64String,
  IDisposable,
} from "@bentley/bentleyjs-core";
import {
  Point2d,
  Transform,
  XAndY,
} from "@bentley/geometry-core";
import {
  Frustum,
  ImageBuffer,
  SpatialClassificationProps,
} from "@bentley/imodeljs-common";
import { ViewRect } from "../ViewRect";
import { Viewport } from "../Viewport";
import { SceneContext } from "../ViewContext";
import { HiliteSet } from "../SelectionSet";
import { CanvasDecoration } from "./CanvasDecoration";
import { RenderMemory } from "./RenderMemory";
import {
  RenderSystem,
  RenderTextureDrape,
} from "./RenderSystem";
import { AnimationBranchStates } from "./GraphicBranch";
import { RenderPlanarClassifier } from "./RenderPlanarClassifier";
import { GraphicType } from "./GraphicBuilder";
import { GraphicList } from "./RenderGraphic";
import { RenderPlan } from "./RenderPlan";
import { Decorations } from "./Decorations";
import { FeatureSymbology } from "./FeatureSymbology";
import { Pixel } from "./Pixel";
import { Scene } from "./Scene";

/** Used for debugging purposes, to toggle display of instanced or batched primitives.
 * @see [[RenderTargetDebugControl]].
 * @alpha
 */
export const enum PrimitiveVisibility { // tslint:disable-line:no-const-enum
  /** Draw all primitives. */
  All,
  /** Only draw instanced primitives. */
  Instanced,
  /** Only draw un-instanced primitives. */
  Uninstanced,
}

/** An interface optionally exposed by a RenderTarget that allows control of various debugging features.
 * @beta
 */
export interface RenderTargetDebugControl {
  /** If true, render to the screen as if rendering off-screen for readPixels(). */
  drawForReadPixels: boolean;
  /** If true, use log-z depth buffer (assuming supported by client). */
  useLogZ: boolean;
  /** @alpha */
  primitiveVisibility: PrimitiveVisibility;
  /** @internal */
  vcSupportIntersectingVolumes: boolean;
  /** @internal */
  readonly shadowFrustum: Frustum | undefined;
  /** @internal */
  displayDrapeFrustum: boolean;
  /** Override device pixel ratio for on-screen targets only. This supersedes window.devicePixelRatio. Undefined clears the override. Chiefly useful for tests.
   * @internal
   */
  devicePixelRatioOverride?: number;
  /** @internal */
  displayRealityTilePreload: boolean;
  /** @internal */
  displayRealityTileRanges: boolean;
  /** @internal */
  logRealityTiles: boolean;
  /** @internal */
  freezeRealityTiles: boolean;
}

/** A RenderTarget connects a [[Viewport]] to a WebGLRenderingContext to enable the viewport's contents to be displayed on the screen.
 * Application code rarely interacts directly with a RenderTarget - instead, it interacts with a Viewport which forwards requests to the implementation
 * of the RenderTarget.
 * @internal
 */
export abstract class RenderTarget implements IDisposable, RenderMemory.Consumer {
  public pickOverlayDecoration(_pt: XAndY): CanvasDecoration | undefined { return undefined; }

  public static get frustumDepth2d(): number { return 1.0; } // one meter
  public static get maxDisplayPriority(): number { return (1 << 23) - 32; }
  public static get minDisplayPriority(): number { return -this.maxDisplayPriority; }

  /** Returns a transform mapping an object's display priority to a depth from 0 to frustumDepth2d. */
  public static depthFromDisplayPriority(priority: number): number {
    return (priority - this.minDisplayPriority) / (this.maxDisplayPriority - this.minDisplayPriority) * this.frustumDepth2d;
  }

  public abstract get renderSystem(): RenderSystem;

  /** NB: *Device pixels*, not CSS pixels! */
  public abstract get viewRect(): ViewRect;

  public get devicePixelRatio(): number { return 1; }
  public cssPixelsToDevicePixels(cssPixels: number): number {
    return Math.floor(cssPixels * this.devicePixelRatio);
  }

  public abstract get wantInvertBlackBackground(): boolean;

  public abstract get animationFraction(): number;
  public abstract set animationFraction(fraction: number);

  public get animationBranches(): AnimationBranchStates | undefined { return undefined; }
  public set animationBranches(_transforms: AnimationBranchStates | undefined) { }

  /** Update the solar shadow map. If a SceneContext is supplied, shadows are enabled; otherwise, shadows are disabled. */
  public updateSolarShadows(_context: SceneContext | undefined): void { }
  public getPlanarClassifier(_id: Id64String): RenderPlanarClassifier | undefined { return undefined; }
  public createPlanarClassifier(_properties: SpatialClassificationProps.Classifier): RenderPlanarClassifier | undefined { return undefined; }
  public getTextureDrape(_id: Id64String): RenderTextureDrape | undefined { return undefined; }

  public createGraphicBuilder(type: GraphicType, viewport: Viewport, placement: Transform = Transform.identity, pickableId?: Id64String) { return this.renderSystem.createGraphicBuilder(placement, type, viewport, pickableId); }

  public dispose(): void { }
  public reset(): void { }
  public abstract changeScene(scene: Scene): void;
  public abstract changeDynamics(dynamics?: GraphicList): void;
  public abstract changeDecorations(decorations: Decorations): void;
  public abstract changeRenderPlan(plan: RenderPlan): void;
  public abstract drawFrame(sceneMilSecElapsed?: number): void;
  public overrideFeatureSymbology(_ovr: FeatureSymbology.Overrides): void { }
  public setHiliteSet(_hilited: HiliteSet): void { }
  public setFlashed(_elementId: Id64String, _intensity: number): void { }
  public onBeforeRender(_viewport: Viewport, _setSceneNeedRedraw: (redraw: boolean) => void): void { }
  public abstract setViewRect(_rect: ViewRect, _temporary: boolean): void;
  public onResized(): void { }
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw
  /** `rect` is specified in *CSS* pixels. */
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean): void;
  /** `_rect` is specified in *CSS* pixels. */
  public readImage(_rect: ViewRect, _targetSize: Point2d, _flipVertically: boolean): ImageBuffer | undefined { return undefined; }
  public readImageToCanvas(): HTMLCanvasElement { return document.createElement("canvas"); }
  public collectStatistics(_stats: RenderMemory.Statistics): void { }

  /** Specify whether webgl content should be rendered directly to the screen.
   * If rendering to screen becomes enabled, returns the canvas to which to render the webgl content.
   * Returns undefined if rendering to screen becomes disabled, or is not supported by this RenderTarget.
   */
  public setRenderToScreen(_toScreen: boolean): HTMLCanvasElement | undefined { return undefined; }

  public get debugControl(): RenderTargetDebugControl | undefined { return undefined; }
}
