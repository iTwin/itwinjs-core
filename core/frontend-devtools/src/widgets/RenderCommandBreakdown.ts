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
  private _curIntervalId?: NodeJS.Timer;
  private readonly _cells = new Map<string, HTMLElement>();
  private readonly _total: HTMLElement;

  public constructor(parent: HTMLElement) {
    createCheckBox({
      parent,
      name: "Render Commands",
      id: "renderCommandBreakdown",
      handler: () => this.toggle(),
    });

    parent.appendChild(this._div = document.createElement("div"));
    this._div.style.display = "none";
    this._div.style.textAlign = "right";

    this._div.appendChild(this._cellDiv = document.createElement("div"));

    this._div.appendChild(this._total = document.createElement("div"));
    this._total.innerText = "Total: 0";
  }

  public dispose(): void {
    this.clearInterval();
  }

  private toggle(): void {
    if (undefined !== this._curIntervalId) {
      this._div.style.display = "none";
      this.clearInterval();
    } else {
      this._div.style.display = "block";
      this.update();
      this._curIntervalId = setInterval(() => this.update(), 500);
    }
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
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
  }
}
