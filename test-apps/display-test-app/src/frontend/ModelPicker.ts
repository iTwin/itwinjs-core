/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, SpatialViewState, SpatialModelState, GeometricModelState, SpatialClassification } from "@bentley/imodeljs-frontend";
import { SpatialClassificationProps } from "@bentley/imodeljs-common";
import { createCheckBox, CheckBox } from "./CheckBox";
import { createComboBox, ComboBox } from "./ComboBox";
import { createNumericInput } from "./NumericInput";
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

  private showOrHide(element: HTMLElement, show: boolean) { if (element) element.style.display = show ? "block" : "none"; }
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

    for (const prop of props) {
      if (undefined === prop.id || undefined === prop.name)
        continue;

      let model = view.iModel.models.getLoaded(prop.id);
      if (undefined === model) {
        // ###TODO: Load models on demand when they are enabled in the dialog - not all up front like this...super-inefficient.
        await view.iModel.models.load(prop.id);
        model = view.iModel.models.getLoaded(prop.id);
        if (undefined === model)
          continue;
      }

      const id = prop.id;
      const cb = this.addCheckbox(prop.name, id, selector.has(id), (enabled: boolean) => {
        this._vp.changeModelDisplay(id, enabled);
        this._toggleAll!.checked = areAllEnabled();
      });

      this._modelCheckBoxes.push(cb.checkbox);
      this._models.add(id);

      const geometricModel = model as GeometricModelState;
      // If reality model with no classifiers -- add classifiers (for testing)
      if (model.jsonProperties && undefined !== model.jsonProperties.tilesetUrl && undefined === model.jsonProperties.classifiers)   // We need a better test for reality models.
        for (const otherProp of props)
          if (otherProp !== prop && undefined !== otherProp.id && undefined !== otherProp.name)
            SpatialClassification.addSpatialClassifier(geometricModel, new SpatialClassificationProps.Properties({ name: otherProp.name, modelId: otherProp.id, expand: 1.0, flags: new SpatialClassificationProps.Flags(), isActive: false }));

      let insideCombo: ComboBox | undefined;
      let outsideCombo: ComboBox | undefined;
      let expandInput: HTMLInputElement | undefined;
      if (undefined !== geometricModel && undefined !== SpatialClassification.getSpatialClassifier(geometricModel, 0)) {
        const div = document.createElement("div");
        cb.div.appendChild(div);

        const entries = [{ name: "None", value: -1 }];
        let classifier;
        let activeClassifierIndex = SpatialClassification.getActiveSpatialClassifier(geometricModel);
        let activeClassifier = (activeClassifierIndex >= 0) ? SpatialClassification.getSpatialClassifier(geometricModel, activeClassifierIndex) : undefined;
        for (let i = 0; undefined !== (classifier = SpatialClassification.getSpatialClassifier(geometricModel, i)); i++)
          entries.push({ name: classifier.name, value: i });

        createComboBox({
          parent: div,
          name: "Classifier: ",
          id: "Classifier_" + id,
          value: activeClassifierIndex,
          handler: (select) => {
            activeClassifierIndex = Number.parseInt(select.value, 10);
            SpatialClassification.setActiveSpatialClassifier(geometricModel, activeClassifierIndex, true).then((_) => {
              activeClassifier = SpatialClassification.getSpatialClassifier(geometricModel, activeClassifierIndex);
              this.showOrHide(insideCombo!.div, activeClassifier !== undefined);
              this.showOrHide(outsideCombo!.div, activeClassifier !== undefined);
              this.showOrHide(expandInput!, activeClassifier !== undefined);
              if (activeClassifier) {
                if (insideCombo) insideCombo.div.style.display = "block";
                if (outsideCombo) outsideCombo.select.selectedIndex = activeClassifier.flags.outside;
                if (expandInput) expandInput.value = activeClassifier.expand.toString();
              }
              this._vp.invalidateScene();
            }).catch((_) => undefined);
          },
          entries,
        });

        insideCombo = createComboBox({
          parent: div,
          name: "Inside: ",
          id: "ClassifierInside_" + id,
          value: activeClassifier ? activeClassifier!.flags.inside : 1,
          handler: (select) => {
            if (activeClassifier) {
              activeClassifier.flags.inside = Number.parseInt(select.value, 10);
              SpatialClassification.setSpatialClassifier(geometricModel, activeClassifierIndex, activeClassifier);
              this._vp.invalidateScene();
            }
          },
          entries: [{ name: "Off", value: 0 }, { name: "On", value: 1 }, { name: "Dimmed", value: 2 }, { name: "Hilite", value: 3 }, { name: "Color", value: 4 }],
        });
        outsideCombo = createComboBox({
          parent: div,
          name: "Outside: ",
          id: "ClassifierInside_" + id,
          value: activeClassifier ? activeClassifier.flags.outside : 1,
          handler: (select) => {
            if (activeClassifier) {
              activeClassifier.flags.outside = Number.parseInt(select.value, 10);
              SpatialClassification.setSpatialClassifier(geometricModel, activeClassifierIndex, activeClassifier);
              this._vp.invalidateScene();
            }
          },
          entries: [{ name: "Off", value: 0 }, { name: "On", value: 1 }, { name: "Dimmed", value: 2 }],
        });
        expandInput = createNumericInput({
          parent: div,
          id: "ClassifierExpand_" + id,
          value: activeClassifier ? activeClassifier.expand : 0.0,
          handler: (select) => {
            if (activeClassifier) {
              activeClassifier.expand = select;
              SpatialClassification.setSpatialClassifier(geometricModel, activeClassifierIndex, activeClassifier);
              this._vp.invalidateScene();
            }
          },
        });
        this.showOrHide(insideCombo!.div, activeClassifier !== undefined);
        this.showOrHide(outsideCombo!.div, activeClassifier !== undefined);
        this.showOrHide(expandInput!, activeClassifier !== undefined);
      }
    }
    this._toggleAll.checked = areAllEnabled();
  }

  private toggleAll(enable: boolean): void {
    if (this._vp.view.isSpatialView()) {
      this._vp.changeViewedModels(enable ? this._models : new Set<string>());
    }

    for (const checkbox of this._modelCheckBoxes)
      checkbox.checked = enable;
  }

  private addCheckbox(name: string, id: string, isChecked: boolean, handler: (enabled: boolean) => void, parent?: HTMLElement, typeOverride?: string): CheckBox {
    if (undefined === parent)
      parent = this._element;

    return createCheckBox({
      name,
      id,
      parent,
      isChecked,
      typeOverride,
      handler: (checkbox) => handler(checkbox.checked),
    });
  }
}
