/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  AmbientOcclusion,
  BackgroundMapProps,
  BackgroundMapProviderName,
  BackgroundMapType,
  ColorDef,
  ColorDefProps,
  EnvironmentProps,
  GlobeMode,
  HiddenLine,
  LightSettings,
  LightSettingsProps,
  LinePixels,
  MonochromeMode,
  RenderMode,
  SolarShadowSettings,
  SolarShadowSettingsProps,
  TerrainProps,
  ViewFlags,
  ViewFlagProps,
} from "@bentley/imodeljs-common";
import {
  DisplayStyle2dState,
  DisplayStyle3dState,
  DisplayStyleState,
  Environment,
  ViewState,
  ViewState3d,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  CheckBox,
  createCheckBox,
  ComboBox,
  ComboBoxEntry,
  createComboBox,
  createColorInput,
  createNestedMenu,
  createNumericInput,
  createSlider,
  Slider,
} from "@bentley/frontend-devtools";
import { ToolBarDropDown } from "./ToolBar";
import { Settings } from "./FeatureOverrides";
import { AmbientOcclusionEditor } from "./AmbientOcclusion";
import { EnvironmentEditor } from "./EnvironmentEditor";
import { ThematicDisplayEditor } from "./ThematicDisplay";

type UpdateAttribute = (view: ViewState) => void;

type ViewFlag = "acsTriad" | "grid" | "fill" | "materials" | "textures" | "visibleEdges" | "hiddenEdges" | "monochrome" | "constructions" | "transparency" | "weights" | "styles" | "clipVolume" | "forceSurfaceDiscard" | "whiteOnWhiteReversal";

interface Style3dPreset {
  name: string;
  viewflags?: ViewFlagProps;
  backgroundColor?: ColorDefProps;
  monochromeColor?: ColorDefProps;
  monochromeMode?: MonochromeMode;
  environment?: EnvironmentProps;
  hline?: HiddenLine.SettingsProps;
  ao?: AmbientOcclusion.Props;
  solarShadows?: SolarShadowSettingsProps;
  lights?: LightSettingsProps;
}

const stylePresets: Style3dPreset[] = [
  {
    name: "None",
  },
  {
    name: "Default",
    environment: {
      sky: {
        display: true, groundColor: 8228728, zenithColor: 16741686, nadirColor: 3880, skyColor: 16764303,
      },
      ground: {
        display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987,
      },
    },
    viewflags: {
      noConstruct: true, noFill: true, renderMode: 6,
    },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828] },
    },
    hline: {},
    ao: {},
    solarShadows: {},
  },
  {
    name: "Illustration",
    environment: {},
    backgroundColor: 10921638,
    viewflags: { noConstruct: true, noFill: true, noCameraLights: true, noSourceLights: true, noSolarLight: true, visEdges: true, renderMode: 6 },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828] },
    },
    hline: {
      visible: { ovrColor: true, color: 0, pattern: 0, width: 1 },
      hidden: { ovrColor: false, color: 16777215, pattern: 3435973836, width: 0 },
      transThreshold: 1,
    },
    ao: {},
    solarShadows: {},
  },
  {
    name: "Sun-dappled",
    environment: {
      sky: {
        display: true, groundColor: 8228728, zenithColor: 16741686, nadirColor: 3880, skyColor: 16764303,
      },
      ground: {
        display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987,
      },
    },
    viewflags: {
      noConstruct: true, noFill: true, shadows: true, renderMode: 6,
    },
    lights: {
      solar: { direction: [0.9391245716329828, 0.10165764029437066, -0.3281931795832247] },
      hemisphere: { intensity: 0.2 },
      portrait: { intensity: 0 },
    },
    hline: {},
    ao: {},
    solarShadows: {},
  },
  {
    name: "Schematic",
    environment: {},
    backgroundColor: 16777215,
    viewflags: { noConstruct: true, noFill: true, visEdges: true, renderMode: 6 },
    lights: {
      solar: { direction: [0, -0.6178171353958787, 0.7863218089378106], intensity: 1.95, alwaysEnabled: true },
      ambient: { intensity: 0.65 },
      portrait: { intensity: 0 },
      specularIntensity: 0,
    },
    hline: {
      visible: { ovrColor: true, color: 0, pattern: 0, width: 2 },
      hidden: { ovrColor: false, color: 16777215, pattern: 3435973836, width: 0 },
      transThreshold: 1,
    },
    ao: {},
    solarShadows: {},
  },
  {
    name: "Outdoorsy",
    environment: {
      sky: { display: true, groundColor: 8228728, zenithColor: 16741686, nadirColor: 3880, skyColor: 16764303 },
      ground: { display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987 },
    },
    viewflags: { noConstruct: true, noFill: true, renderMode: 6 },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828], intensity: 1.05 },
      ambient: { intensity: 0.25 },
      hemisphere: {
        upperColor: { r: 206, g: 233, b: 255 },
        intensity: 0.5,
      },
      portrait: { intensity: 0 },
    },
    hline: {},
    ao: {},
    solarShadows: {},
  },
  {
    name: "Soft",
    environment: {
      sky: { display: true, groundColor: 8228728, zenithColor: 16741686, nadirColor: 3880, skyColor: 16764303 },
      ground: { display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987 },
    },
    viewflags: { noConstruct: true, noFill: true, ambientOcclusion: true, renderMode: 6 },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828], intensity: 0 },
      ambient: { intensity: 0.75 },
      hemisphere: { intensity: 0.3 },
      portrait: { intensity: 0.5 },
      specularIntensity: 0.4,
    },
    ao: { bias: 0.25, zLengthCap: 0.0025, maxDistance: 100, intensity: 1, texelStepSize: 1, blurDelta: 1.5, blurSigma: 2, blurTexelStepSize: 1 },
    hline: {},
    solarShadows: {},
  },
  {
    name: "Moonlit",
    environment: {
      sky: { display: true, groundColor: 2435876, zenithColor: 0, nadirColor: 3880, skyColor: 3481088 },
      ground: { display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987 },
    },
    viewflags: { noConstruct: true, noFill: true, visEdges: true, renderMode: 6 },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828], intensity: 3, alwaysEnabled: true },
      ambient: { intensity: 0.05 },
      hemisphere: { lowerColor: { r: 83, g: 100, b: 87 } },
      portrait: { intensity: 0 },
      specularIntensity: 0,
    },
    monochromeMode: 0,
    hline: {
      visible: { ovrColor: true, color: 0, pattern: -1, width: 0 },
      hidden: { ovrColor: false, color: 16777215, pattern: 3435973836, width: 0 },
      transThreshold: 1,
    },
    monochromeColor: 7897479,
    ao: {},
    solarShadows: {},
  },
  {
    name: "Gloss",
    environment: {
      sky: { display: true, groundColor: 8228728, zenithColor: 16741686, nadirColor: 3880, skyColor: 16764303 },
      ground: { display: false, elevation: -0.01, aboveColor: 32768, belowColor: 1262987 },
    },
    viewflags: { noConstruct: true, noFill: true, visEdges: true, renderMode: 6 },
    lights: {
      solar: { direction: [-0.9833878378071199, -0.18098510351728977, 0.013883542698953828] },
      specularIntensity: 4.15,
    },
    hline: {
      visible: { ovrColor: true, color: 8026756, pattern: 0, width: 1 },
      hidden: { ovrColor: false, color: 16777215, pattern: 3435973836, width: 0 },
      transThreshold: 1,
    },
    ao: {},
    solarShadows: {},
  },
];

export class ViewAttributes {
  private static _expandViewFlags = false;
  private static _expandEdgeDisplay = false;
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _updates: UpdateAttribute[] = [];
  private _updating = false;
  private readonly _removeMe: () => void;
  private readonly _parent: HTMLElement;
  private _id = 0;
  private _scratchViewFlags = new ViewFlags();

  private _displayStylePickerDiv?: HTMLDivElement;
  public set displayStylePickerInput(newComboBox: ComboBox) {
    while (this._displayStylePickerDiv!.hasChildNodes())
      this._displayStylePickerDiv!.removeChild(this._displayStylePickerDiv!.firstChild!);

    this._displayStylePickerDiv!.appendChild(newComboBox.div);
  }

  public constructor(vp: Viewport, parent: HTMLElement, disableEdges = false) {
    this._vp = vp;
    this._parent = parent;
    this._element = document.createElement("div");
    this._element.className = "debugPanel"; // "toolMenu"; or set display="block"...

    this._removeMe = vp.onViewChanged.addListener((_vp) => this.update());

    this.addDisplayStylePicker();
    this.addRenderMode();
    this.addPresets();
    this._element.appendChild(document.createElement("hr"));

    const flagsDiv = document.createElement("div");
    createNestedMenu({
      id: this._nextId,
      label: "View Flags",
      parent: this._element,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      expand: ViewAttributes._expandViewFlags,
      handler: (expanded) => ViewAttributes._expandViewFlags = expanded,
      body: flagsDiv,
    });

    this._element.appendChild(flagsDiv);

    this.addViewFlagAttribute(flagsDiv, "ACS Triad", "acsTriad");
    this.addViewFlagAttribute(flagsDiv, "Grid", "grid");
    this.addViewFlagAttribute(flagsDiv, "Fill", "fill");
    this.addViewFlagAttribute(flagsDiv, "Materials", "materials");
    this.addViewFlagAttribute(flagsDiv, "Textures", "textures");
    this.addViewFlagAttribute(flagsDiv, "Constructions", "constructions");
    this.addViewFlagAttribute(flagsDiv, "Transparency", "transparency");
    this.addViewFlagAttribute(flagsDiv, "Line Weights", "weights");
    this.addViewFlagAttribute(flagsDiv, "Line Styles", "styles");
    this.addViewFlagAttribute(flagsDiv, "Clip Volume", "clipVolume", true);
    this.addViewFlagAttribute(flagsDiv, "Force Surface Discard", "forceSurfaceDiscard", true);
    this.addViewFlagAttribute(flagsDiv, "White-on-white Reversal", "whiteOnWhiteReversal");

    this.addCameraToggle(flagsDiv);
    this.addMonochrome(flagsDiv);

    this.addEnvironmentEditor();
    this.addBackgroundMapOrTerrain();
    if (!disableEdges)
      this.addEdgeDisplay();

    this.addAmbientOcclusion();
    this.addThematicDisplay();

    // Set initial states
    this.update();

    parent.appendChild(this._element);
  }

  public dispose(): void {
    this._removeMe();
    this._parent.removeChild(this._element);
  }

  private addDisplayStylePicker(): void {
    this._displayStylePickerDiv = document.createElement("div");
    this._element.appendChild(this._displayStylePickerDiv);
  }

  private addEnvironmentEditor() {
    const env = new EnvironmentEditor(this._vp, this._element);
    this._updates.push((view) => env.update(view));
  }

  private addViewFlagAttribute(parent: HTMLElement, label: string, flag: ViewFlag, only3d: boolean = false): void {
    const elems = this.addCheckbox(label, (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf[flag] = enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, parent);

    const update = (view: ViewState) => {
      const visible = !only3d || view.is3d();
      elems.div.style.display = visible ? "" : "none";
      if (visible)
        elems.checkbox.checked = view.viewFlags[flag];
    };

    this._updates.push(update);
  }

  private addCameraToggle(parent: HTMLElement): void {
    const elems = this.addCheckbox("Camera", (enabled: boolean) => {
      if (enabled)
        this._vp.turnCameraOn();
      else
        (this._vp.view as ViewState3d).turnCameraOff();

      this.sync(true);
    }, parent);

    const update = (view: ViewState) => {
      const visible = view.is3d() && view.allow3dManipulations() && view.supportsCamera();
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = this._vp.isCameraOn;
    };

    this._updates.push(update);
  }

  private addMonochrome(parent: HTMLElement): void {
    const colorInput = createColorInput({
      label: "Color",
      id: this._nextId,
      parent,
      display: "inline",
      value: this._vp.view.displayStyle.settings.monochromeColor.toHexString(),
      handler: (color) => {
        this._vp.view.displayStyle.settings.monochromeColor = new ColorDef(color);
        this.sync();
      },
    });
    colorInput.div.style.cssFloat = "right";

    const scaledCb = this.addCheckbox("Scaled", (enabled: boolean) => {
      this._vp.displayStyle.settings.monochromeMode = enabled ? MonochromeMode.Scaled : MonochromeMode.Flat;
      this.sync();
    }, parent);
    scaledCb.div.style.cssFloat = "right";

    this.addViewFlagAttribute(parent, "Monochrome", "monochrome");

    this._updates.push((view: ViewState) => {
      if (view.viewFlags.monochrome) {
        colorInput.div.style.display = scaledCb.div.style.display = "";
        colorInput.input.value = view.displayStyle.settings.monochromeColor.toHexString();
        scaledCb.checkbox.checked = MonochromeMode.Scaled === view.displayStyle.settings.monochromeMode;
      } else {
        colorInput.div.style.display = scaledCb.div.style.display = "none";
      }
    });
  }

  private addRenderMode(): void {
    const div = document.createElement("div") as HTMLDivElement;

    const entries = [
      { name: "Wireframe", value: RenderMode.Wireframe },
      { name: "Solid Fill", value: RenderMode.SolidFill },
      { name: "Hidden Line", value: RenderMode.HiddenLine },
      { name: "Smooth Shade", value: RenderMode.SmoothShade },
    ];

    const select = createComboBox({
      parent: div,
      name: "Render Mode: ",
      entries,
      id: "viewAttr_renderMode",
      value: this._vp.viewFlags.renderMode,
      handler: (thing) => {
        const flags = this._vp.view.viewFlags.clone(this._scratchViewFlags);
        flags.renderMode = Number.parseInt(thing.value, 10);
        this._vp.viewFlags = flags;
        this.sync();
      },
    }).select;

    this._updates.push((view) => {
      const visible = view.is3d();
      div.style.display = visible ? "block" : "none";
      if (visible)
        select.value = view.viewFlags.renderMode.toString();
    });

    this._element.appendChild(div);
  }

  private addPresets(): void {
    const div = document.createElement("div");
    const entries: ComboBoxEntry[] = stylePresets.map((preset, index) => ({ name: preset.name, value: index }));
    createComboBox({
      parent: div,
      name: "Preset: ",
      entries,
      id: "viewAttr_preset",
      value: 0,
      handler: (cbx) => {
        this.applyPreset(stylePresets[parseInt(cbx.value, 10)]);
      },
    });

    this._updates.push((view) => {
      div.style.display = view.is3d() ? "" : "none";
    });

    this._element.appendChild(div);
  }

  private applyPreset(preset: Style3dPreset): void {
    if (preset.name === "None")
      return;

    const style = this._vp.view.is3d() ? this._vp.view.getDisplayStyle3d().clone(this._vp.iModel) : undefined;
    if (!style)
      return;

    if (preset.environment)
      style.environment = new Environment(preset.environment);

    if (preset.backgroundColor)
      style.backgroundColor = ColorDef.fromJSON(preset.backgroundColor);

    if (preset.monochromeColor)
      style.monochromeColor = ColorDef.fromJSON(preset.monochromeColor);

    if (preset.monochromeMode)
      style.settings.monochromeMode = preset.monochromeMode;

    if (preset.viewflags)
      style.viewFlags = ViewFlags.fromJSON(preset.viewflags);

    if (preset.hline)
      style.settings.hiddenLineSettings = HiddenLine.Settings.fromJSON(preset.hline);

    if (preset.ao)
      style.settings.ambientOcclusionSettings = AmbientOcclusion.Settings.fromJSON(preset.ao);

    if (preset.solarShadows)
      style.settings.solarShadows = SolarShadowSettings.fromJSON(preset.solarShadows);

    if (preset.lights)
      style.settings.lights = LightSettings.fromJSON(preset.lights);

    this._vp.displayStyle = style;
  }

  private addAmbientOcclusion(): void {
    const ao = new AmbientOcclusionEditor(this._vp, this._element);
    this._updates.push((view) => ao.update(view));
  }

  private addThematicDisplay(): void {
    const thematic = new ThematicDisplayEditor(this._vp, this._element);
    this._updates.push((view) => thematic.update(view));
  }

  private getBackgroundMap(view: ViewState) { return view.displayStyle.settings.backgroundMap; }
  private addBackgroundMapOrTerrain(): void {
    const isMapSupported = (view: ViewState) => view.is3d() && view.iModel.isGeoLocated;

    const div = document.createElement("div");
    div.appendChild(document.createElement("hr")!);

    const backgroundSettingsDiv = document.createElement("div")!;

    const showOrHideSettings = (show: boolean) => {
      const display = show ? "block" : "none";
      backgroundSettingsDiv.style.display = display;
    };

    const enableMap = (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.backgroundMap = enabled;
      this._vp.viewFlags = vf;
      backgroundSettingsDiv.style.display = enabled ? "block" : "none";
      showOrHideSettings(enabled);
      this.sync();
    };
    const checkbox = this.addCheckbox("Background Map", enableMap, div).checkbox;

    const imageryProviders = createComboBox({
      parent: backgroundSettingsDiv,
      name: "Imagery: ",
      id: "viewAttr_MapProvider",
      entries: [
        { name: "Bing", value: "BingProvider" },
        { name: "MapBox", value: "MapBoxProvider" },
      ],
      handler: (select) => this.updateBackgroundMap({ providerName: select.value as BackgroundMapProviderName }),
    }).select;

    const types = createComboBox({
      parent: backgroundSettingsDiv,
      name: "Type: ",
      id: "viewAttr_mapType",
      entries: [
        { name: "Street", value: BackgroundMapType.Street },
        { name: "Aerial", value: BackgroundMapType.Aerial },
        { name: "Hybrid", value: BackgroundMapType.Hybrid },
      ],
      handler: (select) => this.updateBackgroundMap({ providerData: { mapType: Number.parseInt(select.value, 10) } }),
    }).select;
    const globeModes = createComboBox({
      parent: backgroundSettingsDiv,
      name: "Globe: ",
      id: "viewAttr_globeMode",
      entries: [
        { name: "Ellipsoid", value: GlobeMode.Ellipsoid },
        { name: "Plane", value: GlobeMode.Plane },
      ],
      handler: (select) => this.updateBackgroundMap({ globeMode: Number.parseInt(select.value, 10) }),
    }).select;

    const terrainSettings = this.addTerrainSettings();
    const mapSettings = this.addMapSettings();

    const enableTerrain = (enable: boolean) => {
      this.updateBackgroundMap({ applyTerrain: enable });
      terrainSettings.style.display = enable ? "block" : "none";
      mapSettings.style.display = enable ? "none" : "block";
      this.sync();
    };

    const terrainCheckbox = this.addCheckbox("Terrain", enableTerrain, backgroundSettingsDiv).checkbox;
    const transCheckbox = this.addCheckbox("Transparency", (enabled: boolean) => this.updateBackgroundMap({ transparency: enabled ? 0.5 : false }), backgroundSettingsDiv).checkbox;
    backgroundSettingsDiv.appendChild(document.createElement("hr")!);
    backgroundSettingsDiv.appendChild(document.createElement("hr")!);
    backgroundSettingsDiv.appendChild(mapSettings);
    backgroundSettingsDiv.appendChild(terrainSettings);

    this._updates.push((view) => {
      const visible = isMapSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = view.viewFlags.backgroundMap;
      showOrHideSettings(checkbox.checked);

      const map = this.getBackgroundMap(view);
      imageryProviders.value = map.providerName;
      types.value = map.mapType.toString();
      terrainCheckbox.checked = map.applyTerrain;
      transCheckbox.checked = false !== map.transparency;
      globeModes.value = map.globeMode.toString();
      if (map.applyTerrain !== terrainCheckbox.checked)
        enableTerrain(terrainCheckbox.checked);
    });
    div.appendChild(backgroundSettingsDiv);
    this._element.appendChild(div);
  }

  private addMapSettings() {
    const mapSettingsDiv = document.createElement("div");
    const groundBiasDiv = document.createElement("div") as HTMLDivElement;
    const groundBiasLabel = document.createElement("label") as HTMLLabelElement;
    groundBiasLabel.style.display = "inline";
    groundBiasLabel.htmlFor = "ts_viewToolPickRadiusInches";
    groundBiasLabel.innerText = "Ground Bias: ";
    groundBiasDiv.appendChild(groundBiasLabel);
    const groundBias = createNumericInput({
      parent: groundBiasDiv,
      value: this.getBackgroundMap(this._vp.view).groundBias,
      handler: (value) => this.updateBackgroundMap({ groundBias: value }),
    }, true);
    groundBiasDiv.style.display = "block";
    groundBiasDiv.style.textAlign = "left";
    mapSettingsDiv.appendChild(groundBiasDiv);

    const depthCheckbox = this.addCheckbox("Depth", (enabled: boolean) => this.updateBackgroundMap({ useDepthBuffer: enabled }), mapSettingsDiv).checkbox;

    this._updates.push((view) => {
      const map = this.getBackgroundMap(view);
      groundBias.value = map.groundBias.toString();
      depthCheckbox.checked = map.useDepthBuffer;

    });
    return mapSettingsDiv;
  }

  private updateBackgroundMap(props: BackgroundMapProps): void {
    this._vp.changeBackgroundMapProps(props);
    this.sync();
  }

  private addTerrainSettings() {
    const getTerrainSettings = (view: ViewState) => view.displayStyle.settings.backgroundMap.terrainSettings;
    const updateTerrainSettings = (props: TerrainProps) => this._vp.changeBackgroundMapProps({ terrainSettings: props });

    const settingsDiv = document.createElement("div")!;
    const heightOriginMode: HTMLSelectElement = createComboBox({
      name: "Height Origin Mode: ",
      id: "viewAttr_TerrainHeightOrigin",
      entries: [
        { name: "GPS (Geodetic/Ellipsoid)", value: "0" },
        { name: "Sea Level (Geoid)", value: "1" },
        { name: "Ground", value: "2" },
      ],
      handler: (select) => { updateTerrainSettings({ heightOriginMode: parseInt(select.value, 10) }); },
    }).select;

    const heightOriginDiv = document.createElement("div") as HTMLDivElement;
    const heightOriginLabel = document.createElement("label") as HTMLLabelElement;
    heightOriginLabel.style.display = "inline";
    heightOriginLabel.htmlFor = "ts_viewToolPickRadiusInches";
    heightOriginLabel.innerText = "Model Height: ";
    heightOriginDiv.appendChild(heightOriginLabel);
    const heightOrigin = createNumericInput({
      parent: heightOriginDiv,
      value: getTerrainSettings(this._vp.view).heightOrigin,
      handler: (value) => updateTerrainSettings({ heightOrigin: value }),
    }, true);
    heightOriginDiv.appendChild(heightOriginMode);
    heightOriginDiv.style.display = "block";
    heightOriginDiv.style.textAlign = "left";
    settingsDiv.appendChild(heightOriginDiv);

    const exaggerationDiv = document.createElement("div") as HTMLDivElement;
    const exaggerationLabel = document.createElement("label") as HTMLLabelElement;
    exaggerationLabel.style.display = "inline";
    exaggerationLabel.htmlFor = "ts_viewToolPickRadiusInches";
    exaggerationLabel.innerText = "Exaggeration: ";
    exaggerationDiv.appendChild(exaggerationLabel);
    const exaggeration = createNumericInput({
      parent: exaggerationDiv,
      value: getTerrainSettings(this._vp.view).exaggeration,
      handler: (value) => updateTerrainSettings({ exaggeration: value }),
    }, true);
    exaggerationDiv.style.display = "block";
    exaggerationDiv.style.textAlign = "left";
    settingsDiv.appendChild(exaggerationDiv);

    this._updates.push((view) => {
      const map = view.displayStyle.settings.backgroundMap;
      const terrainSettings = map.terrainSettings;
      heightOriginMode.value = terrainSettings.heightOriginMode.toString();
      heightOrigin.value = terrainSettings.heightOrigin.toString();
      exaggeration.value = terrainSettings.exaggeration.toString();
    });

    return settingsDiv;
  }

  private addCheckbox(cbLabel: string, handler: (enabled: boolean) => void, parent?: HTMLElement): CheckBox {
    if (undefined === parent)
      parent = this._element;

    return createCheckBox({
      parent,
      name: cbLabel,
      id: this._nextId,
      handler: (cb) => handler(cb.checked),
    });
  }

  private update(): void {
    if (!this._updating) {
      this._updating = true;
      for (const update of this._updates)
        update(this._vp.view);

      this._updating = false;
    }
  }

  private sync(saveInUndo = false): void {
    this._vp.synchWithView({ noSaveInUndo: !saveInUndo });
  }

  private get _nextId(): string {
    ++this._id;
    return "viewAttributesPanel_" + this._id;
  }

  private get edgeSettings() { return (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings; }
  private overrideEdgeSettings(props: HiddenLine.SettingsProps) {
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings = this.edgeSettings.override(props);
    this.sync();
  }

  private addEdgeDisplay(): void {
    const edgeDisplayDiv = document.createElement("div");
    const nestedMenu = createNestedMenu({
      id: this._nextId,
      label: "Edge Display",
      parent: this._element,
      expand: ViewAttributes._expandEdgeDisplay,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      handler: (expanded) => ViewAttributes._expandEdgeDisplay = expanded,
      body: edgeDisplayDiv,
    });

    const slider: Slider = createSlider({
      id: this._nextId,
      name: "Transparency Threshold",
      parent: edgeDisplayDiv,
      min: "0.0",
      max: "1.0",
      step: "0.05",
      value: "1.0",
      handler: (_) => this.overrideEdgeSettings({ transThreshold: parseFloat(slider.slider.value) }),
    });
    slider.div.style.textAlign = "left";

    const visEdgesCb = this.addCheckbox("Visible Edges", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.visibleEdges = enabled;
      hidEdgesCb.checkbox.disabled = !enabled;
      hidEditor.hidden = hidEditor.hidden || !enabled;
      visEditor.hidden = !enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, nestedMenu.body);

    const visEditor = this.addHiddenLineEditor(false);
    edgeDisplayDiv.appendChild(visEditor);

    const hidEdgesCb = this.addCheckbox("Hidden Edges", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.hiddenEdges = enabled;
      hidEditor.hidden = !enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, edgeDisplayDiv);

    const hidEditor = this.addHiddenLineEditor(true);
    edgeDisplayDiv.appendChild(hidEditor);

    this._updates.push((view) => {
      if (view.is2d()) {
        nestedMenu.div.hidden = true;
        return;
      }

      nestedMenu.div.hidden = false;
      const settings = this.edgeSettings;
      slider.slider.value = settings.transparencyThreshold.toString();

      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      visEdgesCb.checkbox.checked = vf.visibleEdges;
      visEditor.hidden = !vf.visibleEdges;
      hidEdgesCb.checkbox.checked = vf.visibleEdges && vf.hiddenEdges;
      hidEditor.hidden = !vf.hiddenEdges;
    });
  }

  private addHiddenLineEditor(forHiddenEdges: boolean): HTMLDivElement {
    const style = this._vp.view.is3d() ? this.edgeSettings : HiddenLine.Settings.defaults;
    const settingsName = forHiddenEdges ? "hidden" : "visible";
    const settings = style[settingsName];
    const div = document.createElement("div");
    div.style.paddingLeft = "10px";
    div.hidden = forHiddenEdges ? !this._vp.view.viewFlags.hiddenEdges : !this._vp.view.viewFlags.visibleEdges;

    // Color override (visible only)
    let colorCb: HTMLInputElement | undefined;
    let colorInput: HTMLInputElement | undefined;
    if (!forHiddenEdges) {
      const colorDiv = document.createElement("div");
      div.appendChild(colorDiv);

      colorCb = document.createElement("input");
      colorCb.type = "checkbox";
      colorCb.id = this._nextId;
      colorCb.checked = settings.ovrColor;
      colorDiv.appendChild(colorCb);

      const color = undefined !== settings.color ? settings.color.toHexString() : "#ffffff";
      colorInput = createColorInput({
        parent: colorDiv,
        id: this._nextId,
        label: "Color",
        value: color,
        display: "inline",
        disabled: !settings.ovrColor,
        handler: (value: string) => this.overrideEdgeSettings({ [settingsName]: this.edgeSettings[settingsName].overrideColor(new ColorDef(value)) }),
      }).input;

      colorCb.addEventListener("click", () => {
        this.overrideEdgeSettings({ [settingsName]: this.edgeSettings[settingsName].overrideColor(colorCb!.checked ? new ColorDef(colorInput!.value) : undefined) });
      });
    }

    // Width override
    const widthDiv = document.createElement("div");
    div.appendChild(widthDiv);

    const widthCb = document.createElement("input");
    widthCb.type = "checkbox";
    widthCb.id = this._nextId;
    widthCb.checked = undefined !== settings.width;
    widthDiv.appendChild(widthCb);

    const widthLabel = document.createElement("label");
    widthLabel.htmlFor = widthCb.id;
    widthLabel.innerText = "Weight ";
    widthDiv.appendChild(widthLabel);

    const width = createNumericInput({
      parent: widthDiv,
      value: undefined !== settings.width ? settings.width : 1,
      disabled: undefined === settings.width,
      min: 1,
      max: 31,
      step: 1,
      handler: (value) => this.overrideEdgeSettings({ [settingsName]: this.edgeSettings[settingsName].overrideWidth(value) }),
    });
    widthDiv.appendChild(width);

    widthCb.addEventListener("click", () => {
      this.overrideEdgeSettings({ [settingsName]: this.edgeSettings[settingsName].overrideWidth(widthCb.checked ? parseInt(width.value, 10) : undefined) });
    });

    // Line style override
    const patternCb = Settings.addStyle(div, settings.pattern ? settings.pattern : LinePixels.Invalid, (select) => {
      this.overrideEdgeSettings({ [settingsName]: this.edgeSettings[settingsName].overridePattern(parseInt(select.value, 10)) });
    });

    // Synchronization
    this._updates.push((view: ViewState) => {
      if (view.is2d()) {
        div.hidden = true;
        return;
      }

      const curStyle = this.edgeSettings[settingsName];
      if (undefined !== colorCb && undefined !== colorInput) {
        colorCb.checked = undefined !== curStyle.color;
        colorInput.disabled = !colorCb.checked;
        if (undefined !== curStyle.color)
          colorInput.value = curStyle.color.toHexString();
      }

      widthCb.checked = undefined !== curStyle.width;
      width.disabled = !widthCb.checked;
      if (undefined !== curStyle.width)
        width.value = curStyle.width.toString();

      const pix = undefined !== curStyle.pattern ? curStyle.pattern : LinePixels.Invalid;
      patternCb.select.value = pix.toString();
    });

    return div;
  }
}

export class ViewAttributesPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _attributes?: ViewAttributes;
  private _displayStylePickerInput?: ComboBox;
  private _disableEdges: boolean;

  public constructor(vp: Viewport, parent: HTMLElement, disableEdges: boolean) {
    super();
    this._vp = vp;
    this._parent = parent;
    this._disableEdges = disableEdges;
    this.open();
  }

  public async populate(): Promise<void> {
    if (undefined !== this._displayStylePickerInput)
      this._displayStylePickerInput.select.disabled = true;

    const view = this._vp.view;
    const is3d = view.is3d();
    const sqlName: string = is3d ? DisplayStyle3dState.classFullName : DisplayStyle2dState.classFullName;
    const displayStyleProps = await this._vp.view.iModel.elements.queryProps({ from: sqlName, where: "IsPrivate=FALSE" });
    const displayStyles = new Map<Id64String, DisplayStyleState>();
    const styleEntries = [];
    const promises: Array<Promise<void>> = [];
    for (const displayStyleProp of displayStyleProps) {
      styleEntries.push({ name: displayStyleProp.code.value!, value: displayStyleProp.id });
      let displayStyle: DisplayStyleState;
      if (is3d)
        displayStyle = new DisplayStyle3dState(displayStyleProp, view.iModel);
      else
        displayStyle = new DisplayStyle2dState(displayStyleProp, view.iModel);

      displayStyles.set(displayStyleProp.id!, displayStyle);
    }

    await Promise.all(promises);

    this._displayStylePickerInput = createComboBox({
      name: "Style: ",
      id: "DisplayStyles",
      value: this._vp.view.displayStyle.id,
      handler: (select) => {
        this._vp.displayStyle = displayStyles.get(select.value)!;
        this._vp.invalidateScene();
      },
      entries: styleEntries,
    });

    this._displayStylePickerInput.select.disabled = false;
    if (undefined !== this._attributes)
      this._attributes.displayStylePickerInput = this._displayStylePickerInput;
  }
  public get onViewChanged(): Promise<void> {
    return this.populate();
  }

  public get isOpen() { return undefined !== this._attributes; }
  protected _open(): void {
    this._attributes = new ViewAttributes(this._vp, this._parent, this._disableEdges);
    const loadingComboBox = createComboBox({
      name: "Style: ",
      id: "DisplayStyles",
      entries: [{ name: "Now Loading...", value: undefined }],
    });
    if (undefined === this._displayStylePickerInput)
      this._attributes.displayStylePickerInput = loadingComboBox;
    else
      this._attributes.displayStylePickerInput = this._displayStylePickerInput;
  }

  protected _close(): void {
    if (undefined !== this._attributes) {
      this._attributes.dispose();
      this._attributes = undefined;
    }
  }
}
