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
  private readonly _tileDepthDiv: HTMLDivElement;
  private readonly _renderedDepth: HTMLElement;
  private readonly _overallDepth: HTMLElement;

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

    // Tile depth statistics section
    this._div.appendChild(this._tileDepthDiv = document.createElement("div"));
    this._tileDepthDiv.style.marginTop = "4px";
    this._tileDepthDiv.style.borderTop = "1px solid gray";
    this._tileDepthDiv.style.paddingTop = "4px";

    this._tileDepthDiv.appendChild(this._renderedDepth = document.createElement("div"));
    this._renderedDepth.innerText = "Rendered tile depth: 0";

    this._tileDepthDiv.appendChild(this._overallDepth = document.createElement("div"));
    this._overallDepth.innerText = "Overall tile depth: 0";
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

    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      const tiles = IModelApp.tileAdmin.getTilesForUser(vp)?.selected;
      let maxRenderedDepth = 0;
      let maxOverallDepth = 0;
      if (tiles) {
        for (const tile of tiles) {
          if (tile.depth > maxRenderedDepth)
            maxRenderedDepth = tile.depth;
          if (tile.tree.deepestTileDepth > maxOverallDepth)
            maxOverallDepth = tile.tree.deepestTileDepth;
        }
      }
      this._renderedDepth.innerText = `Rendered tile depth: ${maxRenderedDepth}`;
      this._overallDepth.innerText = `Overall tile depth: ${maxOverallDepth}`;
    }
  }
}
