/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  DisplayStyleSettings, FeatureAppearance, FeatureAppearanceProps, PointCloudDisplayProps, RealityModelDisplayProps, RealityModelDisplaySettings,
} from "@itwin/core-common";
import {
  ContextRealityModelState, IModelApp, ScreenViewport, SpatialModelState, Tool, Viewport,
} from "@itwin/core-frontend";
import { System } from "@itwin/core-frontend/lib/cjs/render/webgl/System";
import {
  ComboBoxEntry,
  convertHexToRgb, createCheckBox, createColorInput, createComboBox, createRadioBox, createSlider,
} from "@itwin/frontend-devtools";
import { Surface } from "./Surface";
import { ToolBarDropDown } from "./ToolBar";
import { Window } from "./Window";

interface RealityModel {
  readonly name: string;
  settings: RealityModelDisplaySettings;
  appearance: FeatureAppearance | undefined;
}

class ContextModel implements RealityModel {
  private readonly _state: ContextRealityModelState;

  public constructor(state: ContextRealityModelState) {
    this._state = state;
  }

  public get name() { return this._state.name || this._state.orbitGtBlob?.blobFileName || this._state.url; }

  public get settings() { return this._state.displaySettings; }
  public set settings(value: RealityModelDisplaySettings) { this._state.displaySettings = value; }

  public get appearance() { return this._state.appearanceOverrides; }
  public set appearance(value: FeatureAppearance | undefined) { this._state.appearanceOverrides = value; }
}

class PersistentModel implements RealityModel {
  private readonly _model: SpatialModelState;
  private readonly _settings: DisplayStyleSettings;

  public constructor(model: SpatialModelState, settings: DisplayStyleSettings) {
    this._model = model;
    this._settings = settings;
  }

  public get name() { return this._model.name ?? this._model.jsonProperties.tilesetUrl; }

  public get settings() { return this._settings.getRealityModelDisplaySettings(this._model.id) ?? RealityModelDisplaySettings.defaults; }
  public set settings(value: RealityModelDisplaySettings) { this._settings.setRealityModelDisplaySettings(this._model.id, value); }

  public get appearance() { return this._settings.getModelAppearanceOverride(this._model.id); }
  public set appearance(value: FeatureAppearance | undefined) {
    if (value)
      this._settings.overrideModelAppearance(this._model.id, value);
    else
      this._settings.dropModelAppearanceOverride(this._model.id);
  }
}

function createRealityModelSettingsPanel(model: RealityModel, element: HTMLElement) {
  const updateSettings = (props: RealityModelDisplayProps) => model.settings = model.settings.clone(props);
  const updateAppearance = (props: FeatureAppearanceProps | undefined) => {
    if (!props)
      model.appearance = undefined;
    else if (!model.appearance)
      model.appearance = FeatureAppearance.fromJSON(props);
    else
      model.appearance = model.appearance.clone(props);
  };

  // Color
  const colorDiv = document.createElement("div");
  element.appendChild(colorDiv);

  const colorCb = document.createElement("input");
  colorCb.type = "checkbox";
  colorCb.id = "rms_cbColor";
  colorDiv.appendChild(colorCb);

  const updateColor = () => updateAppearance(colorCb.checked ? { rgb: convertHexToRgb(colorInput.value) } : undefined);
  const colorInput = createColorInput({
    parent: colorDiv,
    id: "rms_color",
    label: "Color",
    value: model.appearance?.rgb?.toHexString() ?? "#ffffff",
    display: "inline",
    disabled: !colorCb.checked,
    handler: updateColor,
  }).input;

  colorCb.addEventListener("click", () => {
    colorInput.disabled = !colorCb.checked;
    colorRatio.slider.disabled = !colorCb.checked;
    updateColor();
  });

  const colorRatio = createSlider({
    parent: colorDiv, id: "rms_ratio", name: " Ratio ",
    min: "0", max: "1", step: "0.05",
    value: model.settings.overrideColorRatio.toString(),
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const overrideColorRatio = Number.parseFloat(slider.value);
      if (!Number.isNaN(overrideColorRatio))
        updateSettings({ overrideColorRatio });
    },
  });
  colorRatio.div.style.display = "inline";
  colorRatio.slider.disabled = !colorCb.checked;

  // Point shape
  const updatePointCloud = (props: PointCloudDisplayProps) => updateSettings(model.settings.clone({ pointCloud: props }));
  createCheckBox({
    name: "Square points:", id: "rms_square",
    parent: element,
    isChecked: model.settings.pointCloud.shape === "square",
    handler: (cb) => updatePointCloud({ shape: cb.checked ? "square" : "round" }),
  });

  // Point size mode
  const setSizeMode = (mode: string) => {
    const isPixel = mode === "pixel";
    updatePointCloud({ sizeMode: isPixel ? "pixel" : "voxel" });
    pixelSizeSlider.style.display = isPixel ? "inline" : "none";
    voxelSizeSlider.style.display = isPixel ? "none" : "inline";
  };

  const sizeMode = createRadioBox({
    id: "rms_sizeMode",
    defaultValue: model.settings.pointCloud.sizeMode,
    entries: [
      { value: "voxel", label: "Voxel" },
      { value: "pixel", label: "Pixel" },
    ],
    parent: element,
    handler: (value) => setSizeMode(value),
  });
  sizeMode.form.style.display = "inline";

  // Pixel size
  const voxelSizeSlider = createSlider({
    name: " Size ", id: "rms_scale", parent: sizeMode.div,
    min: "0.25", max: "10", step: "0.25",
    value: model.settings.pointCloud.voxelScale.toString(),
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ voxelScale: scale });
    },
  }).div;

  const pixelSizeSlider = createSlider({
    name: " Size ", id: "rms_size", parent: sizeMode.div,
    min: "1", max: "64", step: "1",
    value: model.settings.pointCloud.pixelSize.toString(),
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const pixelSize = Number.parseInt(slider.value, 10);
      if (!Number.isNaN(pixelSize))
        updatePointCloud({ pixelSize });
    },
  }).div;

  setSizeMode(model.settings.pointCloud.sizeMode);

  //  ----------------- EDL -----------------
  const setEDLMode = (mode: string) => {
    const isOn = mode !== "off";
    const isFull = mode === "full";
    updatePointCloud({ edlMode: isOn ? (isFull ? "full" : "on") : "off" });
    edlFilter.style.display = isFull ? "" : "none";
    edlMixWt1Slider.style.display = isFull ? "" : "none";
    edlMixWt2Slider.style.display = isFull ? "" : "none";
    edlMixWt4Slider.style.display = isFull ? "" : "none";
  };

  const hr = document.createElement("hr");
  hr.style.borderColor = "grey";
  element.appendChild(hr);

  const edlDiv = document.createElement("div");
  element.appendChild(edlDiv);
  edlDiv.style.display = "inline";

  const label1 = document.createElement("label");
  label1.innerText = "EDL ";
  label1.style.display = "inline";
  edlDiv.appendChild(label1);

  const edlMode = createRadioBox({
    id: "pcs_edlMode",
    defaultValue: model.settings.pointCloud.edlMode,
    entries: [
      { value: "off", label: "Off " },
      { value: "on", label: "On " },
      { value: "full", label: "Full " },
    ],
    parent: edlDiv,
    handler: (value) => setEDLMode(value),
  });
  edlMode.div.style.display = edlMode.form.style.display = "inline";

  // EDL strength
  const edlStrengthSlider = createSlider({
    name: " Strength ", id: "pcs_strength", parent: element,
    min: "0.0", max: "25", step: "0.25",
    value: model.settings.pointCloud.edlStrength.toString(),
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ edlStrength: scale });
    },
  }).div;
  edlStrengthSlider.style.display = "";

  // EDL radius
  const edlRadiusSlider = createSlider({
    name: " Radius ", id: "pcs_radius", parent: element,
    min: "0.0", max: "25", step: "0.25",
    value: model.settings.pointCloud.edlRadius.toString(),
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ edlRadius: scale });
    },
  }).div;
  edlRadiusSlider.style.display = "";

  const edlFilter = createCheckBox({
    name: " Filter", id: "pcs_filter",
    parent: element,
    isChecked: model.settings.pointCloud.edlFilter === 1,
    handler: (cb) => updatePointCloud({ edlFilter: cb.checked ? 1 : 0 }),
  }).div;

  const edlMixWt1Slider = createSlider({
    name: " Mix Wt 1 ", id: "pcs_mixwt1", parent: element,
    min: "0.0", max: "1", step: "0.01",
    value: model.settings.pointCloud.edlMixWts1?.toString() ?? "1",
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ edlMixWts1: scale });
    },
  }).div;
  edlMixWt1Slider.style.display = "";

  const edlMixWt2Slider = createSlider({
    name: " Mix Wt 2 ", id: "pcs_mixwt2", parent: element,
    min: "0.0", max: "1", step: "0.01",
    value: model.settings.pointCloud.edlMixWts2?.toString() ?? "0.5",
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ edlMixWts2: scale });
    },
  }).div;
  edlMixWt2Slider.style.display = "";

  const edlMixWt4Slider = createSlider({
    name: " Mix Wt 4 ", id: "pcs_mixwt4", parent: element,
    min: "0.0", max: "1", step: "0.01",
    value: model.settings.pointCloud.edlMixWts4?.toString() ?? "0.25",
    readout: "right", verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      if (!Number.isNaN(scale))
        updatePointCloud({ edlMixWts4: scale });
    },
  }).div;
  edlMixWt4Slider.style.display = "";

  setEDLMode(model.settings.pointCloud.edlMode);
}

const viewportIdsWithOpenWidgets = new Set<number>();

// size of widget or panel
const winSize = { top: 0, left: 0, width: 408, height: 300 };

class RealityModelSettingsWidget extends Window {
  private readonly _windowId: string;
  private readonly _viewport: Viewport;
  private readonly _dispose: () => void;

  public constructor(viewport: Viewport, model: RealityModel) {
    super(Surface.instance, winSize);
    this._viewport = viewport;

    this._windowId = `realityModelSettings-${viewport.viewportId}-${model.name}`;
    this.isPinned = true;
    this.title = model.name;

    const element = document.createElement("div");
    element.className = "debugPanel";
    element.style.height = "96%";
    element.style.width = "98%";
    element.style.top = "0px";
    element.style.left = "0px";
    element.style.zIndex = "inherit";
    this.contentDiv.appendChild(element);

    createRealityModelSettingsPanel(model, element);
    this.container.style.display = "flex";

    const removals = [
      viewport.onChangeView.addOnce(() => this.close()),
      viewport.onDisposed.addOnce(() => this.close()),
    ];

    this._dispose = () => removals.forEach((removal) => removal());
  }

  private close(): void {
    this.surface.close(this);
  }

  public override onClosed(): void {
    this._dispose();
    viewportIdsWithOpenWidgets.delete(this._viewport.viewportId);
  }

  public get windowId() { return this._windowId; }
  public override get isResizable() { return false; }
}

export class OpenRealityModelSettingsTool extends Tool {
  public static override toolId = "OpenRealityModelSettings";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(vp?: Viewport, model?: RealityModel): Promise<boolean> {
    if (!vp || !model)
      return false;

    const win = new RealityModelSettingsWidget(vp, model);
    win.surface.addWindow(win);
    win.surface.element.appendChild(win.container);

    return true;
  }

  public override async parseAndRun(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.isSpatialView())
      return false;

    if (viewportIdsWithOpenWidgets.has(vp.viewportId))
      return true;

    // ###TODO permit specific reality model to be specified in args.
    // For now use first one we can find.
    let realityModel: RealityModel | undefined;
    vp.view.displayStyle.forEachRealityModel((x) => {
      realityModel = realityModel ?? new ContextModel(x);
    });

    if (!realityModel) {
      for (const modelId of vp.view.modelSelector.models) {
        const model = vp.iModel.models.getLoaded(modelId);
        if (model instanceof SpatialModelState && model.isRealityModel) {
          realityModel = new PersistentModel(model, vp.view.displayStyle.settings);
          break;
        }
      }
    }

    return realityModel ? this.run(vp, realityModel) : false;
  }
}

function clearElement(element: HTMLElement): void {
  while (element.hasChildNodes())
    element.removeChild(element.firstChild!);
}

export class RealityModelSettingsPanel extends ToolBarDropDown {
  private readonly _vp: ScreenViewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private _realityModelListDiv: HTMLDivElement;
  private _selectedRealityModelIndex: number = 0;
  private _realityModels: Array<{ realityModel: RealityModel, modelName: string }> = [];

  public constructor(vp: ScreenViewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;

    this._realityModelListDiv = document.createElement("div");
    this._realityModelListDiv.style.display = "block";

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.overflowX = "none";
    this._element.style.overflowY = "none";
    const width = winSize.width * 0.98;
    this._element.style.width = `${width}px`;
    parent.appendChild(this._element);
    this._element.appendChild(this._realityModelListDiv);
  }

  public override get onViewChanged(): Promise<void> | undefined {
    return this.remakePanelWithSelection(0);
  }

  private async remakePanelWithSelection(ndx: number) {
    while (this._element.hasChildNodes())
      this._element.removeChild(this._element.firstChild!);
    this._selectedRealityModelIndex = ndx;
    this._realityModelListDiv = document.createElement("div");
    this._realityModelListDiv.style.display = "block";
    this._element.appendChild(this._realityModelListDiv);
    return this.populate();
  }

  private populateRealityModelList(): void {
    this._realityModels = [];
    this._vp.view.displayStyle.forEachRealityModel((x) => {
      const realityModel = new ContextModel(x);
      this._realityModels.push({ realityModel, modelName: realityModel.name });
    });
    if (this._vp.view.isSpatialView()) {
      for (const modelId of this._vp.view.modelSelector.models) {
        const model = this._vp.iModel.models.getLoaded(modelId);
        if (model instanceof SpatialModelState && model.isRealityModel) {
          const realityModel = new PersistentModel(model, this._vp.view.displayStyle.settings);
          this._realityModels.push({ realityModel, modelName: realityModel.name });
        }
      }
    }
    // create list of entries
    const entries = this._realityModels.map((realityModel, i) => {
      return ({ name: realityModel.modelName, value: i } as ComboBoxEntry);
    });

    clearElement(this._realityModelListDiv);
    const activeIndex = this._selectedRealityModelIndex;
    createComboBox({
      parent: this._realityModelListDiv,
      id: "Point Cloud Selection Box",
      name: "Reality Models: ",
      value: activeIndex,
      handler: (select) => {
        const valueIndex = Number.parseInt(select.value, 10);
        void this.remakePanelWithSelection(valueIndex);
      },
      entries,
    });
  }

  public async populate(): Promise<void> {
    if (!this._vp || !this._vp.view.isSpatialView())
      return;
    this.populateRealityModelList();
    const realityModel = this._realityModels.at(this._selectedRealityModelIndex)?.realityModel;
    if (undefined === realityModel)
      return;

    createRealityModelSettingsPanel(realityModel, this._element);
  }

  public get isOpen(): boolean { return "none" !== this._element.style.display; }
  protected _open(): void { this._element.style.display = "block"; }
  protected _close(): void { this._element.style.display = "none"; }
}
