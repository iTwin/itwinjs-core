/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widgets
 */

import { IModelApp } from "@itwin/core-frontend";
import { createCheckBox } from "../ui/CheckBox";

export class RenderCommandBreakdown {
  private readonly _div: HTMLDivElement;
  private readonly _cellDiv: HTMLDivElement;
  private _curIntervalId?: number;
  private readonly _cells = new Map<string, HTMLElement>();
  private readonly _total: HTMLElement;
  private readonly _primStatsDiv: HTMLDivElement;
  private readonly _triangles: HTMLElement;
  private readonly _lines: HTMLElement;
  private readonly _points: HTMLElement;
  private readonly _occlusionDiv: HTMLDivElement;
  private readonly _occlusionTested: HTMLElement;
  private readonly _occlusionCulled: HTMLElement;

  public constructor(parent: HTMLElement) {
    createCheckBox({
      parent,
      name: "Render Commands",
      id: "renderCommandBreakdown",
      handler: () => this.toggle(),
    });

    parent.appendChild(this._div = document.createElement("div"));
    this._div.style.display = "none";
    this._div.style.textAlign = "left";

    this._div.appendChild(this._cellDiv = document.createElement("div"));

    this._div.appendChild(this._total = document.createElement("div"));
    this._total.innerText = "Total: 0";

    // Primitive statistics section
    this._div.appendChild(this._primStatsDiv = document.createElement("div"));
    this._primStatsDiv.style.marginTop = "4px";
    this._primStatsDiv.style.borderTop = "1px solid gray";
    this._primStatsDiv.style.paddingTop = "4px";

    this._primStatsDiv.appendChild(this._triangles = document.createElement("div"));
    this._triangles.innerText = "Triangles: 0";

    this._primStatsDiv.appendChild(this._lines = document.createElement("div"));
    this._lines.innerText = "Lines: 0";

    this._primStatsDiv.appendChild(this._points = document.createElement("div"));
    this._points.innerText = "Points: 0";

    // Occlusion culling statistics section
    this._div.appendChild(this._occlusionDiv = document.createElement("div"));
    this._occlusionDiv.style.marginTop = "4px";
    this._occlusionDiv.style.borderTop = "1px solid gray";
    this._occlusionDiv.style.paddingTop = "4px";

    createCheckBox({
      parent: this._occlusionDiv,
      name: "Occlusion Culling",
      id: "occlusionCulling",
      isChecked: IModelApp.viewManager.selectedView?.target.debugControl?.occlusionCulling ?? false,
      handler: (cb) => {
        const ctrl = IModelApp.viewManager.selectedView?.target.debugControl;
        if (ctrl)
          ctrl.occlusionCulling = cb.checked;
      },
    });

    createCheckBox({
      parent: this._occlusionDiv,
      name: "Freeze Occlusion",
      id: "freezeOcclusion",
      isChecked: IModelApp.viewManager.selectedView?.target.debugControl?.occlusionFrozen ?? false,
      handler: (cb) => {
        const ctrl = IModelApp.viewManager.selectedView?.target.debugControl;
        if (ctrl)
          ctrl.occlusionFrozen = cb.checked;
      },
    });

    this._occlusionDiv.appendChild(this._occlusionTested = document.createElement("div"));
    this._occlusionTested.innerText = "Occlusion tested: 0";

    this._occlusionDiv.appendChild(this._occlusionCulled = document.createElement("div"));
    this._occlusionCulled.innerText = "Occlusion culled: 0";
  }

  public [Symbol.dispose](): void {
    this.clearInterval();
  }

  private toggle(): void {
    if (undefined !== this._curIntervalId) {
      this._div.style.display = "none";
      this.clearInterval();
    } else {
      this._div.style.display = "block";
      this.update();
      this._curIntervalId = window.setInterval(() => this.update(), 500);
    }
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      window.clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private update(): void {
    const ctrl = IModelApp.viewManager.selectedView?.target.debugControl;
    if (!ctrl)
      return;

    const cmds = ctrl.getRenderCommands();
    let total = 0;
    for (const cmd of cmds) {
      let cell = this._cells.get(cmd.name);
      if (!cell) {
        this._cellDiv.appendChild(cell = document.createElement("div"));
        this._cells.set(cmd.name, cell);
      }

      total += cmd.count;
      cell.innerText = `${cmd.name}: ${cmd.count}`;
    }

    this._total.innerText = `Total: ${total}`;

    const primStats = ctrl.getPrimitiveStatistics();
    this._triangles.innerText = `Triangles: ${primStats.triangles.toLocaleString()}`;
    this._lines.innerText = `Lines: ${primStats.lines.toLocaleString()}`;
    this._points.innerText = `Points: ${primStats.points.toLocaleString()}`;

    const occStats = ctrl.getOcclusionStats();
    if (occStats.enabled) {
      this._occlusionTested.style.display = "block";
      this._occlusionCulled.style.display = "block";
      this._occlusionTested.innerText = `Occlusion tested: ${occStats.tested.toLocaleString()}`;
      this._occlusionCulled.innerText = `Occlusion culled: ${occStats.occluded.toLocaleString()}`;
    } else {
      this._occlusionTested.style.display = "none";
      this._occlusionCulled.style.display = "none";
    }
  }
}
