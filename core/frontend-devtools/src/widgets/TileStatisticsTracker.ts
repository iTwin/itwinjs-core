/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Widgets
 */

import { IModelApp, TileAdmin, Viewport } from "@itwin/core-frontend";
import { createButton } from "../ui/Button";
import { createCheckBox } from "../ui/CheckBox";
import { createNumericInput } from "../ui/NumericInput";

type GetStatValue = (stats: TileAdmin.Statistics, vp: Viewport) => number;
interface StatEntry {
  label: string;
  getValue: GetStatValue;
}

function computeProgress(vp: Viewport): number {
  const ready = vp.numReadyTiles;
  const requested = vp.numRequestedTiles;
  const total = ready + requested;
  const ratio = (total > 0) ? (ready / total) : 1.0;
  return Math.round(ratio * 100);
}

const statEntries: StatEntry[] = [
  { getValue: (stats, vp) => stats.numActiveRequests + (IModelApp.tileAdmin.getTilesForViewport(vp)?.external.requested ?? 0), label: "Active" },
  { getValue: (stats, _vp) => stats.numPendingRequests, label: "Pending" },
  { getValue: (stats, _vp) => stats.numCanceled, label: "Canceled" },
  { getValue: (stats, _vp) => stats.numActiveRequests + stats.numPendingRequests, label: "Total" },
  { getValue: (_stats, vp) => vp.numSelectedTiles, label: "Selected" },
  { getValue: (_stats, vp) => vp.numReadyTiles, label: "Ready" },
  { getValue: (_stats, vp) => computeProgress(vp), label: "Progress" },
  { getValue: (stats, _vp) => stats.totalCompletedRequests, label: "Completed" },
  { getValue: (stats, _vp) => stats.totalTimedOutRequests, label: "Timed Out" },
  { getValue: (stats, _vp) => stats.totalFailedRequests, label: "Failed" },
  { getValue: (stats, _vp) => stats.totalEmptyTiles, label: "Empty" },
  { getValue: (stats, _vp) => stats.totalUndisplayableTiles, label: "Undisplayable" },
  { getValue: (stats, _vp) => stats.totalElidedTiles, label: "Elided" },
  { getValue: (stats, _vp) => stats.totalCacheMisses, label: "Cache Misses" },
  { getValue: (stats, _vp) => stats.totalDispatchedRequests, label: "Dispatched" },
  { getValue: (stats, _vp) => stats.totalAbortedRequests, label: "Aborted" },
];

const indexOfFirstGlobalStatistic = 7; // "Completed"

/** Outputs statistics related to tile requests including the current number of active, pending, selected, and ready tile requests; as well as cumulative statistics for the session including the number of failed, timed-out, empty, and elided tile requests.
 * @beta
 */
export class TileStatisticsTracker {
  private readonly _statElements: HTMLElement[] = [];
  private readonly _div: HTMLDivElement;
  private readonly _vp: Viewport;
  private _curIntervalId?: NodeJS.Timer;

  public constructor(parent: HTMLElement, vp: Viewport) {
    this._vp = vp;
    this.addMaxActive(parent);
    createCheckBox({
      parent,
      name: "Track Tile Requests",
      id: "stats_trackMemory",
      handler: (_cb) => this.toggle(),
    });

    this._div = document.createElement("div");
    this._div.style.display = "none";
    this._div.style.textAlign = "right";

    const table = document.createElement("table");
    table.style.width = "100%";
    table.setAttribute("border", "1");
    this._div.appendChild(table);

    const row = document.createElement("tr");
    const frameColumn = document.createElement("td");
    const globalColumn = document.createElement("td");
    frameColumn.style.width = globalColumn.style.width = "50%";
    row.appendChild(frameColumn);
    row.appendChild(globalColumn);
    table.appendChild(row);

    for (let i = 0; i < statEntries.length; i++) {
      const div = document.createElement("div");
      const elem = document.createElement("text");
      this._statElements[i] = elem;
      div.appendChild(elem);

      const column = i >= indexOfFirstGlobalStatistic ? globalColumn : frameColumn;
      column.appendChild(div);
    }

    const resetButton = createButton({
      parent: this._div,
      value: "Reset",
      tooltip: "Reset all cumulative statistics",
      handler: () => this.reset(),
    });
    resetButton.div.style.textAlign = "center";

    parent.appendChild(this._div);
  }

  public dispose(): void {
    this.clearInterval();
  }

  private addMaxActive(parent: HTMLElement): void {
    const div = document.createElement("div");

    const label = document.createElement("label");
    label.style.display = "inline";
    label.htmlFor = "maxActiveRequests";
    label.innerText = "Max Active Requests: ";
    div.appendChild(label);

    createNumericInput({
      parent: div,
      id: "maxActiveRequests",
      display: "inline",
      min: 0,
      step: 1,
      value: IModelApp.tileAdmin.channels.rpcConcurrency,
      handler: (value, _input) => this.updateMaxActive(value),
    });

    parent.appendChild(div);
  }

  private updateMaxActive(value: number): void {
    IModelApp.tileAdmin.channels.setRpcConcurrency(value);
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private toggle(): void {
    if (undefined !== this._curIntervalId) {
      // Currently on - turn off.
      this._div.style.display = "none";
      this.clearInterval();
    } else {
      // Currently off - turn on.
      this._div.style.display = "block";
      this.update();
      this._curIntervalId = setInterval(() => this.update(), 500);
    }
  }

  private update(): void {
    const stats = IModelApp.tileAdmin.statistics;
    for (let i = 0; i < statEntries.length; i++) {
      const stat = statEntries[i];
      const label = `${stat.label}: ${stat.getValue(stats, this._vp)}`;
      this._statElements[i].innerText = label;
    }
  }

  private reset(): void {
    IModelApp.tileAdmin.resetStatistics();
    this.update();
  }
}
