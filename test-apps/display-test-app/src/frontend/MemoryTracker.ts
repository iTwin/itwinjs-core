/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  TileTreeModelState,
  RenderMemory,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { assert } from "@bentley/bentleyjs-core";
import { createComboBox, ComboBoxEntry } from "./ComboBox";

function collectTileTreeMemory(stats: RenderMemory.Statistics, model: TileTreeModelState): void {
  const tree = model.tileTree;
  if (undefined !== tree)
    tree.collectStatistics(stats);
}

type CalcMem = (stats: RenderMemory.Statistics, vp: Viewport) => void;
type PurgeMem = (vp: Viewport) => void;

const enum MemIndex {
  None = -1,
  ViewportTileTrees,
  AllTileTrees,

  COUNT,
}

// Includes None (-1) at index 0
const memLabels = [
  "None",
  "Viewed Tile Trees",
  "All Tile Trees",
];

const calcMem: CalcMem[] = [
  (stats, vp) => vp.view.forEachTileTreeModel((model) => collectTileTreeMemory(stats, model)),
  (stats, vp) => vp.view.iModel.models.loaded.forEach((model, _id) => {
    const geomModel = model.asGeometricModel;
    if (undefined !== geomModel)
      collectTileTreeMemory(stats, geomModel);
  }),
];

// ###TODO...
const purgeMem: Array<PurgeMem | undefined> = [
  undefined,
  (_vp) => undefined,
];

function formatMemory(numBytes: number): string {
  let suffix = "b";
  if (numBytes >= 1024) {
    numBytes /= 1024;
    suffix = "kb";
    if (numBytes >= 1024) {
      numBytes /= 1024;
      suffix = "mb";
    }
  }

  return numBytes.toFixed(2) + suffix;
}

class MemoryPanel {
  private readonly _label: string;
  private readonly _labels: string[];
  private readonly _elems: HTMLElement[] = [];
  private readonly _div: HTMLDivElement;
  private readonly _header: HTMLElement;

  public constructor(parent: HTMLElement, label: string, labels: string[]) {
    this._label = label;
    this._labels = labels;
    this._div = document.createElement("div") as HTMLDivElement;

    this._header = document.createElement("label")!;
    this._header.style.fontWeight = "bold";
    this._div.appendChild(this._header);

    const numElems = labels.length; // because stupid tslint is stupid.
    for (let i = 0; i < numElems; i++) {
      const elem = document.createElement("label");
      this._elems.push(elem);
      this._div.appendChild(elem);
    }

    this._div.appendChild(document.createElement("hr")!);

    parent.appendChild(this._div);

    // WIP - unused variables
    assert(undefined !== this._elems);
  }

  public update(stats: RenderMemory.Consumers[], total: number): void {
    assert(this._labels.length === stats.length);
    assert(this._labels.length === this._elems.length);

    this._header.innerHTML = this._label + ": " + formatMemory(total);

    for (let i = 0; i < this._labels.length; i++) {
      const elem = this._elems[i];
      const stat = stats[i];
      if (0 === stat.totalBytes) {
        elem.style.display = "none";
        continue;
      }

      elem.style.display = "block";
      elem.innerHTML = this._labels[i] + " (" + stat.count + "): " + formatMemory(stat.totalBytes); // + "\n(max: " + formatMemory(stat.maxBytes) + ")";
    }
  }
}

export class MemoryTracker {
  private readonly _stats = new RenderMemory.Statistics();
  private readonly _vp: Viewport;
  private readonly _div: HTMLDivElement;
  private _curIntervalId?: NodeJS.Timer;
  private _memIndex = MemIndex.None;
  private readonly _totalElem: HTMLElement;
  private readonly _purgeButton: HTMLButtonElement;
  private readonly _textures: MemoryPanel;
  private readonly _buffers: MemoryPanel;

  public constructor(parent: HTMLElement, vp: Viewport) {
    this._vp = vp;

    this._div = document.createElement("div") as HTMLDivElement;
    this._div.style.display = "none";
    this._div.style.textAlign = "right";

    this.addSelector(parent);

    this._textures = new MemoryPanel(this._div, "Textures", ["Surface Textures", "Vertex Tables", "Feature Tables", "Feature Overrides", "Clip Volumes", "Planar Classifiers", "Shadow Maps"]);
    this._buffers = new MemoryPanel(this._div, "Buffers", ["Surfaces", "Visible Edges", "Silhouettes", "Polyline Edges", "Polylines", "Point Strings", "Point Clouds", "Instances"]);
    this._totalElem = this.addStatistics(this._div);

    this._purgeButton = this.addPurgeButton(this._div);

    parent.appendChild(this._div);
  }

  public dispose(): void {
    this.clearInterval();
  }

  private addSelector(parent: HTMLElement): void {
    const entries: Array<ComboBoxEntry<MemIndex>> = [];
    for (let i = MemIndex.None; i < MemIndex.COUNT; i++)
      entries.push({ name: memLabels[i + 1], value: i });

    createComboBox({
      parent,
      name: "Track Memory: ",
      id: "memTracker_type",
      value: MemIndex.None,
      handler: (select) => this.change(Number.parseInt(select.value, 10)),
      entries,
    });
  }

  private addPurgeButton(parent: HTMLElement): HTMLButtonElement {
    const div = document.createElement("div");
    div.style.textAlign = "center";

    const button = document.createElement("button");
    button.innerText = "Purge";
    button.click = () => this.purge();

    div.appendChild(button);
    parent.appendChild(div);

    return button;
  }

  private addStatistics(parent: HTMLElement): HTMLElement {
    const div = document.createElement("div");
    const text = document.createElement("text");
    text.style.fontWeight = "bold";
    div.appendChild(text);
    parent.appendChild(div);
    return text;
  }

  private clearInterval(): void {
    if (undefined !== this._curIntervalId) {
      clearInterval(this._curIntervalId);
      this._curIntervalId = undefined;
    }
  }

  private change(newIndex: MemIndex): void {
    if (newIndex === this._memIndex)
      return;

    this._memIndex = newIndex;
    if (MemIndex.None === newIndex) {
      this.clearInterval();
      this._div.style.display = "none";
      return;
    }

    if (undefined === this._curIntervalId) {
      this._curIntervalId = setInterval(() => this.update(), 1000);
      this._div.style.display = "block";
    }

    this._purgeButton.disabled = undefined === purgeMem[this._memIndex];

    this.update();
  }

  private update(): void {
    const calc = calcMem[this._memIndex];
    this._stats.clear();
    calc(this._stats, this._vp);
    this._totalElem.innerText = "Total: " + formatMemory(this._stats.totalBytes);

    this._textures.update(this._stats.consumers, this._stats.totalBytes - this._stats.buffers.totalBytes);
    this._buffers.update(this._stats.buffers.consumers, this._stats.buffers.totalBytes);
  }

  private purge(): void {
    const purge = purgeMem[this._memIndex];
    if (undefined !== purge) {
      purge(this._vp);
      this.update();
    }
  }
}
