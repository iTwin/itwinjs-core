/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widgets
 */

import { IModelApp, IModelConnection, RenderMemory, Tile } from "@bentley/imodeljs-frontend";
import { createCheckBox } from "../ui/CheckBox";
import { formatMemory } from "./MemoryTracker";

interface TileMemoryCounter {
  numTiles: number;
  bytesUsed: number;
}

enum TileMemorySelector {
  Selected, // Tiles selected for display by at least one viewport.
  Ancestors, // Ancestors of selected tiles, themselves not selected for display by any viewport.
  Descendants, // Descendants of selected tiles, themselves not selected for display by any viewport.
  Orphaned, // Tiles not selected for display having no ancestors nor descendants selected for display.
  Total, // Total of all the above
  Count,
}

class TileMemoryTracer {
  private readonly _stats = new RenderMemory.Statistics();
  private readonly _processedTiles = new Set<Tile>();
  public readonly counters: TileMemoryCounter[] = [];
  public numSelected = 0;

  public constructor() {
    for (let i = 0; i < TileMemorySelector.Count; i++)
      this.counters.push({ numTiles: 0, bytesUsed: 0 });
  }

  public update(): void {
    this.reset();

    const imodels = new Set<IModelConnection>();
    const selectedTiles = new Set<Tile>();
    IModelApp.viewManager.forEachViewport((vp) => {
      imodels.add(vp.iModel);
      const tiles = IModelApp.tileAdmin.getTilesForViewport(vp)?.selected;
      if (tiles)
        for (const tile of tiles)
          selectedTiles.add(tile);
    });

    for (const selected of selectedTiles)
      this.add(selected, TileMemorySelector.Selected);

    for (const selected of selectedTiles) {
      this.processParent(selected.parent);
      this.processChildren(selected.children);
    }

    for (const imodel of imodels) {
      imodel.tiles.forEachTreeOwner((owner) => {
        const tree = owner.tileTree;
        if (tree)
          this.processOrphan(tree.rootTile);
      });
    }

    this.counters[TileMemorySelector.Total].numTiles = this.counters.reduce((accum, counter) => accum + counter.numTiles, 0);
    this.counters[TileMemorySelector.Total].bytesUsed = this.counters.reduce((accum, counter) => accum + counter.bytesUsed, 0);
  }

  private reset(): void {
    this._processedTiles.clear();
    this.numSelected = 0;
    for (const counter of this.counters)
      counter.numTiles = counter.bytesUsed = 0;
  }

  private add(tile: Tile, selector: TileMemorySelector): void {
    this._processedTiles.add(tile);
    this._stats.clear();
    tile.collectStatistics(this._stats, false);

    const bytesUsed = this._stats.totalBytes;
    if (bytesUsed > 0) {
      const counter = this.counters[selector];
      ++counter.numTiles;
      counter.bytesUsed += bytesUsed;
    }
  }

  private processParent(parent: Tile | undefined): void {
    if (parent && !this._processedTiles.has(parent)) {
      this.add(parent, TileMemorySelector.Ancestors);
      this.processParent(parent.parent);
    }
  }

  private processChildren(children: Tile[] | undefined): void {
    if (!children)
      return;

    for (const child of children) {
      if (!this._processedTiles.has(child)) {
        this.add(child, TileMemorySelector.Descendants);
        this.processChildren(child.children);
      }
    }
  }

  private processOrphan(tile: Tile): void {
    if (!this._processedTiles.has(tile))
      this.add(tile, TileMemorySelector.Orphaned);

    const children = tile.children;
    if (children)
      for (const child of children)
        this.processOrphan(child);
  }
}

const labels = ["Selected", "Ancestors", "Descendants", "Orphaned", "Total"];

/** Breaks down the GPU memory allocated to tiles into the following groups, displaying the amount of memory consumed and number of tiles for each group:
 * - "Selected" - tiles that have been selected for display in at least one viewport.
 * - "Ancestors" - tiles not selected for display, but have descendents selected for display.
 * - "Descendants" - tiles not selected for display, but have ancestors selected for display.
 * - "Orphans" - tiles not selected for display that have no ancestors nor descendants selected for display.
 * - "Total" - totals of the above categories.
 *
 * The number of tiles in each group includes only those tiles that are consuming a non-zero amount of GPU memory.
 * The widget includes a checkbox to toggle tracking and display of these statistics.
 * @beta
 */
export class TileMemoryBreakdown {
  private readonly _tracer = new TileMemoryTracer();
  private readonly _div: HTMLDivElement;
  private _curIntervalId?: NodeJS.Timer;
  private readonly _statsElements: HTMLElement[] = [];

  /** Construct a new breakdown widget as a child of the specified parent element. */
  public constructor(parent: HTMLElement) {
    createCheckBox({
      parent,
      name: "Tile Memory Breakdown",
      id: "tileMemoryBreakdown",
      handler: (_cb) => this.toggle(),
    });

    parent.appendChild(this._div = document.createElement("div"));
    this._div.style.display = "none";
    this._div.style.textAlign = "right";
    for (let i = 0; i < TileMemorySelector.Count; i++) {
      const div = document.createElement("div");
      const elem = document.createElement("text");
      this._statsElements.push(elem);
      div.appendChild(elem);
      this._div.appendChild(div);
    }
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
    this._tracer.update();
    for (let i = 0; i < this._statsElements.length; i++) {
      const counter = this._tracer.counters[i];
      this._statsElements[i].innerText = `${counter.numTiles} ${labels[i]}: ${formatMemory(counter.bytesUsed)}`;
    }
  }
}
