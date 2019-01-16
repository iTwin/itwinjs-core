/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, SpatialViewState, SpatialModelState } from "@bentley/imodeljs-frontend";
import { createCheckBox, CheckBox } from "./CheckBox";
import { ToolBarDropDown } from "./ToolBar";
import { compareStringsOrUndefined } from "@bentley/bentleyjs-core";

export class ModelPicker extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _parent: HTMLElement;
  private readonly _modelCheckBoxes: HTMLInputElement[] = [];
  private _toggleAll?: HTMLInputElement;
  private readonly _models = new Set<string>();

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "scrollingToolMenu";
    this._element.style.display = "block";

    parent.appendChild(this._element);
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
  public get onViewChanged(): Promise<void> { return this.populate(); }

  // ###TODO: Unless the iModel changed we should be able to use the same set of spatial models regardless of active view...
  public async populate(): Promise<void> {
    this._models.clear();
    this._modelCheckBoxes.length = 0;
    this._toggleAll = undefined;
    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);

    const visible = this._vp.view.isSpatialView();
    this._parent.style.display = visible ? "block" : "none";
    if (!visible)
      return Promise.resolve();

    const view = this._vp.view as SpatialViewState;
    const selector = view.modelSelector;
    const areAllEnabled = () => this._models.size === selector.models.size;
    this._toggleAll = this.addCheckbox("Toggle All", "model_toggleAll", false, (enabled: boolean) => this.toggleAll(enabled)).checkbox;

    const query = { from: SpatialModelState.getClassFullName(), wantPrivate: false };
    const props = await view.iModel.models.queryProps(query);
    props.sort((lhs, rhs) => compareStringsOrUndefined(lhs.name, rhs.name));

    let classifierIndex = 0;
    for (const prop of props) {
      if (undefined === prop.id || undefined === prop.name)
        continue;

      let model = view.iModel.models.getLoaded(prop.id);
      if (undefined === model) {
        // ###TODO: Load models on demand when they are enabled in the dialog - not all up front like this...super-inefficient.
        await view.iModel.models.load(prop.id);
        model = view.iModel.models.getLoaded(prop.id);
      }

      const id = prop.id;
      const cb = this.addCheckbox(prop.name, id, selector.has(id), (enabled: boolean) => {
        if (enabled)
          selector.addModels(id);
        else
          selector.dropModels(id);

        this._toggleAll!.checked = areAllEnabled();
        this._vp.invalidateScene();
      });

      this._modelCheckBoxes.push(cb.checkbox);
      this._models.add(id);

      const classifiers = undefined !== model ? model.jsonProperties.classifiers : undefined;
      if (undefined !== classifiers) {
        const div = document.createElement("div");
        div.style.paddingLeft = "2em";
        cb.div.appendChild(div);

        for (const classifier of classifiers) {
          this.addCheckbox(classifier.name, "classifier_" + classifierIndex++, classifier.isActive, (enabled) => {
            classifier.isActive = enabled;
            this._vp.invalidateScene();
          }, div);
        }
      }
    }

    this._toggleAll.checked = areAllEnabled();
  }

  private toggleAll(enable: boolean): void {
    if (this._vp.view.isSpatialView()) {
      const selector = this._vp.view.modelSelector;
      if (enable)
        selector.addModels(this._models);
      else
        selector.dropModels(this._models);

      this._vp.invalidateScene();
    }

    for (const checkbox of this._modelCheckBoxes)
      checkbox.checked = enable;
  }

  private addCheckbox(name: string, id: string, isChecked: boolean, handler: (enabled: boolean) => void, parent?: HTMLElement): CheckBox {
    if (undefined === parent)
      parent = this._element;

    return createCheckBox({
      name,
      id,
      parent,
      isChecked,
      handler: (checkbox) => handler(checkbox.checked),
    });
  }
}
