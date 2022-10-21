/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  DisplayStyleSettings, FeatureAppearance, FeatureAppearanceProps, PointCloudDisplayProps, RealityModelDisplayProps, RealityModelDisplaySettings,
} from "@itwin/core-common";
import {
  ContextRealityModelState, IModelApp, SpatialModelState, Tool, Viewport,
} from "@itwin/core-frontend";
import {
  convertHexToRgb, createCheckBox, createColorInput, createLabeledNumericInput, createRadioBox, createSlider,
} from "@itwin/frontend-devtools";
import { Surface } from "./Surface";
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

function createRealityModelSettingsPanel(model: RealityModel, parent: HTMLElement) {
  const updateSettings = (props: RealityModelDisplayProps) => model.settings = model.settings.clone(props);
  const updateAppearance = (props: FeatureAppearanceProps | undefined) => {
    if (!props)
      model.appearance = undefined;
    else if (!model.appearance)
      model.appearance = FeatureAppearance.fromJSON(props);
    else
      model.appearance = model.appearance.clone(props);
  };

  const element = document.createElement("div");
  element.className = "debugPanel";
  element.style.height = "96%";
  element.style.width = "98%";
  element.style.top = "0px";
  element.style.left = "0px";
  element.style.zIndex = "inherit";
  parent.appendChild(element);

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
    verticalAlign: false, textAlign: false,
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
  const sdiv0 = document.createElement("div");
  sdiv0.style.display = "inline";
  const slabel0 = document.createElement("label");
  slabel0.innerText = model.settings.pointCloud.voxelScale.toString();
  sdiv0.appendChild(slabel0);
  const voxelSizeSlider = createSlider({
    name: " Size ", id: "rms_scale", parent: sizeMode.div,
    min: "0.25", max: "10", step: "0.25",
    value: model.settings.pointCloud.voxelScale.toString(),
    verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      slabel0.innerText = slider.value.toString();
      if (!Number.isNaN(scale))
        updatePointCloud({ voxelScale: scale });
    },
  }).div;
  voxelSizeSlider.appendChild(sdiv0);

  const sdiv0p = document.createElement("div");
  sdiv0p.style.display = "inline";
  const slabel0p = document.createElement("label");
  slabel0p.innerText = model.settings.pointCloud.voxelScale.toString();
  sdiv0p.appendChild(slabel0p);
  const pixelSizeSlider = createSlider({
    name: " Size ", id: "rms_size", parent: sizeMode.div,
    min: "1", max: "64", step: "1",
    value: model.settings.pointCloud.pixelSize.toString(),
    verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const pixelSize = Number.parseInt(slider.value, 10);
      slabel0p.innerText = slider.value.toString();
      if (!Number.isNaN(pixelSize))
        updatePointCloud({ pixelSize });
    },
  }).div;
  pixelSizeSlider.appendChild(sdiv0p);

  setSizeMode(model.settings.pointCloud.sizeMode);

  //  ----------------- EDL -----------------
  const tdiv = document.createElement("div");
  const hr = document.createElement("hr");
  hr.style.borderColor = "grey";
  tdiv.appendChild(hr);
  const label1 = document.createElement("label");
  label1.innerText = "EDL";
  tdiv.appendChild(label1);
  element.appendChild(tdiv);

  createCheckBox({
    name: "Advanced:", id: "pcs_adv",
    parent: element,
    isChecked: model.settings.pointCloud.edlAdvanced === 1,
    handler: (cb) => updatePointCloud({ edlAdvanced: cb.checked ? 1 : 0 }),
  });

  createCheckBox({
    name: "Filter:", id: "pcs_filter",
    parent: element,
    isChecked: model.settings.pointCloud.edlFilter === 1,
    handler: (cb) => updatePointCloud({ edlFilter: cb.checked ? 1 : 0 }),
  });

  // EDL strength
  const sdiv1 = document.createElement("div");
  sdiv1.style.display = "inline";
  const slabel1 = document.createElement("label");
  slabel1.innerText = model.settings.pointCloud.edlStrength.toString();
  sdiv1.appendChild(slabel1);
  const edlStrengthSlider = createSlider({
    name: " Strength ", id: "pcs_strength", parent: element,
    min: "0.0", max: "25", step: "0.25",
    value: model.settings.pointCloud.edlStrength.toString(),
    verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      slabel1.innerText = slider.value.toString();
      if (!Number.isNaN(scale))
        updatePointCloud({ edlStrength: scale });
    },
  }).div;
  edlStrengthSlider.style.display = "";
  edlStrengthSlider.appendChild(sdiv1);

  // EDL radius
  const sdiv2 = document.createElement("div");
  sdiv2.style.display = "inline";
  const slabel2 = document.createElement("label");
  slabel2.innerText = model.settings.pointCloud.edlRadius.toString();
  sdiv2.appendChild(slabel2);
  const edlRadiusSlider = createSlider({
    name: " Radius ", id: "pcs_radius", parent: element,
    min: "0.0", max: "25", step: "0.25",
    value: model.settings.pointCloud.edlRadius.toString(),
    verticalAlign: false, textAlign: false,
    handler: (slider) => {
      const scale = Number.parseFloat(slider.value);
      slabel2.innerText = slider.value.toString();
      if (!Number.isNaN(scale))
        updatePointCloud({ edlRadius: scale });
    },
  }).div;
  edlRadiusSlider.style.display = "";
  edlRadiusSlider.appendChild(sdiv2);

  createCheckBox({
    name: "AdvSimpTemp:", id: "pcs_dbg1",
    parent: element,
    isChecked: model.settings.pointCloud.edlDbg1 === 1,
    handler: (cb) => updatePointCloud({ edlDbg1: cb.checked ? 1 : 0 }),
  });

  createLabeledNumericInput({
    name: "edlMixWts1: ", id: "pcs_mixwt1", parent: element,
    value: model.settings.pointCloud.edlMixWts1 ?? 1,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlMixWts1: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
  });

  createLabeledNumericInput({
    name: "edlMixWts2: ", id: "pcs_mixwt2", parent: element,
    value: model.settings.pointCloud.edlMixWts2 ?? 0.5,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlMixWts2: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
  });

  createLabeledNumericInput({
    name: "edlMixWts4: ", id: "pcs_mixwt4", parent: element,
    value: model.settings.pointCloud.edlMixWts4 ?? 0.25,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlMixWts4: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
  });

  createLabeledNumericInput({
    name: "LightDirX: ", id: "pcs_lightDirX", parent: element,
    value: model.settings.pointCloud.edlLightDirX ?? 0,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlLightDirX: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
  });

  createLabeledNumericInput({
    id: "pcs_lightDirY",
    parent: element,
    value: model.settings.pointCloud.edlLightDirY ?? 0,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlLightDirY: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
    name: "LightDirY: ",
  });

  createLabeledNumericInput({
    name: "LightDirZ: ", id: "pcs_lightDirZ", parent: element,
    value: model.settings.pointCloud.edlLightDirZ ?? 0,
    handler: async (value, _) => {
      if (!Number.isNaN(value))
        updatePointCloud({ edlLightDirZ: value });
    },
    min: -1.0, max: 1.0, step: 0.1, parseAsFloat: true,
  });
}

const viewportIdsWithOpenWidgets = new Set<number>();

class RealityModelSettingsWidget extends Window {
  private readonly _windowId: string;
  private readonly _viewport: Viewport;
  private readonly _dispose: () => void;

  public constructor(viewport: Viewport, model: RealityModel) {
    super(Surface.instance, { top: 0, left: 0, width: 408, height: 400 });
    this._viewport = viewport;

    this._windowId = `realityModelSettings-${viewport.viewportId}-${model.name}`;
    this.isPinned = true;
    this.title = model.name;

    createRealityModelSettingsPanel(model, this.contentDiv);
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
