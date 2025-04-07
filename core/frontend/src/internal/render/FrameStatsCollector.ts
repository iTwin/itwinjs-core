/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { BeEvent } from "@itwin/core-bentley";
import { FrameStats } from "../../render/FrameStats.js";

/** An event which will be raised when a new frame statistics object is available. The listeners will receive that frame statistics object.
 * @see [[Viewport.enableFrameStatsListener]]
 */
export type OnFrameStatsReadyEvent = BeEvent<(frameStats: Readonly<FrameStats>) => void>;

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
