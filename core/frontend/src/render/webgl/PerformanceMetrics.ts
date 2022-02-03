/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { BeTimePoint, StopWatch } from "@itwin/core-bentley";
import type { GLTimerResultCallback } from "../RenderSystem";
import type { FrameBuffer } from "./FrameBuffer";
import { System } from "./System";

interface AllTimePoints {
  begin: BeTimePoint;
  end: BeTimePoint;
  name: string;
}

/** @internal */
export class PerformanceMetrics {
  private _beginTimePoints: BeTimePoint[] = []; // stack of time points
  private _operationNames: string[] = []; // stack of operation names
  private _allTimePoints1: AllTimePoints[] = []; // queue 1 of data needed to make frameTimings; use 2 copies for double buffering
  private _allTimePoints2: AllTimePoints[] = []; // queue 2 of data needed to make frameTimings; use 2 copies for double buffering
  private _updateallTimePoints1 = true; // determine which buffer to use for the frame timings; used for double buffering the frame timings
  public frameTimings = new Map<string, number>();
  public gatherGlFinish = false; // Set to true if gathering data for display-performance-test-app
  public gatherCurPerformanceMetrics = false; // Set to true if gathering data for Profile GPU
  public curSpfTimeIndex = 0;
  public spfTimes: number[] = [];
  public spfSum: number = 0;
  public fpsTimer: StopWatch = new StopWatch(undefined, true);
  public fpsTimerStart: number = 0;

  public constructor(gatherGlFinish = false, gatherCurPerformanceMetrics = false, gpuResults?: GLTimerResultCallback) {
    this.gatherGlFinish = gatherGlFinish;
    this.gatherCurPerformanceMetrics = gatherCurPerformanceMetrics;
    if (gpuResults)
      System.instance.debugControl.resultsCallback = gpuResults;
  }

  public beginFrame(sceneTime: number = 0) {
    this._beginTimePoints = [];
    this._operationNames = [];
    this.frameTimings = new Map<string, number>();
    this.frameTimings.set("Scene Time", sceneTime);
    this._operationNames.push("Total Time");
    this._operationNames.push("CPU Total Time");
    const now = BeTimePoint.now();
    this._beginTimePoints.push(now); // this first time point used to calculate total time at the end
    this._beginTimePoints.push(now); // this second time point used to calculate total cpu time at the end
  }

  public beginOperation(operationName: string) {
    this._operationNames.push(operationName);
    this._beginTimePoints.push(BeTimePoint.now());
  }

  public endOperation() {
    const endTimePoint = BeTimePoint.now();
    const beginTimePoint = this._beginTimePoints.length > 0 ? this._beginTimePoints.pop()! : endTimePoint;
    const operationName = this._operationNames.pop();
    if (operationName) { // Add data to queue now, calculate time later; helps eliminate time spent timing things in 'Total Time'
      if (this._updateallTimePoints1) // Push to currently active allTimePoints buffer
        this._allTimePoints1.push({ begin: beginTimePoint, end: endTimePoint, name: operationName });
      else
        this._allTimePoints2.push({ begin: beginTimePoint, end: endTimePoint, name: operationName });
    }
  }

  public endFrame() {
    this.endOperation();

    // Use double buffering here to ensure that we grab a COMPLETE set of timings from a SINGLE run when grabbing timing data while continuously rendering
    this._updateallTimePoints1 = !this._updateallTimePoints1; // Switch to other allTimePoints buffer
    if (this._updateallTimePoints1) { // Get data from the old buffer that was just completed
      this._allTimePoints2.forEach((record: AllTimePoints) => { this.frameTimings.set(record.name, record.end.milliseconds - record.begin.milliseconds); });
      this._allTimePoints2 = []; // Reset to empty
    } else {
      this._allTimePoints1.forEach((record: AllTimePoints) => { this.frameTimings.set(record.name, record.end.milliseconds - record.begin.milliseconds); });
      this._allTimePoints1 = []; // Reset to empty
    }
    this._beginTimePoints = []; // This should be back to [] at this point
    this._operationNames = []; // This should be back to [] at this point
  }

  public completeFrameTimings(fbo: FrameBuffer): void {
    if (this.gatherCurPerformanceMetrics) {
      const fpsTimerElapsed = this.fpsTimer.currentSeconds - this.fpsTimerStart;
      if (this.spfTimes[this.curSpfTimeIndex])
        this.spfSum -= this.spfTimes[this.curSpfTimeIndex];

      this.spfSum += fpsTimerElapsed;
      this.spfTimes[this.curSpfTimeIndex] = fpsTimerElapsed;

      this.curSpfTimeIndex++;
      if (this.curSpfTimeIndex >= 50)
        this.curSpfTimeIndex = 0;

      this.fpsTimerStart = this.fpsTimer.currentSeconds;
    }

    const system = System.instance;
    if (this.gatherGlFinish && !system.isGLTimerSupported) {
      this.beginOperation("Finish GPU Queue");

      // Ensure all previously queued webgl commands are finished by reading back one pixel since gl.Finish didn't work
      const bytes = new Uint8Array(4);
      const gl = system.context;
      system.frameBufferStack.execute(fbo, true, false, () => {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      });

      this.endOperation();
    }

    this.endFrame();
  }
}
