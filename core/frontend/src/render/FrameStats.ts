/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { BeTimePoint } from "@bentley/bentleyjs-core";

/** Describes timing statistics for a single rendered frame.
 * @beta
 */
export interface FrameStats {
  /** A unique number identifying the frame to which these statistics belong. */
  frameId: number;
  /** The CPU time in milliseconds spent rendering the frame. */
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

/** A callback which will return a frame statistics object.
 * @see [[Viewport.enableFrameStatsCallback]]
 * @beta
 */
export type FrameStatsCallback = (stats: FrameStats) => void;

/** @internal */
export class FrameStatsCollector {
  private _frameStats = FrameStatsCollector._createStats();
  private _frameStatsCallback?: FrameStatsCallback;
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

  private _cloneStats() {
    return {
      frameId: this._frameStats.frameId,
      totalFrameTime: this._frameStats.totalFrameTime,
      sceneTime: this._frameStats.sceneTime,
      opaqueTime: this._frameStats.opaqueTime,
      translucentTime: this._frameStats.translucentTime,
      overlaysTime: this._frameStats.overlaysTime,
      shadowsTime: this._frameStats.shadowsTime,
      classifiersTime: this._frameStats.classifiersTime,
      screenspaceEffectsTime: this._frameStats.screenspaceEffectsTime,
      backgroundTime: this._frameStats.backgroundTime,
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

  public set frameStatsCallback(cb: FrameStatsCallback | undefined) { this._frameStatsCallback = cb; }
  public get frameStats() { return this._frameStats; }

  private _begin(entry: keyof FrameStats) {
    const prevSpan = this._frameStats[entry];
    this._frameStats[entry] = BeTimePoint.now().milliseconds - prevSpan;
  }

  private _end(entry: keyof FrameStats) {
    const beginTime = this._frameStats[entry];
    this._frameStats[entry] = BeTimePoint.now().milliseconds - beginTime;
  }

  public beginFrame(sceneMilSecElapsed = 0, readPixels = false) {
    this._shouldRecordFrame = this._frameStatsCallback !== undefined;
    if (this._shouldRecordFrame && !readPixels) {
      this._begin("totalFrameTime");
      this._frameStats.sceneTime = sceneMilSecElapsed;
    }
  }

  public endFrame(readPixels = false) {
    if (this._shouldRecordFrame && !readPixels) {
      this._end("totalFrameTime");
      if (this._frameStatsCallback !== undefined)
        this._frameStatsCallback(this._cloneStats()); // copy this frame's statistics to the callback
      this._frameStats.frameId++; // increment frame counter for next pending frame
      this._clearStats();
    }
  }

  public beginTime(entry: keyof FrameStats, readPixels = false) {
    if (this._shouldRecordFrame && !readPixels)
      this._begin(entry);
  }

  public endTime(entry: keyof FrameStats, readPixels = false) {
    if (this._shouldRecordFrame && !readPixels)
      this._end(entry);
  }
}
