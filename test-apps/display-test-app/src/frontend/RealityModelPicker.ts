/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  ContextRealityModelProps,
  CartographicRange,
} from "@bentley/imodeljs-common";
import {
  findAvailableRealityModels,
  SpatialViewState,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { ToolBarDropDown } from "./ToolBar";
import { createCheckBox } from "@bentley/frontend-devtools";

export class RealityModelPicker extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parent: HTMLElement;
  private _available: ContextRealityModelProps[] = [];

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();

    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "scrollingToolMenu";
    this._element.style.display = "block";

    parent.appendChild(this._element);

    const clearContextRealityModels = false; // for testing...
    if (clearContextRealityModels && vp.view.isSpatialView()) {
      let numModels = 0;
      vp.view.getDisplayStyle3d().forEachRealityModel((_) => ++numModels);

      for (let i = 0; i < numModels; i++)
        vp.view.getDisplayStyle3d().detachRealityModelByIndex(0);

      vp.invalidateScene();
    }
  }

  public get isOpen() { return "none" !== this._element.style.display; }
  protected _open() { this._element.style.display = "block"; }
  protected _close() { this._element.style.display = "none"; }
  public get onViewChanged(): Promise<void> { return this.populate(); }

  public async populate(): Promise<void> {
    this._available.length = 0;
    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);

    const view = this._vp.view;
    const ecef = this._vp.iModel.ecefLocation;
    if (!view.isSpatialView() || undefined === ecef) {
      this._parent.style.display = "none";
      return Promise.resolve();
    }

    const range = new CartographicRange(this._vp.iModel.projectExtents, ecef.getTransform());
    this._available = await findAvailableRealityModels("fb1696c8-c074-4c76-a539-a5546e048cc6", range);
    for (const entry of this._available) {
      const name = undefined !== entry.name ? entry.name : entry.tilesetUrl;
      createCheckBox({
        name,
        id: entry.tilesetUrl,
        parent: this._element,
        isChecked: view.displayStyle.hasAttachedRealityModel(name, entry.tilesetUrl),
        handler: (checkbox) => this.toggle(entry, checkbox.checked),
      });
    }

    const visible = this._available.length > 0;
    this._parent.style.display = visible ? "block" : "none";
  }

  private toggle(entry: ContextRealityModelProps, enabled: boolean): void {
    const view = this._vp.view as SpatialViewState;
    const style = view.getDisplayStyle3d();
    if (enabled)
      style.attachRealityModel(entry);
    else
      style.detachRealityModelByNameAndUrl(entry.name!, entry.tilesetUrl);

    this._vp.invalidateScene();
  }
}
