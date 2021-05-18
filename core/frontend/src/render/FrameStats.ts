/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { BeEvent } from "@bentley/bentleyjs-core";

/** Describes timing statistics for a single rendered frame. Aside from `frameId`, `totalFrameTime`, and `sceneTime`, the other entries may represent operations that are not performed every frame and may contain an expected value of zero.
 * @note By default, the display system does not render frames continuously. The display system will render a new frame only when the view changes. Therefore, the data contained within this interface cannot directly be used to compute a representative framerate.
 * @alpha
 */
export interface FrameStats {
  /** A unique number identifying the frame to which these statistics belong. */
  frameId: number;
  /** The CPU time in milliseconds spent rendering the frame. This does not include the time described by `sceneTime`. */
  totalFrameTime: number;
  /** The CPU time in milliseconds spent setting up the scene. The includes the following:
   * - performing animations
   * - setting up from view
   * - setting the hilite set
   * - overriding feature symbology
   * - creating and changing the scene if invalid
   * - validating render plan
   * - adding decorations
   * - processing flash
   */
  sceneTime: number;
  /** The CPU time in milliseconds spent rendering opaque geometry. */
  opaqueTime: number;
  /** The CPU time in milliseconds spent rendering translucent geometry. */
  translucentTime: number;
  /** The CPU time in milliseconds spent rendering overlays. */
  overlaysTime: number;
  /** The CPU time in milliseconds spent rendering the solar shadow map. */
  shadowsTime: number;
  /** The CPU time in milliseconds spent rendering both planar and volume classifiers. */
  classifiersTime: number;
  /** The CPU time in milliseconds spent applying screenspace effects. */
  screenspaceEffectsTime: number;
  /** The CPU time in milliseconds spent rendering background geometry including backgrounds, skyboxes, and background maps. */
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
      totalFrameTime: 0,
      sceneTime: 0,
      opaqueTime: 0,
      translucentTime: 0,
      overlaysTime: 0,
      shadowsTime: 0,
      classifiersTime: 0,
      screenspaceEffectsTime: 0,
      backgroundTime: 0,
    };
  }

  private _clearStats() {
    this._frameStats.totalFrameTime = 0;
    this._frameStats.sceneTime = 0;
    this._frameStats.opaqueTime = 0;
    this._frameStats.translucentTime = 0;
    this._frameStats.overlaysTime = 0;
    this._frameStats.shadowsTime = 0;
    this._frameStats.classifiersTime = 0;
    this._frameStats.screenspaceEffectsTime = 0;
    this._frameStats.backgroundTime = 0;
  }

  public set onFrameStatsReady(ev: OnFrameStatsReadyEvent | undefined) { this._onFrameStatsReady = ev; }
  public get onFrameStatsReady(): OnFrameStatsReadyEvent | undefined { return this._onFrameStatsReady; }

  private _begin(entry: keyof FrameStats) {
    const prevSpan = this._frameStats[entry];
    this._frameStats[entry] = Date.now() - prevSpan;
  }

  private _end(entry: keyof FrameStats) {
    const beginTime = this._frameStats[entry];
    this._frameStats[entry] = Date.now() - beginTime;
  }

  public beginFrame(sceneMilSecElapsed = 0) {
    this._shouldRecordFrame = this._onFrameStatsReady !== undefined && this._onFrameStatsReady.numberOfListeners > 0;
    if (this._shouldRecordFrame) {
      this._begin("totalFrameTime");
      this._frameStats.sceneTime = sceneMilSecElapsed;
    }
  }

  public endFrame() {
    if (this._shouldRecordFrame) {
      this._end("totalFrameTime");
      if (this._onFrameStatsReady !== undefined)
        this._onFrameStatsReady.raiseEvent(this._frameStats); // transmit this frame's statistics to any listeners
      this._frameStats.frameId++; // increment frame counter for next pending frame
      this._clearStats();
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
