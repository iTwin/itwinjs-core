/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  ScreenViewport,
} from "@bentley/imodeljs-frontend";

export interface FpsMonitorProps {
  checkbox: HTMLInputElement;
  label: HTMLLabelElement;
  output: HTMLSpanElement;
}

export class FpsMonitor {
  private readonly _checkbox: HTMLInputElement;
  private readonly _label: HTMLLabelElement;
  private readonly _output: HTMLSpanElement;
  private _enabled = false;
  private _prevTime = 0;
  private _frameCount = 0;

  public constructor(props: FpsMonitorProps) {
    this._checkbox = props.checkbox;
    this._label = props.label;
    this._output = props.output;

    IModelApp.viewManager.onViewOpen.addListener((vp: ScreenViewport) => this.onViewOpen(vp));
    this._checkbox.addEventListener("click", () => this.enabled = this._checkbox.checked);
  }

  private onViewOpen(vp: ScreenViewport): void {
    if (this._enabled)
      vp.continuousRendering = true;
  }

  public get enabled() { return this._enabled; }
  public set enabled(enabled: boolean) {
    if (enabled === this.enabled)
      return;

    this._enabled = enabled;
    this._frameCount = 0;
    IModelApp.viewManager.forEachViewport((vp) => vp.continuousRendering = enabled);
    this._label.innerText = "FPS" + (this.enabled ? ":" : "");
    this._output.innerText = "";
    if (enabled) {
      this._prevTime = performance.now();
      requestAnimationFrame(() => this.update());
    }
  }

  private update(): void {
    if (!this.enabled)
      return;

    ++this._frameCount;
    const curTime = performance.now();
    if (curTime >= this._prevTime + 1000) {
      const fps = (this._frameCount * 1000) / (curTime - this._prevTime);
      this._output.innerText = fps.toFixed(2);

      this._prevTime = curTime;
      this._frameCount = 0;
    }

    requestAnimationFrame(() => this.update());
  }
}
