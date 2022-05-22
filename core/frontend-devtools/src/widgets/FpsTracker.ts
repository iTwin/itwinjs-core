/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Widgets
 */

import { PerformanceMetrics, Target, Viewport } from "@itwin/core-frontend";
import { createCheckBox } from "../ui/CheckBox";

/** Displays average frames-per-second.
 * NOTE: Enabling fps tracking causes a new frame to render on every tick of the render loop, which may negatively impact battery life.
 * @beta
 */
export class FpsTracker {
  private readonly _label: HTMLLabelElement;
  private _metrics?: PerformanceMetrics;
  private _curIntervalId?: NodeJS.Timer;
  private readonly _vp: Viewport;

  public constructor(parent: HTMLElement, viewport: Viewport) {
    this._vp = viewport;
    this._label = createCheckBox({
      parent,
      name: "Track FPS",
      id: "fpsTracker_toggle",
      handler: (cb) => this.toggle(cb.checked),
    }).label;
  }

  public dispose(): void {
    this.toggle(false);
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private toggle(enabled: boolean): void {
    this._vp.continuousRendering = enabled;
    if (enabled) {
      this._metrics = new PerformanceMetrics(false, true);
      this._curIntervalId = setInterval(() => this.updateFPS(), 500);
      this._label.innerText = "Tracking FPS...";
    } else {
      this._metrics = undefined;
      this.clearInterval();
      this._label.innerText = "Track FPS";
    }

    (this._vp.target as Target).performanceMetrics = this._metrics;
  }

  private updateFPS(): void {
    const metrics = this._metrics!;
    const fps = (metrics.spfTimes.length / metrics.spfSum).toFixed(2);
    this._label.innerText = `FPS: ${fps}`;
  }
}
