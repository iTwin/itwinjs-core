/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  PerformanceMetrics,
  Target,
  Viewport,
} from "@bentley/imodeljs-frontend";

class FpsTracker {
  private readonly _label: HTMLLabelElement;
  private _metrics?: PerformanceMetrics;
  private _curIntervalId?: NodeJS.Timer;

  public constructor(parent: HTMLElement, viewport: Viewport) {
    const div = document.createElement("div");
    div.style.display = "block";

    const cb = document.createElement("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.id = "fpsCheckBox";
    cb.addEventListener("click", () => this.toggle(viewport, cb.checked));
    div.appendChild(cb);

    const label = document.createElement("label") as HTMLLabelElement;
    label.htmlFor = cb.id;
    label.innerText = "Track FPS";
    div.appendChild(label);
    this._label = label;

    parent.appendChild(div);
  }

  private toggle(viewport: Viewport, enabled: boolean): void {
    viewport.continuousRendering = enabled;
    if (enabled) {
      this._metrics = new PerformanceMetrics(false, true);
      this._curIntervalId = setInterval(() => this.updateFPS(), 500);
      this._label.innerText = "Tracking FPS...";
    } else {
      this._metrics = undefined;
      clearInterval(this._curIntervalId!);
      this._curIntervalId = undefined;
      this._label.innerText = "Track FPS";
    }

    (viewport.target as Target).performanceMetrics = this._metrics;
  }

  private updateFPS(): void {
    const metrics = this._metrics!;
    const fps = (metrics.spfTimes.length / metrics.spfSum).toFixed(2);
    this._label.innerText = "FPS: " + fps;
  }
}

export function addFpsTracker(parent: HTMLElement, viewport: Viewport): void {
  new FpsTracker(parent, viewport);
}
