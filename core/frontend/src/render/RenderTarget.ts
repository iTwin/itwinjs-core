/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ImageBuffer } from "@itwin/core-common";
import { XAndY } from "@itwin/core-geometry";
import { IModelConnection } from "../IModelConnection.js";
import { HiliteSet } from "../SelectionSet.js";
import { SceneContext } from "../ViewContext.js";
import { ReadImageBufferArgs, Viewport } from "../Viewport.js";
import { ViewRect } from "../common/ViewRect.js";
import { CanvasDecoration } from "./CanvasDecoration.js";
import { Decorations } from "./Decorations.js";
import { FeatureSymbology } from "./FeatureSymbology.js";
import { FrameStatsCollector } from "../internal/render/FrameStatsCollector.js";
import { AnimationBranchStates } from "../internal/render/AnimationBranchState.js";
import { CustomGraphicBuilderOptions, ViewportGraphicBuilderOptions } from "./GraphicBuilder.js";
import { Pixel } from "./Pixel.js";
import { GraphicList } from "./RenderGraphic.js";
import { RenderMemory } from "./RenderMemory.js";
import { RenderPlan } from "../internal/render/RenderPlan.js";
import { RenderPlanarClassifier } from "../internal/render/RenderPlanarClassifier.js";
import { RenderSystem, } from "./RenderSystem.js";
import { Scene } from "./Scene.js";
import { QueryTileFeaturesOptions, QueryVisibleFeaturesCallback } from "./VisibleFeature.js";
import { ActiveSpatialClassifier } from "../SpatialClassifiersState.js";
import { _implementationProhibited } from "../common/internal/Symbols.js";
import { RenderTextureDrape } from "../internal/render/RenderTextureDrape.js";
import { RenderTargetDebugControl } from "../internal/render/RenderTargetDebugControl.js";

/** Connects a [[Viewport]] to a graphics renderer such as a [WebGLRenderingContext](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext)
 * to enable the viewport's contents to be rendered to the screen or to an off-screen buffer.
 * Application code never interacts directly with a `RenderTarget` - it interacts with the `Viewport`'s API which forwards requests to the `RenderTarget`.
 * @public
 */
export abstract class RenderTarget implements Disposable, RenderMemory.Consumer {
  /** @internal */
  protected abstract readonly [_implementationProhibited]: unknown;

  /** @internal */
  public pickOverlayDecoration(_pt: XAndY): CanvasDecoration | undefined { return undefined; }

  /** @internal */
  public abstract get renderSystem(): RenderSystem;

  /** NB: *Device pixels*, not CSS pixels! */
  /** @internal */
  public abstract get viewRect(): ViewRect;

  /** @internal */
  public get devicePixelRatio(): number { return 1; }
  /** @internal */
  public cssPixelsToDevicePixels(cssPixels: number, floor = true): number {
    const pix = cssPixels * this.devicePixelRatio;
    return floor ? Math.floor(pix) : pix;
  }

  /** Given the size of a logical pixel in meters, convert it to the size of a physical pixel in meters, if [[RenderSystem.dpiAwareLOD]] is `true`.
   * Used when computing LOD for graphics.
   */
  /** @internal */
  public adjustPixelSizeForLOD(cssPixelSize: number): number {
    return this.renderSystem.dpiAwareLOD ? this.cssPixelsToDevicePixels(cssPixelSize, false) : cssPixelSize;
  }

  /** @internal */
  public abstract get wantInvertBlackBackground(): boolean;

  /** @internal */
  public abstract get analysisFraction(): number;
  public abstract set analysisFraction(fraction: number);

  /** @internal */
  public get animationBranches(): AnimationBranchStates | undefined { return undefined; }
  public set animationBranches(_transforms: AnimationBranchStates | undefined) { }

  /** @internal */
  public get antialiasSamples(): number { return 1; }
  public set antialiasSamples(_numSamples: number) { }

  /** @internal */
  public assignFrameStatsCollector(_collector: FrameStatsCollector) { }

  /** Update the solar shadow map. If a SceneContext is supplied, shadows are enabled; otherwise, shadows are disabled. */
  /** @internal */
  public updateSolarShadows(_context: SceneContext | undefined): void { }
  /** @internal */
  public getPlanarClassifier(_id: string): RenderPlanarClassifier | undefined { return undefined; }
  /** @internal */
  public createPlanarClassifier(_properties?: ActiveSpatialClassifier): RenderPlanarClassifier | undefined { return undefined; }
  /** @internal */
  public getTextureDrape(_id: Id64String): RenderTextureDrape | undefined { return undefined; }

  /** @internal */
  public createGraphicBuilder(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions) {
    return this.renderSystem.createGraphic(options);
  }

  /** @internal */
  public [Symbol.dispose](): void { }
  /** @internal */
  public reset(_realityMapLayerChanged?: boolean): void { }
  /** @internal */
  public abstract changeScene(scene: Scene): void;
  /** @internal */
  public abstract changeDynamics(dynamics?: GraphicList): void;
  /** @internal */
  public abstract changeDecorations(decorations: Decorations): void;
  /** @internal */
  public abstract changeRenderPlan(plan: RenderPlan): void;
  /** @internal */
  public abstract drawFrame(sceneMilSecElapsed?: number): void;
  /** @internal */
  public overrideFeatureSymbology(_ovr: FeatureSymbology.Overrides): void { }
  /** @internal */
  public setHiliteSet(_hilited: HiliteSet): void { }
  /** @internal */
  public setFlashed(_elementId: Id64String, _intensity: number): void { }
  /** @internal */
  public onBeforeRender(_viewport: Viewport, _setSceneNeedRedraw: (redraw: boolean) => void): void { }
  /** @internal */
  public abstract setViewRect(_rect: ViewRect, _temporary: boolean): void;
  /** @internal */
  public onResized(): void { }
  /** @internal */
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw
  /** `rect` is specified in *CSS* pixels. */
  /** @internal */
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable: boolean, excludedElements?: Iterable<Id64String>): void;
  /** @internal */
  public readImageBuffer(_args?: ReadImageBufferArgs): ImageBuffer | undefined { return undefined; }
  /** @internal */
  public readImageToCanvas(_overlayCanvas?: HTMLCanvasElement): HTMLCanvasElement { return document.createElement("canvas"); }
  /** @internal */
  public collectStatistics(_stats: RenderMemory.Statistics): void { }

  /** Specify whether webgl content should be rendered directly to the screen.
   * If rendering to screen becomes enabled, returns the canvas to which to render the webgl content.
   * Returns undefined if rendering to screen becomes disabled, or is not supported by this RenderTarget.
   */
  /** @internal */
  public setRenderToScreen(_toScreen: boolean): HTMLCanvasElement | undefined { return undefined; }

  /** @internal */
  public get debugControl(): RenderTargetDebugControl | undefined { return undefined; }

  /** An ordered list of names of screen-space post-processing effects to be applied to the image produced by this target.
   * The effects are applied in the order in which they appear in the list. Any names not corresponding to a registered effect are ignored.
   * This may have no effect if this target does not support screen-space effects.
   * @see [[RenderSystem.createScreenSpaceEffectBuilder]] to create and register new effects.
   */
  /** @internal */
  public abstract get screenSpaceEffects(): Iterable<string>;
  public abstract set screenSpaceEffects(_effectNames: Iterable<string>);

  /** Implementation for [[Viewport.queryVisibleFeatures]]. Not intended for direct usage. The returned iterable remains valid only for the duration of the
   * Viewport.queryVisibleFeatures call.
   */
  /** @internal */
  public queryVisibleTileFeatures(_options: QueryTileFeaturesOptions, _iModel: IModelConnection, callback: QueryVisibleFeaturesCallback): void {
    callback([]);
  }
}
