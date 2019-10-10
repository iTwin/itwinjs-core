/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, GLTimerResult, IModelApp, RenderSystemDebugControl } from "@bentley/imodeljs-frontend";
import { createCheckBox } from "../ui/CheckBox";

export class GpuProfiler {
  private readonly _resultsDiv!: HTMLDivElement;
  private readonly _debugControl: RenderSystemDebugControl;

  public constructor(parent: HTMLElement, _vp: Viewport) {
    this._debugControl = IModelApp.renderSystem.debugControl!;

    const checkBox = createCheckBox({
      parent,
      name: "Profile GPU",
      id: "gpu-profiler-toggle",
      handler: (cb) => this.toggle(cb.checked),
    });
    if (!this._debugControl.isGLTimerSupported) {
      checkBox.checkbox.disabled = true;
      checkBox.div.title = "EXT_disjoint_timer_query is not available in this browser";
      return;
    }

    this._resultsDiv = document.createElement("div") as HTMLDivElement;
    this._resultsDiv.id = "gpu-profiler-results";
    this._resultsDiv.style.display = "none";
    this._resultsDiv.style.textAlign = "left";

    parent.appendChild(this._resultsDiv);
  }

  public dispose(): void {
    this._debugControl.resultsCallback = undefined;
  }

  private toggle(isEnabled: boolean): void {
    if (isEnabled) {
      this._debugControl.resultsCallback = this._resultsCallback;
      this._resultsDiv.style.display = "block";
    } else {
      this._debugControl.resultsCallback = undefined;
      this._resultsDiv.style.display = "none";
    }
  }

  private _resultsCallback = (result: GLTimerResult): void => {
    const fragment = document.createDocumentFragment();

    const printDepth = (depth: number, currentRes: GLTimerResult) => {
      if (currentRes.nanoseconds < 100) // high-pass filter, empty queries have some noise
        return;

      const text = document.createElement("text");
      text.innerText = `${currentRes.label}: ${currentRes.nanoseconds / 1.E6}ms\n`;
      text.style.paddingLeft = depth + "em";
      fragment.appendChild(text);

      if (!currentRes.children)
        return;

      for (const childRes of currentRes.children)
        printDepth(depth + 1, childRes);
    };
    printDepth(0, result);

    this._resultsDiv.innerHTML = "";
    this._resultsDiv.appendChild(fragment);
  }
}
