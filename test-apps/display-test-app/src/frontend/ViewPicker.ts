/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  compareStrings,
  BeEvent,
  Id64String,
  Id64,
  SortedArray,
} from "@bentley/bentleyjs-core";
import {
  IModelConnection,
  ViewState,
} from "@bentley/imodeljs-frontend";

export class ViewList extends SortedArray<IModelConnection.ViewSpec> {
  private _defaultViewId = Id64.invalid;
  private readonly _views = new Map<Id64String, ViewState>();

  private constructor() {
    super((lhs, rhs) => compareStrings(lhs.id, rhs.id));
  }

  public get defaultViewId(): Id64String { return this._defaultViewId; }

  public async getView(id: Id64String, iModel: IModelConnection): Promise<ViewState> {
    let view = this._views.get(id);
    if (undefined === view) {
      view = await iModel.views.load(id);
      this._views.set(id, view);
    }

    // NB: We clone so that if user switches back to this view, it is shown in its initial (persistent) state.
    return view.clone();
  }

  public async getDefaultView(iModel: IModelConnection): Promise<ViewState> {
    return this.getView(this.defaultViewId, iModel);
  }

  public static async create(iModel: IModelConnection, viewName?: string): Promise<ViewList> {
    const viewList = new ViewList();
    await viewList.populate(iModel, viewName);
    return viewList;
  }

  public clear(): void {
    super.clear();
    this._defaultViewId = Id64.invalid;
    this._views.clear();
  }

  public async populate(iModel: IModelConnection, viewName?: string): Promise<void> {
    this.clear();

    const query = { wantPrivate: false };
    const specs = await iModel.views.getViewList(query);
    if (0 === specs.length)
      return Promise.resolve();

    for (const spec of specs)
      this.insert(spec);

    if (undefined !== viewName) {
      for (const spec of this) {
        if (spec.name === viewName) {
          this._defaultViewId = spec.id;
          break;
        }
      }
    }

    if (Id64.isInvalid(this._defaultViewId)) {
      this._defaultViewId = this._array[0].id;
      const defaultViewId = await iModel.views.queryDefaultViewId();
      for (const spec of this) {
        if (spec.id === defaultViewId) {
          this._defaultViewId = defaultViewId;
          break;
        }
      }
    }

    const selectedView = await iModel.views.load(this._defaultViewId);
    this._views.set(this._defaultViewId, selectedView);
  }
}

export class ViewPicker {
  private readonly _select: HTMLSelectElement;
  public readonly onSelectedViewChanged = new BeEvent<(viewId: Id64String) => void>();

  public get element(): HTMLElement { return this._select; }

  public constructor(parent: HTMLElement, views: ViewList) {
    this._select = document.createElement("select") as HTMLSelectElement;
    this._select.className = "viewList";
    this._select.onchange = () => this.onSelectedViewChanged.raiseEvent(this._select.value);

    parent.appendChild(this._select);

    this.populate(views);
  }

  public populate(views: ViewList): void {
    while (this._select.hasChildNodes())
      this._select.removeChild(this._select.firstChild!);

    for (const spec of views) {
      const option = document.createElement("option") as HTMLOptionElement;
      option.innerText = spec.name;
      option.value = spec.id;
      this._select.appendChild(option);
    }
  }
}
