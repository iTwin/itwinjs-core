/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { addFpsTracker } from "./FpsTracker";
import { addMemoryTracker } from "./MemoryTracker";
import { addTileStatisticsTracker } from "./TileStatisticsTracker";
import { Viewport, Tile } from "@bentley/imodeljs-frontend";

export class DebugPanel {
  private readonly _viewport: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parentElement: HTMLElement;
  private _id = 0;

  public constructor(vp: Viewport, parentElement: HTMLElement) {
    this._viewport = vp;
    this._parentElement = parentElement;
    this._element = document.createElement("div");
    this._element.className = "debugPanel";

    addFpsTracker(this._element, vp);

    this.addCheckbox(this._element, "Freeze Scene", (enabled) => this._viewport.freezeScene = enabled);
    this.addBoundingBoxDropdown(this._element);

    this.addSeparator();
    addTileStatisticsTracker(this._element, vp);

    this.addSeparator();
    addMemoryTracker(this._element, vp);

    parentElement.appendChild(this._element);
  }

  public dispose(): undefined {
    this._parentElement.removeChild(this._element);
    return undefined;
  }

  private addSeparator(): void {
    this._element.appendChild(document.createElement("hr")!);
  }

  private addCheckbox(parent: HTMLElement, cbLabel: string, handler: (enabled: boolean) => void): { label: HTMLLabelElement, checkbox: HTMLInputElement, div: HTMLDivElement } {
    const div = document.createElement("div");
    div.style.display = "block";

    const cb = document.createElement("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.id = this._nextId;
    cb.addEventListener("click", () => handler(cb.checked));
    div.appendChild(cb);

    const label = document.createElement("label") as HTMLLabelElement;
    label.htmlFor = cb.id;
    label.innerText = cbLabel;
    div.appendChild(label);

    parent.appendChild(div);
    return { label, checkbox: cb, div };
  }

  private addBoundingBoxDropdown(parent: HTMLElement): void {
    const label = document.createElement("label") as HTMLLabelElement;
    label.htmlFor = "boundingBoxSelector";
    label.innerText = "Bounding Boxes: ";
    parent.appendChild(label);

    const select = document.createElement("select") as HTMLSelectElement;
    select.id = "boundingBoxSelector";

    const names = [ "None", "Volume", "Content" ];
    for (let i = 0; i <= Tile.DebugBoundingBoxes.Content; i++) {
      const option = document.createElement("option") as HTMLOptionElement;
      option.value = i.toString();
      option.innerText = names[i];
      select.appendChild(option);
    }

    select.value = Tile.DebugBoundingBoxes.None.toString();
    select.onchange = () => this._viewport.debugBoundingBoxes = Number.parseInt(select.value, 10);

    parent.appendChild(select);
  }

  // NB: Could remove this - we now only have a single checkbox...
  private get _nextId(): string {
    ++this._id;
    return "debugPanel_" + this._id;
  }
}
