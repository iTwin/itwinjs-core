/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { BeEvent } from "@bentley/bentleyjs-core";

/** Describes timing statistics for a single rendered frame. Aside from `frameId`, `totalFrameTime`, and `totalSceneTime`, the other entries may represent operations that are not performed every frame and may contain an expected value of zero.
 * @note By default, the display system does not render frames continuously. The display system will render a new frame only when the view changes. Therefore, the data contained within this interface cannot directly be used to compute a representative framerate.
 * @alpha
 */
export interface FrameStats {
  /** A unique number identifying the frame to which these statistics belong. */
  frameId: number;
  /** The CPU time in milliseconds spent setting up the scene. This does not include the time described by `totalFrameTime`. */
  totalSceneTime: number;
  /** The CPU time in milliseconds spent performing animations while setting up the scene. This is included in `totalSceneTime`. */
  animationTime: number;
  /** The CPU time in milliseconds spent setting up the view while setting up the scene. This is included in `totalSceneTime`. */
  setupViewTime: number;
  /** The CPU time in milliseconds spent when creating or changing the scene if invalid. This is included in `totalSceneTime`. */
  createChangeSceneTime: number;
  /** The CPU time in milliseconds spent validating the render plan while setting up the scene. This is included in `totalSceneTime`. */
  validateRenderPlanTime: number;
  /** The CPU time in milliseconds spent adding or changing decorations while setting up the scene. This is included in `totalSceneTime`. */
  decorationsTime: number;
  /** The CPU time in milliseconds spent executing the target's `onBeforeRender` call while setting up the scene. This is included in `totalSceneTime`. */
  onBeforeRenderTime: number;
  /** The CPU time in milliseconds spent rendering the frame. This does not include the time described by `totalSceneTime`. */
  totalFrameTime: number;
  /** The CPU time in milliseconds spent rendering opaque geometry. This is included in `totalFrameTime`. */
  opaqueTime: number;
  /** The CPU time in milliseconds spent executing the `IModelFrameLifecycle.onRenderOpaque` call. This is included in `totalFrameTime`. */
  onRenderOpaqueTime: number;
  /** The CPU time in milliseconds spent rendering translucent geometry. This is included in `totalFrameTime`. */
  translucentTime: number;
  /** The CPU time in milliseconds spent rendering overlays. This is included in `totalFrameTime`. */
  overlaysTime: number;
  /** The CPU time in milliseconds spent rendering the solar shadow map. This is included in `totalFrameTime`. */
  shadowsTime: number;
  /** The CPU time in milliseconds spent rendering both planar and volume classifiers. This is included in `totalFrameTime`. */
  classifiersTime: number;
  /** The CPU time in milliseconds spent applying screenspace effects. This is included in `totalFrameTime`. */
  screenspaceEffectsTime: number;
  /** The CPU time in milliseconds spent rendering background geometry including backgrounds, skyboxes, and background maps. This is included in `totalFrameTime`. */
  backgroundTime: number;
}

/** An event which will be raised when a new frame statistics object is available. The listeners will receive that frame statistics object.
 * @see [[Viewport.enableFrameStatsListener]]
 * @alpha
 */
export type OnFrameStatsReadyEvent = BeEvent<(frameStats: Readonly<FrameStats>) => void>;

/** @internal */
export class FrameStatsCollector {
  private _onFrameStatsReady?: OnFrameStatsReadyEvent;
  private _frameStats = FrameStatsCollector._createStats();
  private _shouldRecordFrame = false;

  private static _createStats(): FrameStats {
    return {
      frameId: 0,
      totalSceneTime: 0,
      animationTime: 0,
      setupViewTime: 0,
      createChangeSceneTime: 0,
      validateRenderPlanTime: 0,
      decorationsTime: 0,
      onBeforeRenderTime: 0,
      totalFrameTime: 0,
      opaqueTime: 0,
      onRenderOpaqueTime: 0,
      translucentTime: 0,
      overlaysTime: 0,
      shadowsTime: 0,
      classifiersTime: 0,
      screenspaceEffectsTime: 0,
      backgroundTime: 0,
    };
  }

  private _clearStats() {
    this._frameStats.totalSceneTime = 0;
    this._frameStats.animationTime = 0;
    this._frameStats.setupViewTime = 0;
    this._frameStats.createChangeSceneTime = 0;
    this._frameStats.validateRenderPlanTime = 0;
    this._frameStats.decorationsTime = 0;
    this._frameStats.onBeforeRenderTime = 0;
    this._frameStats.totalFrameTime = 0;
    this._frameStats.opaqueTime = 0;
    this._frameStats.onRenderOpaqueTime = 0;
    this._frameStats.translucentTime = 0;
    this._frameStats.overlaysTime = 0;
    this._frameStats.shadowsTime = 0;
    this._frameStats.classifiersTime = 0;
    this._frameStats.screenspaceEffectsTime = 0;
    this._frameStats.backgroundTime = 0;
  }

  public constructor(onFrameStatsReady?: OnFrameStatsReadyEvent) { this._onFrameStatsReady = onFrameStatsReady; }

  private _begin(entry: keyof FrameStats) {
    const prevSpan = this._frameStats[entry];
    this._frameStats[entry] = Date.now() - prevSpan;
  }

  private _end(entry: keyof FrameStats) {
    const beginTime = this._frameStats[entry];
    this._frameStats[entry] = Date.now() - beginTime;
  }

  public beginFrame() {
    this._shouldRecordFrame = undefined !== this._onFrameStatsReady && this._onFrameStatsReady.numberOfListeners > 0;
  }

  public endFrame(wasFrameDrawn = false) {
    if (this._shouldRecordFrame) {
      if (wasFrameDrawn) {
        if (undefined !== this._onFrameStatsReady)
          this._onFrameStatsReady.raiseEvent(this._frameStats); // transmit this frame's statistics to any listeners
        this._frameStats.frameId++; // increment frame counter for next pending frame
      }
      this._clearStats();
      this._shouldRecordFrame = false;
    }
  }

  public beginTime(entry: keyof FrameStats) {
    if (this._shouldRecordFrame)
      this._begin(entry);
  }

  public endTime(entry: keyof FrameStats) {
    if (this._shouldRecordFrame)
      this._end(entry);
  }
}
