/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Viewport, DisplayStyle3dState, ContextRealityModelState, SpatialViewState, SpatialModelState, SpatialClassifiers, findAvailableRealityModels } from "@bentley/imodeljs-frontend";
import { createComboBox, createNumericInput, ComboBoxEntry, ComboBox, createNestedMenu, createCheckBox, NestedMenu } from "@bentley/frontend-devtools";
import { SpatialClassificationProps, ModelProps, ContextRealityModelProps, CartographicRange } from "@bentley/imodeljs-common";
import { ToolBarDropDown } from "./ToolBar";
import { assert, compareStringsOrUndefined } from "@bentley/bentleyjs-core";

function clearElement(element: HTMLElement): void {
  while (element.hasChildNodes())
    element.removeChild(element.firstChild!);
}

const NO_MODEL_ID = "-1";

export class ClassificationsPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _realityModelListDiv: HTMLDivElement;
  private readonly _modelListDiv: HTMLDivElement;
  private readonly _propertiesDiv: HTMLDivElement;
  private readonly _realityModelPickerMenu: NestedMenu;
  private _selectedSpatialClassifiers: SpatialClassifiers | undefined;
  private _selectedSpatialClassifiersIndex: number = 0;
  private _modelComboBox?: ComboBox;
  private _models: {[modelId: string]: ModelProps} = {};

  private get _selectedClassifier(): SpatialClassificationProps.Classifier | undefined {
    if (undefined === this._selectedSpatialClassifiers)
      return undefined;
    const classifiers = this._selectedSpatialClassifiers;
    if (undefined !== classifiers.active)
      return classifiers.active;
    return undefined;
  }

  private setAsActiveClassifier(modelProps: ModelProps | undefined): void {
    if (undefined === this._selectedSpatialClassifiers)
      return;

    let classifier: SpatialClassificationProps.Classifier | undefined;
    if (undefined !== modelProps) {

      // Find existing classifier
      const modelId = modelProps.id!;
      [...this._selectedSpatialClassifiers].forEach((existingClassifier) =>
        classifier = modelId === existingClassifier.modelId ? classifier : undefined);

      if (undefined === classifier) {
        // If one does not exist, create a new classifier using model id
        classifier = {
          modelId,
          expand: 1,
          name: modelProps.name!,
          flags: new SpatialClassificationProps.Flags(),
        };
        this._selectedSpatialClassifiers.push(classifier);
      }
    }
    this._selectedSpatialClassifiers.active = classifier;
    this.populateClassifierProperties();
  }

  constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;

    this._element = document.createElement("div");
    this._realityModelListDiv = document.createElement("div");
    this._modelListDiv = document.createElement("div");
    this._propertiesDiv = document.createElement("div");
    this._realityModelPickerMenu = createNestedMenu({
      label: "Reality Model Picker",
    });

    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.cssFloat = "left";
    this._element.style.width = "max-content";
    this._element.style.minWidth = "350px";

    parent.appendChild(this._element);
    this._element.appendChild(this._realityModelPickerMenu.div);
    this._element.appendChild(this._realityModelListDiv);
    this._element.appendChild(this._modelListDiv);
    this._element.appendChild(this._propertiesDiv);
  }

  private async populateRealityModelsPicker(): Promise<void> {
    this._realityModelPickerMenu.div.style.display = "none";
    clearElement(this._realityModelPickerMenu.body);

    const view = this._vp.view;
    const ecef = this._vp.iModel.ecefLocation;
    if (!view.isSpatialView() || undefined === ecef) {
      return Promise.resolve();
    }

    const range = new CartographicRange(this._vp.iModel.projectExtents, ecef.getTransform());
    const available = await findAvailableRealityModels("fb1696c8-c074-4c76-a539-a5546e048cc6", range);
    for (const entry of available) {
      const name = undefined !== entry.name ? entry.name : entry.tilesetUrl;
      createCheckBox({
        name,
        id: entry.tilesetUrl,
        parent: this._realityModelPickerMenu.body,
        isChecked: view.displayStyle.hasAttachedRealityModel(name, entry.tilesetUrl),
        handler: (checkbox) => this.toggle(entry, checkbox.checked),
      });
    }
    this._realityModelPickerMenu.body.appendChild(document.createElement("hr"));
    if (available.length > 0)
      this._realityModelPickerMenu.div.style.display = "block";
  }

  private populateRealityModelList(): void {
    // assemble list of Spatial Classifiers (should usually be one)
    const realityModels: Array<{spatialClassifers: SpatialClassifiers, modelName: string}> = [];
    (this._vp.view.displayStyle as DisplayStyle3dState).forEachRealityModel((contextModel: ContextRealityModelState) => {
      const classifiers = contextModel.classifiers;
      if (undefined !== classifiers)
        realityModels.push({spatialClassifers: classifiers, modelName: contextModel.name});
    });
    // create list of entries for Classifier in the spatial Classifiers
    const entries = realityModels.map((spatialClassifier, i) => {
      return({ name: spatialClassifier.modelName , value: i } as ComboBoxEntry);
    });

    clearElement(this._realityModelListDiv);
    const activeIndex = this._selectedSpatialClassifiersIndex;
    createComboBox({
      parent: this._realityModelListDiv,
      id: "ClassifierSelectionBox",
      name: "Reality Models: ",
      value: activeIndex,
      handler: (select) => {
        const valueIndex = Number.parseInt(select.value, 10);
        this._selectedSpatialClassifiersIndex = valueIndex;
        const spatialClassifier = valueIndex >= 0 ? realityModels[valueIndex].spatialClassifers : undefined;
        this.setSelectedClassification(spatialClassifier);
      },
      entries,
    });

    if (undefined !== realityModels[activeIndex])
      this.setSelectedClassification(realityModels[activeIndex].spatialClassifers);
    else
      this.setSelectedClassification(undefined);
  }

  private async populateModelList(): Promise<void> {
    const view = this._vp.view as SpatialViewState;
    assert(undefined !== view && view.isSpatialView());

    const query = { from: SpatialModelState.classFullName, wantPrivate: false };
    const props = await view.iModel.models.queryProps(query);
    props.sort((lhs, rhs) => compareStringsOrUndefined(lhs.name, rhs.name));

    const entries: ComboBoxEntry[] = [{ name: "None", value: NO_MODEL_ID }];
    this._models = {};
    props.forEach((prop) => {
      if (undefined !== prop.id && undefined !== prop.name) {
        entries.push({ name: prop.name, value: prop.id });
        this._models[prop.id] = prop;
      }
    });

    clearElement(this._modelListDiv);

    this._modelComboBox = createComboBox({
      entries,
      parent: this._modelListDiv,
      id: "classifiers_modelBox",
      name: "Active Classifier: ",
      value: undefined !== this._selectedClassifier ? this._selectedClassifier.modelId : undefined,
      handler: (select) => {
        this.setAsActiveClassifier(this._models[select.value]);
        this.populateRealityModelList();
        this._vp.invalidateScene();
      },
    });

    if (undefined === this._selectedClassifier)
      this.disableModelComboBox(true);
  }

  public async populate(): Promise<void> {
    this._selectedSpatialClassifiers = undefined;
    if (this._vp.view.is2d()) return;

    this._realityModelPickerMenu.div.style.display = "none";
    this.populateRealityModelList();
    await this.populateRealityModelsPicker();
    await this.populateModelList();
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void {
    this.populateRealityModelList();
    this._element.style.display = "block";
  }
  protected _close(): void { this._element.style.display = "none"; }
  public get onViewChanged(): Promise<void> { return this.populate(); }

  private disableModelComboBox(disable: boolean): void {
    if (undefined !== this._modelComboBox)
      this._modelComboBox.select.disabled = disable;
  }

  private updateModelComboBox(modelId: string): void {
    if (undefined !== this._modelComboBox)
      this._modelComboBox.select.value = modelId;
  }

  private toggle(entry: ContextRealityModelProps, enabled: boolean): void {
    const view = this._vp.view as SpatialViewState;
    const style = view.getDisplayStyle3d();
    if (enabled)
      style.attachRealityModel(entry);
    else
      style.detachRealityModelByNameAndUrl(entry.name!, entry.tilesetUrl);

    this.populateRealityModelList();
    this._vp.invalidateScene();
  }

  private setSelectedClassification(spatialClassifiers: SpatialClassifiers | undefined) {
    this._selectedSpatialClassifiers = spatialClassifiers;
    if (undefined === spatialClassifiers) {
      this.updateModelComboBox(NO_MODEL_ID);
      this.disableModelComboBox(true);
      this.populateClassifierProperties();
      return;
    }

    const classifier = spatialClassifiers.active;

    this.disableModelComboBox(false);
    if (undefined === classifier) {
      this.updateModelComboBox(NO_MODEL_ID);
      this.populateClassifierProperties();
      return;
    }

    this.updateModelComboBox(classifier.modelId);

    this.populateClassifierProperties();
  }

  private populateClassifierProperties(): void {
    const classifier = this._selectedClassifier;
    const parent = this._propertiesDiv;
    clearElement(parent);

    if (undefined === classifier)
      return;

    const displayEntires: ComboBoxEntry[] = [
      { name: "Off", value: SpatialClassificationProps.Display.Off },
      { name: "On", value: SpatialClassificationProps.Display.On },
      { name: "Dimmed", value: SpatialClassificationProps.Display.Dimmed },
      { name: "Hilite", value: SpatialClassificationProps.Display.Hilite },
      { name: "Element Color", value: SpatialClassificationProps.Display.ElementColor },
    ];

    createComboBox({
      name: "Inside: ",
      id: "InsideComboBox",
      parent,
      entries: displayEntires,
      handler: (select) => {
        const newValue = Number.parseInt(select.value, 10) as SpatialClassificationProps.Display;
        this._selectedClassifier!.flags.inside = newValue;
        this._vp.invalidateScene();
      },
      value: classifier.flags.inside,
    });

    createComboBox({
      name: "Outside: ",
      id: "OutsideComboBox",
      parent,
      entries: displayEntires,
      handler: (select) => {
        const newValue = Number.parseInt(select.value, 10) as SpatialClassificationProps.Display;
        this._selectedClassifier!.flags.outside = newValue;
        this._vp.invalidateScene();
      },
      value: classifier.flags.outside,
    });

    createComboBox({
      name: "Selected: ",
      id: "SelectedComboBox",
      parent,
      entries: displayEntires,
      handler: (select) => {
        const newValue = Number.parseInt(select.value, 10) as SpatialClassificationProps.Display;
        this._selectedClassifier!.flags.selected = newValue;
        this._vp.invalidateScene();
      },
      value: classifier.flags.selected,
    });

    const label = document.createElement("label");
    label.textContent = "Expansion: ";
    parent.appendChild(label);

    createNumericInput({
      parent,
      display: "inline",
      value: classifier.expand,
      handler: (value) => {
        this._selectedClassifier!.expand = value;
        this._vp.invalidateScene();
      },
    });
  }
}
