/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  ViewState,
  ViewState3d,
  Viewport,
  SkyGradient,
  Environment,
  SkyBox,
} from "@bentley/imodeljs-frontend";
import {
  AmbientOcclusion,
  BackgroundMapProps,
  BackgroundMapType,
  RenderMode,
  ViewFlags,
  ColorDef,
  SkyBoxProps,
} from "@bentley/imodeljs-common";
import { CheckBox, createCheckBox } from "./CheckBox";
import { createComboBox } from "./ComboBox";
import { createSlider, Slider } from "./Slider";
import { createButton } from "./Button";
import { ToolBarDropDown } from "./ToolBar";
import { createRadioBox, RadioBox } from "./RabioBox";
import { createColorInput, ColorInput } from "./ColorInput";

type UpdateAttribute = (view: ViewState) => void;

type ViewFlag = "acsTriad" | "grid" | "fill" | "materials" | "textures" | "visibleEdges" | "hiddenEdges" | "monochrome" | "constructions" | "transparency" | "weights" | "styles" | "clipVolume" | "forceSurfaceDiscard";
type EnvironmentAspect = "ground" | "sky";
type SkyboxType = "2colors" | "4colors";

export class ViewAttributes {
  private static _expandViewFlags = false;
  private readonly _vp: Viewport;
  private readonly _element: HTMLElement;
  private readonly _updates: UpdateAttribute[] = [];
  private _updating = false;
  private readonly _removeMe: () => void;
  private readonly _parent: HTMLElement;
  private _id = 0;
  private _aoBias?: Slider;
  private _aoZLengthCap?: Slider;
  private _aoIntensity?: Slider;
  private _aoTexelStepSize?: Slider;
  private _aoBlurDelta?: Slider;
  private _aoBlurSigma?: Slider;
  private _aoBlurTexelStepSize?: Slider;
  private _scratchViewFlags = new ViewFlags();
  private _eeSkyboxType?: RadioBox<SkyboxType>;
  private _eeZenithColor?: ColorInput;
  private _eeSkyColor?: ColorInput;
  private _eeGroundColor?: ColorInput;
  private _eeNadirColor?: ColorInput;
  private _eeSkyExponent?: Slider;
  private _eeGroundExponent?: Slider;
  private _eeBackgroundInput?: ColorInput;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._parent = parent;
    this._element = document.createElement("div");
    this._element.className = "debugPanel"; // "toolMenu"; or set display="block"...

    this._removeMe = vp.onViewChanged.addListener((_vp) => this.update());

    this.addRenderMode();
    this._element.appendChild(document.createElement("hr"));

    const flagsHeader = document.createElement("div");
    flagsHeader.style.width = "100%";

    const flagsToggle = document.createElement("span");
    flagsToggle.innerText = "View Flags";
    flagsHeader.appendChild(flagsToggle);

    const toggleFlagsButton = createButton({
      parent: flagsHeader,
      inline: true,
      handler: () => {
        ViewAttributes._expandViewFlags = !ViewAttributes._expandViewFlags;
        flagsDiv.style.display = ViewAttributes._expandViewFlags ? "block" : "none";
        toggleFlagsButton.button.value = ViewAttributes._expandViewFlags ? "-" : "+";
      },
      value: ViewAttributes._expandViewFlags ? "-" : "+",
    });

    toggleFlagsButton.div.style.cssFloat = "right";

    flagsHeader.appendChild(document.createElement("hr"));
    this._element.appendChild(flagsHeader);

    const flagsDiv = document.createElement("div");
    this._element.appendChild(flagsDiv);

    this.addViewFlagAttribute(flagsDiv, "ACS Triad", "acsTriad");
    this.addViewFlagAttribute(flagsDiv, "Grid", "grid");
    this.addViewFlagAttribute(flagsDiv, "Fill", "fill");
    this.addViewFlagAttribute(flagsDiv, "Materials", "materials");
    this.addViewFlagAttribute(flagsDiv, "Textures", "textures");
    this.addViewFlagAttribute(flagsDiv, "Visible Edges", "visibleEdges", true);
    this.addViewFlagAttribute(flagsDiv, "Hidden Edges", "hiddenEdges", true);
    this.addViewFlagAttribute(flagsDiv, "Monochrome", "monochrome");
    this.addViewFlagAttribute(flagsDiv, "Constructions", "constructions");
    this.addViewFlagAttribute(flagsDiv, "Transparency", "transparency");
    this.addViewFlagAttribute(flagsDiv, "Line Weights", "weights");
    this.addViewFlagAttribute(flagsDiv, "Line Styles", "styles");
    this.addViewFlagAttribute(flagsDiv, "Clip Volume", "clipVolume", true);
    this.addViewFlagAttribute(flagsDiv, "Force Surface Discard", "forceSurfaceDiscard", true);

    this.addLightingToggle(flagsDiv);
    this.addCameraToggle(flagsDiv);

    // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
    flagsDiv.style.display = ViewAttributes._expandViewFlags ? "block" : "none";

    this.addEnvironmentEditor();

    this.addBackgroundMap();
    this.addAmbientOcclusion();

    // Set initial states
    this.update();

    parent.appendChild(this._element);
  }

  public dispose(): void {
    this._removeMe();
    this._parent.removeChild(this._element);
  }

  private addEnvironmentEditor() {
    const is3d = this._vp.view.is3d();
    const view2d = this._vp.view;

    this._eeBackgroundInput = createColorInput({
      value: this._vp.view.backgroundColor.toHexString(),
      handler: (value) => {
        this._vp.view.displayStyle.backgroundColor = new ColorDef(value);
        this.sync();
      },
      id: this._nextId,
      label: "Background Color",
      display: is3d ? "none" : "block",
    });
    this._eeBackgroundInput.div.style.textAlign = "right";

    if (!is3d) {
      this._element.appendChild(this._eeBackgroundInput.div);
      return;
    }
    const eeDiv = document.createElement("div");
    const style = (view2d as ViewState3d).getDisplayStyle3d();
    const currentEvnimorment = style.environment.sky as SkyGradient;

    const showSkyboxControls = (enabled: boolean) => {
      eeDiv.hidden = !enabled;
      this._eeBackgroundInput!.div.style.display = enabled ? "none" : "block";
    };

    this.addEnvAttribute(this._element, "Sky Box", "sky", showSkyboxControls);

    this._element.appendChild(this._eeBackgroundInput.div);

    this._eeSkyboxType = createRadioBox({
      id: this._nextId,
      entries: [
        { value: "2colors", label: "2 Colors" },
        { value: "4colors", label: "4 Colors" },
      ],
      handler: (value) => {
        this.updateEnvironment({ twoColor: value === "2colors" });

        // Hide elements not relevant to 2 colors
        this._eeSkyColor!.div.hidden = value !== "4colors";
        this._eeGroundColor!.div.hidden = value !== "4colors";
        this._eeSkyExponent!.div.style.display = value !== "4colors" ? "none" : "block";
        this._eeGroundExponent!.div.style.display = value !== "4colors" ? "none" : "block";
      },
      parent: eeDiv,
      defaultValue: currentEvnimorment.twoColor ? "2colors" : "4colors",
    });

    this._eeZenithColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ zenithColor: new ColorDef(value) }),
      value: currentEvnimorment.zenithColor.toHexString(),
      label: "Zenith Color",
      parent: eeDiv,
    });
    this._eeZenithColor.div.style.textAlign = "right";

    this._eeSkyColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ skyColor: new ColorDef(value) }),
      value: currentEvnimorment.skyColor.toHexString(),
      label: "Sky Color",
      parent: eeDiv,
    });
    this._eeSkyColor.div.style.textAlign = "right";

    this._eeGroundColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ groundColor: new ColorDef(value) }),
      value: currentEvnimorment.groundColor.toHexString(),
      label: "Ground Color",
      parent: eeDiv,
    });
    this._eeGroundColor.div.style.textAlign = "right";

    this._eeNadirColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ nadirColor: new ColorDef(value) }),
      value: currentEvnimorment.nadirColor.toHexString(),
      label: "Nadir Color",
      parent: eeDiv,
    });
    this._eeNadirColor.div.style.textAlign = "right";

    this._eeSkyExponent = createSlider({
      parent: eeDiv,
      name: "Sky Exponent",
      id: this._nextId,
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: currentEvnimorment.skyExponent.toString(),
      handler: (slider) => this.updateEnvironment({ skyExponent: parseFloat(slider.value) }),
    });
    this._eeSkyExponent.div.style.textAlign = "right";

    this._eeGroundExponent = createSlider({
      parent: eeDiv,
      name: "Ground Exponent",
      id: this._nextId,
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: currentEvnimorment.groundExponent.toString(),
      handler: (slider) => this.updateEnvironment({ groundExponent: parseFloat(slider.value) }),
    });
    this._eeGroundExponent.div.style.textAlign = "right";

    const buttonDiv = document.createElement("div") as HTMLDivElement;

    createButton({
      parent: buttonDiv,
      id: "viewAttr_EEReset",
      value: "Reset",
      inline: true,
      handler: () => this.resetEnvironmentEditor(),
    });
    createButton({
      parent: buttonDiv,
      id: "viewAttr_eeExport",
      value: "Export",
      inline: true,
      handler: () => {
        const env = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky as SkyGradient;
        let msg = `Zenith Color: ${env.zenithColor.toRgbString()}\nNadir Color: ${env.nadirColor.toRgbString()}`;
        if (!env.twoColor)
          msg = msg.concat(`\nSky Color: ${env.skyColor.toRgbString()}\nGround Color: ${env.groundColor.toRgbString()}\nSky Exponent: ${env.skyExponent}\nGround Exponent: ${env.groundExponent}`);
        alert(msg);
      },
    });
    buttonDiv.style.textAlign = "center";
    eeDiv.appendChild(buttonDiv);

    showSkyboxControls(currentEvnimorment.display);
    this._element.appendChild(eeDiv);
    this._updates.push((view) => {
      let skyboxEnabled = false;
      if (view.is3d()) {
        const env = (view as ViewState3d).getDisplayStyle3d().environment.sky;
        skyboxEnabled = env.display;
      }

      showSkyboxControls(skyboxEnabled);
      this.updateEnvironmentEditorUI(view);
    });
    this.addEnvAttribute(this._element, "Ground Plane", "ground");
  }

  private updateEnvironment(newEnv: SkyBoxProps): void {
    const oldEnv = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky as SkyGradient;
    newEnv = {
      display: (oldEnv as SkyBox).display,
      twoColor: undefined !== newEnv.twoColor ? newEnv.twoColor : oldEnv.twoColor,
      zenithColor: undefined !== newEnv.zenithColor ? new ColorDef(newEnv.zenithColor) : oldEnv.zenithColor,
      skyColor: undefined !== newEnv.skyColor ? new ColorDef(newEnv.skyColor) : oldEnv.skyColor,
      groundColor: undefined !== newEnv.groundColor ? new ColorDef(newEnv.groundColor) : oldEnv.groundColor,
      nadirColor: undefined !== newEnv.nadirColor ? new ColorDef(newEnv.nadirColor) : oldEnv.nadirColor,
      skyExponent: undefined !== newEnv.skyExponent ? newEnv.skyExponent : oldEnv.skyExponent,
      groundExponent: undefined !== newEnv.groundExponent ? newEnv.groundExponent : oldEnv.groundExponent,
    };
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment(
      {
        sky: new SkyGradient(newEnv),
      });
    this.sync();
  }

  private updateEnvironmentEditorUI(view: ViewState): void {
    this._eeBackgroundInput!.input.value = view.backgroundColor.toHexString();
    if (view.is2d())
      return;

    const getSkyEnvironment = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().environment.sky;
    const skyEnvironment = getSkyEnvironment(view) as SkyGradient;

    this._eeSkyboxType!.setValue(skyEnvironment.twoColor ? "2colors" : "4colors");
    this._eeZenithColor!.input.value = skyEnvironment.zenithColor.toHexString();
    this._eeSkyColor!.input.value = skyEnvironment.skyColor.toHexString();
    this._eeGroundColor!.input.value = skyEnvironment.groundColor.toHexString();
    this._eeNadirColor!.input.value = skyEnvironment.nadirColor.toHexString();
    this._eeSkyExponent!.slider.value = skyEnvironment.skyExponent!.toString();
    this._eeGroundExponent!.slider.value = skyEnvironment.groundExponent!.toString();
  }

  private resetEnvironmentEditor(): void {
    const skyEnvironment = (this._vp.view as ViewState3d).getDisplayStyle3d().environment.sky;
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment(
      {
        sky: { display: (skyEnvironment as SkyBox).display },
      });
    this.sync();
    this.updateEnvironmentEditorUI(this._vp.view);
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
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = view.viewFlags[flag];
    };

    this._updates.push(update);
  }

  private addLightingToggle(parent: HTMLElement): void {
    const elems = this.addCheckbox("Lights", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.solarLight = vf.cameraLights = vf.sourceLights = enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, parent);

    const update = (view: ViewState) => {
      const vf = view.viewFlags;
      const visible = view.is3d() && RenderMode.SmoothShade === vf.renderMode;
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = vf.solarLight || vf.cameraLights || vf.sourceLights;
    };

    this._updates.push(update);
  }

  private addCameraToggle(parent: HTMLElement): void {
    const elems = this.addCheckbox("Camera", (enabled: boolean) => {
      if (enabled)
        this._vp.turnCameraOn();
      else
        (this._vp.view as ViewState3d).turnCameraOff();

      this.sync();
    }, parent);

    const update = (view: ViewState) => {
      const visible = view.is3d() && view.allow3dManipulations();
      elems.div.style.display = visible ? "block" : "none";
      if (visible)
        elems.checkbox.checked = this._vp.isCameraOn;
    };

    this._updates.push(update);
  }

  private addEnvAttribute(parent: HTMLElement, label: string, aspect: EnvironmentAspect, updateHandler?: (enabled: boolean) => void): void {
    const elems = this.addCheckbox(label, (enabled: boolean) => {
      const view3d = this._vp.view as ViewState3d;
      const style = view3d.getDisplayStyle3d();
      const env = style.environment;
      env[aspect].display = enabled;
      view3d.getDisplayStyle3d().environment = env; // setter converts it to JSON
      if (undefined !== updateHandler)
        updateHandler(enabled);
      this.sync();
    }, parent);

    const update = (view: ViewState) => {
      const visible = view.is3d();
      elems.div.style.display = visible ? "block" : "none";
      if (visible) {
        const view3d = view as ViewState3d;
        const style = view3d.getDisplayStyle3d();
        elems.checkbox.checked = style.environment[aspect].display;
      }
    };

    this._updates.push(update);
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

  private addAmbientOcclusion(): void {
    const isAOSupported = (view: ViewState) => view.is3d() && RenderMode.SmoothShade === view.viewFlags.renderMode;
    const isAOEnabled = (view: ViewState) => view.viewFlags.ambientOcclusion;

    const div = document.createElement("div");
    div.appendChild(document.createElement("hr")!);

    const slidersDiv = document.createElement("div")!;

    const showHideDropDowns = (show: boolean) => {
      const display = show ? "block" : "none";
      slidersDiv.style.display = display;
    };

    const enableAO = (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.ambientOcclusion = enabled;
      this._vp.viewFlags = vf;
      showHideDropDowns(enabled);
      this.sync();
    };
    const checkbox = this.addCheckbox("Ambient Occlusion", enableAO, div).checkbox;

    this._aoBias = createSlider({
      parent: slidersDiv,
      name: "Bias: ",
      id: "viewAttr_AOBias",
      min: "0.0",
      step: "0.025",
      max: "1.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(parseFloat(slider.value)),
    });

    this._aoZLengthCap = createSlider({
      parent: slidersDiv,
      name: "Length Cap: ",
      id: "viewAttr_AOZLengthCap",
      min: "0.0",
      step: "0.000025",
      max: "0.25",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, parseFloat(slider.value)),
    });

    this._aoIntensity = createSlider({
      parent: slidersDiv,
      name: "Intensity: ",
      id: "viewAttr_AOIntensity",
      min: "1.0",
      step: "0.1",
      max: "16.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, parseFloat(slider.value)),
    });

    this._aoTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Step: ",
      id: "viewAttr_AOTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurDelta = createSlider({
      parent: slidersDiv,
      name: "Blur Delta: ",
      id: "viewAttr_AOBlurDelta",
      min: "0.5",
      step: "0.0001",
      max: "1.5",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurSigma = createSlider({
      parent: slidersDiv,
      name: "Blur Sigma: ",
      id: "viewAttr_AOBlurSigma",
      min: "0.5",
      step: "0.0001",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Blur Step: ",
      id: "viewAttr_AOBlurTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, undefined, undefined, parseFloat(slider.value)),
    });

    const resetButton = createButton({
      parent: slidersDiv,
      id: "viewAttr_AOReset",
      value: "Reset",
      handler: () => this.resetAmbientOcclusion(),
    });
    resetButton.div.style.textAlign = "center";

    this._updates.push((view) => {
      const visible = isAOSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isAOEnabled(view);
      showHideDropDowns(checkbox.checked);

      this.updateAmbientOcclusionUI(view);
    });

    div.appendChild(slidersDiv);

    this._element.appendChild(div);
  }

  private updateAmbientOcclusionUI(view: ViewState) {
    const getAOSettings = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings;

    const aoSettings = getAOSettings(view);

    this._aoBias!.slider.value = aoSettings.bias!.toString();
    this._aoZLengthCap!.slider.value = aoSettings.zLengthCap!.toString();
    this._aoIntensity!.slider.value = aoSettings.intensity!.toString();
    this._aoTexelStepSize!.slider.value = aoSettings.texelStepSize!.toString();
    this._aoBlurDelta!.slider.value = aoSettings.blurDelta!.toString();
    this._aoBlurSigma!.slider.value = aoSettings.blurSigma!.toString();
    this._aoBlurTexelStepSize!.slider.value = aoSettings.blurTexelStepSize!.toString();
  }

  private updateAmbientOcclusion(newBias?: number, newZLengthCap?: number, newIntensity?: number, newTexelStepSize?: number, newBlurDelta?: number, newBlurSigma?: number, newBlurTexelStepSize?: number): void {
    const oldAOSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings;
    const newAOSettings = AmbientOcclusion.Settings.fromJSON({
      bias: newBias !== undefined ? newBias : oldAOSettings.bias,
      zLengthCap: newZLengthCap !== undefined ? newZLengthCap : oldAOSettings.zLengthCap,
      intensity: newIntensity !== undefined ? newIntensity : oldAOSettings.intensity,
      texelStepSize: newTexelStepSize !== undefined ? newTexelStepSize : oldAOSettings.texelStepSize,
      blurDelta: newBlurDelta !== undefined ? newBlurDelta : oldAOSettings.blurDelta,
      blurSigma: newBlurSigma !== undefined ? newBlurSigma : oldAOSettings.blurSigma,
      blurTexelStepSize: newBlurTexelStepSize !== undefined ? newBlurTexelStepSize : oldAOSettings.blurTexelStepSize,
    });
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings = newAOSettings;
    this.sync();
  }

  private resetAmbientOcclusion(): void {
    const newAOSettings = AmbientOcclusion.Settings.defaults;
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings = newAOSettings;
    this.sync();
    this.updateAmbientOcclusionUI(this._vp.view);
  }

  private addBackgroundMap(): void {
    const isMapSupported = (view: ViewState) => view.is3d() && view.iModel.isGeoLocated;
    const getBackgroundMap = (view: ViewState) => (view as ViewState3d).getDisplayStyle3d().backgroundMap;

    const div = document.createElement("div");
    div.appendChild(document.createElement("hr")!);

    const comboBoxesDiv = document.createElement("div")!;

    const showHideDropDowns = (show: boolean) => {
      const display = show ? "block" : "none";
      comboBoxesDiv.style.display = display;
    };

    const enableMap = (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.backgroundMap = enabled;
      this._vp.viewFlags = vf;
      showHideDropDowns(enabled);
      this.sync();
    };
    const checkbox = this.addCheckbox("Background Map", enableMap, div).checkbox;

    const providers = createComboBox({
      parent: comboBoxesDiv,
      name: "Provider: ",
      id: "viewAttr_MapProvider",
      entries: [
        { name: "Bing", value: "BingProvider" },
        { name: "MapBox", value: "MapBoxProvider" },
      ],
      handler: (select) => this.updateBackgroundMap(getBackgroundMap(this._vp.view), select.value, undefined),
    }).select;

    const types = createComboBox({
      parent: comboBoxesDiv,
      name: "Type: ",
      id: "viewAttr_mapType",
      entries: [
        { name: "Street", value: BackgroundMapType.Street },
        { name: "Aerial", value: BackgroundMapType.Aerial },
        { name: "Hybrid", value: BackgroundMapType.Hybrid },
      ],
      handler: (select) => this.updateBackgroundMap(getBackgroundMap(this._vp.view), undefined, Number.parseInt(select.value, 10)),
    }).select;

    this._updates.push((view) => {
      const visible = isMapSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = view.viewFlags.backgroundMap;
      showHideDropDowns(checkbox.checked);

      const map = getBackgroundMap(view);
      providers.value = JsonUtils.asString(map.providerName, "BingProvider");
      types.value = JsonUtils.asInt(map.mapType, BackgroundMapType.Hybrid).toString();
    });

    div.appendChild(comboBoxesDiv);

    this._element.appendChild(div);
  }

  private updateBackgroundMap(map: BackgroundMapProps, newProvider?: string, newType?: BackgroundMapType): void {
    let type: BackgroundMapType | undefined;
    if (undefined !== newType)
      type = newType;
    else if (undefined !== map.providerData)
      type = map.providerData.mapType;

    if (undefined === type)
      type = BackgroundMapType.Hybrid;

    const props = {
      providerName: undefined !== newProvider ? newProvider : map.providerName,
      providerData: {
        mapType: type,
      },
    };

    (this._vp.view as ViewState3d).getDisplayStyle3d().setBackgroundMap(props);
    this.sync();
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

  private sync(): void {
    this._vp.synchWithView(true);
  }

  private get _nextId(): string {
    ++this._id;
    return "viewAttributesPanel_" + this._id;
  }
}

export class ViewAttributesPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _attributes?: ViewAttributes;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
    this.open();
  }

  public get isOpen() { return undefined !== this._attributes; }
  protected _open(): void {
    this._attributes = new ViewAttributes(this._vp, this._parent);
  }

  protected _close(): void {
    if (undefined !== this._attributes) {
      this._attributes.dispose();
      this._attributes = undefined;
    }
  }
}
