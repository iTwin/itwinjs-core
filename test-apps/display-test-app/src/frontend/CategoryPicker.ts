/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport } from "@bentley/imodeljs-frontend";
import { createCheckBox } from "./CheckBox";
import { ToolBarDropDown } from "./ToolBar";

function getCategoryName(row: any): string {
  return undefined !== row.label ? row.label : row.code;
}

const selectUsedSpatialCategoryIds = "SELECT DISTINCT Category.Id as CategoryId from BisCore.GeometricElement3d WHERE Category.Id IN (SELECT ECInstanceId from BisCore.SpatialCategory)";
const selectUsedDrawingCategoryIds = "SELECT DISTINCT Category.Id as CategoryId from BisCore.GeometricElement2d WHERE Model.Id=? AND Category.Id IN (SELECT ECInstanceId from BisCore.DrawingCategory)";
const selectCategoryProps = "SELECT ECInstanceId as id, CodeValue as code, UserLabel as label FROM ";
const selectSpatialCategoryProps = selectCategoryProps + "BisCore.SpatialCategory WHERE ECInstanceId IN (" + selectUsedSpatialCategoryIds + ")";
const selectDrawingCategoryProps = selectCategoryProps + "BisCore.DrawingCategory WHERE ECInstanceId IN (" + selectUsedDrawingCategoryIds + ")";

export class CategoryPicker extends ToolBarDropDown {
  private readonly _categories = new Set<string>();
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _checkboxes: HTMLInputElement[] = [];

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
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

    const ecsql = view.is3d() ? selectSpatialCategoryProps : selectDrawingCategoryProps;
    const bindings = view.is2d() ? [ view.baseModelId ] : undefined;
    const rows = Array.from(await view.iModel.queryPage(ecsql, bindings, { size: 1000 })); // max rows to return after which result will be truncated.
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
        this._vp.changeCategoryDisplay(row.id, enabled);
        toggleAll.checked = areAllEnabled();
      });
    }

    // Remove any unused categories from category selector (otherwise areAllEnabled criterion is broken).
    let unusedCategories: Set<string> | undefined;
    for (const categoryId of view.categorySelector.categories) {
      if (!this._categories.has(categoryId)) {
        if (undefined === unusedCategories)
          unusedCategories = new Set<string>();

        unusedCategories.add(categoryId);
      }
    }

    if (undefined !== unusedCategories)
      this._vp.changeCategoryDisplay(unusedCategories, false);

    toggleAll.checked = areAllEnabled();
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get onViewChanged(): Promise<void> { return this.populate(); }

  private toggleAll(enable: boolean): void {
    this._vp.changeCategoryDisplay(this._categories, enable);
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
