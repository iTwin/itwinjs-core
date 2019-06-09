/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  TileAdmin,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { createCheckBox } from "./CheckBox";
import { createNumericInput } from "./NumericInput";
import { createButton } from "./Button";

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
  { getValue: (stats, _vp) => stats.numActiveRequests, label: "Active" },
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
];

/** @alpha */
export class StatsTracker {
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

    this._div = document.createElement("div") as HTMLDivElement;
    this._div.style.display = "none";
    this._div.style.textAlign = "right";

    for (let i = 0; i < statEntries.length; i++) {
      const div = document.createElement("div");
      const elem = document.createElement("text");
      this._statElements[i] = elem;
      div.appendChild(elem);
      this._div.appendChild(div);
    }

    createButton({
      parent: this._div,
      value: "Reset",
      tooltip: "Reset all cumulative statistics",
      handler: () => this.reset(),
    });

    parent.appendChild(this._div);
  }

  public dispose(): void {
    this.clearInterval();
  }

  private addMaxActive(parent: HTMLElement): void {
    const div = document.createElement("div");

    const label = document.createElement("label") as HTMLLabelElement;
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
      value: IModelApp.tileAdmin.maxActiveRequests,
      handler: (value, _input) => this.updateMaxActive(value),
    });

    parent.appendChild(div);
  }

  private updateMaxActive(value: number): void {
    IModelApp.tileAdmin.maxActiveRequests = value;
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
      const label = stat.label + ": " + stat.getValue(stats, this._vp);
      this._statElements[i].innerText = label;
    }
  }

  private reset(): void {
    IModelApp.tileAdmin.resetStatistics();
    this.update();
  }
}
