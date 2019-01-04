/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "@bentley/imodeljs-frontend";
import { createCheckBox } from "./CheckBox";

function getCategoryName(row: any): string {
  return undefined !== row.label ? row.label : row.code;
}

export class CategoryPicker {
  private readonly _categories = new Set<string>();
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _checkboxes: HTMLInputElement[] = [];

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._element = document.createElement("div");
    this._element.className = "scrollingToolMenu";
    this._element.style.display = "block";

    parent.appendChild(this._element);
  }

  // Called whenever Viewport.changeView() is used.
  // Technically if the IModelConnection hasn't changed was ought to be able to reuse the known set of drawing and/or spatial categories
  // rather than re-querying each time, but meh.
  public async populate(): Promise<void> {
    this._categories.clear();
    this._checkboxes.length = 0;
    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);

    const view = this._vp.view;
    const areAllEnabled = () => this._categories.size === view.categorySelector.categories.size;
    const toggleAll = this.addCheckbox("Toggle All", "cat_toggleAll", false, (enabled: boolean) => this.toggleAll(enabled));

    const ecsql = "SELECT ECInstanceId as id, CodeValue as code, UserLabel as label FROM " + (view.is3d() ? "BisCore.SpatialCategory" : "BisCore.DrawingCategory");
    const rows = await view.iModel.executeQuery(ecsql);

    rows.sort((lhs, rhs) => {
      const lhName = getCategoryName(lhs);
      const rhName = getCategoryName(rhs);
      if (lhName < rhName)
        return -1;
      else if (lhName > rhName)
        return 1;
      else
        return 0;
    });

    for (const row of rows) {
      this._categories.add(row.id);

      const name = getCategoryName(row);
      this.addCheckbox(name, row.id, view.categorySelector.has(row.id), (enabled: boolean) => {
        this._vp.view.changeCategoryDisplay(row.id, enabled);
        toggleAll.checked = areAllEnabled();
      });
    }

    toggleAll.checked = areAllEnabled();
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  public toggle(): void { this._element.style.display = this.isOpen ? "none" : "block"; }

  private toggleAll(enable: boolean): void {
    this._vp.view.changeCategoryDisplay(this._categories, enable);
    for (const checkbox of this._checkboxes)
      checkbox.checked = enable;
  }

  private addCheckbox(name: string, id: string, isChecked: boolean, handler: (enabled: boolean) => void): HTMLInputElement {
    const cb = createCheckBox({
      name,
      id,
      parent: this._element,
      isChecked,
      handler: (checkbox) => handler(checkbox.checked),
    }).checkbox;

    this._checkboxes.push(cb);
    return cb;
  }
}
