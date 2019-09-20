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
  CategorySelectorState,
  DisplayStyle3dState,
  IModelConnection,
  ModelSelectorState,
  SpatialViewState,
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

    if (Id64.isInvalid(this._defaultViewId) && 0 < this._array.length) {
      this._defaultViewId = this._array[0].id;
      const defaultViewId = await iModel.views.queryDefaultViewId();
      for (const spec of this) {
        if (spec.id === defaultViewId) {
          this._defaultViewId = defaultViewId;
          break;
        }
      }
    }

    if (Id64.isInvalid(this._defaultViewId))
      this.insert({ id: Id64.invalid, name: "Spatial View", class: SpatialViewState.classFullName });

    const selectedView = Id64.isInvalid(this._defaultViewId) ? this.manufactureViewState(iModel) : await iModel.views.load(this._defaultViewId);
    this._views.set(this._defaultViewId, selectedView);
  }

  private manufactureViewState(iModel: IModelConnection): SpatialViewState {
    const ext = iModel.projectExtents;
    const viewDefinitionProps = {
      classFullName: SpatialViewState.classFullName,
      userLabel: "Manufactured View",
      model: Id64.invalid,
      code: {
        spec: Id64.invalid,
        value: "Manufactured View",
        scope: Id64.invalid,
      },
      categorySelectorId: Id64.invalid,
      displayStyleId: Id64.invalid,
      modelSelectorId: Id64.invalid,
      cameraOn: false,
      origin: ext.low,
      extents: ext.high.minus(ext.low),
      camera: {
        lens: 90,
        focusDist: ext.high.z - ext.low.z,
        eye: { x: 0, y: 0, z: 0 },
      },
    };

    const codeProps = {
      spec: Id64.invalid,
      value: "",
      scope: Id64.invalid,
    };

    const categorySelectorProps = {
      classFullName: CategorySelectorState.classFullName,
      model: Id64.invalid,
      code: codeProps,
      categories: [],
    };

    const modelSelectorProps = {
      classFullName: ModelSelectorState.classFullName,
      model: Id64.invalid,
      code: codeProps,
      models: [],
    };

    const displayStyleProps = {
      classFullName: DisplayStyle3dState.classFullName,
      model: Id64.invalid,
      code: codeProps,
      jsonProperties: {
        styles: {
          backgroundColor: 0xffffff,
          viewflags: {
            backgroundMap: true,
          },
          environment: {
            ground: {
              display: true,
            },
            sky: {
              display: true,
            },
          },
        },
      },
    };

    const props = {
      viewDefinitionProps,
      categorySelectorProps,
      modelSelectorProps,
      displayStyleProps,
    };

    return SpatialViewState.createFromProps(props, iModel);
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

    let index = 0;
    for (const spec of views) {
      const option = document.createElement("option") as HTMLOptionElement;
      option.innerText = spec.name;
      option.value = spec.id;
      this._select.appendChild(option);
      if (spec.id === views.defaultViewId)
        this._select.selectedIndex = index;
      index++;
    }
  }
}
