/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { FpsTracker } from "./FpsTracker";
import { MemoryTracker } from "./MemoryTracker";
import { StatsTracker } from "./TileStatisticsTracker";
import { createCheckBox } from "./CheckBox";
import { createComboBox } from "./ComboBox";
import { Viewport, Tile } from "@bentley/imodeljs-frontend";
import { ToolBarDropDown } from "./ToolBar";

export class DebugPanel extends ToolBarDropDown {
  private readonly _viewport: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parentElement: HTMLElement;
  private readonly _fpsTracker: FpsTracker;
  private readonly _memoryTracker: MemoryTracker;
  private readonly _statsTracker: StatsTracker;

  public constructor(vp: Viewport, parentElement: HTMLElement) {
    super();
    this._viewport = vp;
    this._parentElement = parentElement;
    this._element = document.createElement("div");
    this._element.className = "debugPanel";

    this._fpsTracker = new FpsTracker(this._element, vp);

    createCheckBox({
      parent: this._element,
      name: "Freeze Scene",
      handler: (cb) => this._viewport.freezeScene = cb.checked,
      id: "debugPanel_freezeScene",
    });

    this.addBoundingBoxDropdown(this._element);

    this.addSeparator();
    this._statsTracker = new StatsTracker(this._element, vp);

    this.addSeparator();
    this._memoryTracker = new MemoryTracker(this._element, vp);

    parentElement.appendChild(this._element);
  }

  public dispose(): void {
    this._fpsTracker.dispose();
    this._memoryTracker.dispose();
    this._statsTracker.dispose();

    this._viewport.debugBoundingBoxes = Tile.DebugBoundingBoxes.None;
    this._viewport.freezeScene = false;

    this._parentElement.removeChild(this._element);
  }

  private addSeparator(): void {
    this._element.appendChild(document.createElement("hr")!);
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }

  private addBoundingBoxDropdown(parent: HTMLElement): void {
    createComboBox({
      name: "Bounding Boxes: ",
      id: "debugPanel_boundingBoxes",
      parent,
      value: Tile.DebugBoundingBoxes.None,
      handler: (select) => this._viewport.debugBoundingBoxes = Number.parseInt(select.value, 10),
      entries: [
        { name: "None", value: Tile.DebugBoundingBoxes.None },
        { name: "Volume", value: Tile.DebugBoundingBoxes.Volume },
        { name: "Content", value: Tile.DebugBoundingBoxes.Content },
        { name: "Volume and Content", value: Tile.DebugBoundingBoxes.Both },
        { name: "Children", value: Tile.DebugBoundingBoxes.ChildVolumes },
        { name: "Sphere", value: Tile.DebugBoundingBoxes.Sphere },
      ],
    });
  }
}
