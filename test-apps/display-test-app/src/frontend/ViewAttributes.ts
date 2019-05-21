/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  JsonUtils,
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  ViewState,
  ViewState3d,
  Viewport,
  SkyGradient,
  Environment,
  SkyBox,
  DisplayStyle3dState,
  DisplayStyle2dState,
  DisplayStyleState,
} from "@bentley/imodeljs-frontend";
import {
  AmbientOcclusion,
  BackgroundMapProps,
  BackgroundMapType,
  RenderMode,
  ViewFlags,
  ColorDef,
  SkyBoxProps,
  HiddenLine,
  LinePixels,
} from "@bentley/imodeljs-common";
import { CheckBox, createCheckBox } from "./CheckBox";
import { createComboBox, ComboBox } from "./ComboBox";
import { createSlider, Slider } from "./Slider";
import { createButton } from "./Button";
import { ToolBarDropDown } from "./ToolBar";
import { createRadioBox, RadioBox } from "./RadioBox";
import { createColorInput, ColorInput, ColorInputProps } from "./ColorInput";
import { createNumericInput } from "./NumericInput";
import { Settings } from "./FeatureOverrides";
import { isString } from "util";
import { createNestedMenu } from "./NestedMenu";

type UpdateAttribute = (view: ViewState) => void;

type ViewFlag = "acsTriad" | "grid" | "fill" | "materials" | "textures" | "visibleEdges" | "hiddenEdges" | "monochrome" | "constructions" | "transparency" | "weights" | "styles" | "clipVolume" | "shadows" | "forceSurfaceDiscard";
type EnvironmentAspect = "ground" | "sky";
type SkyboxType = "2colors" | "4colors";

export class ViewAttributes {
  private static _expandViewFlags = false;
  private static _expandEdgeDisplay = false;
  private static _expandEnvironmentEditor = false;
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
  private _eeBackgroundColor?: ColorInput;

  private _displayStylePickerDiv?: HTMLDivElement;
  public set displayStylePickerInput(newComboBox: ComboBox) {
    while (this._displayStylePickerDiv!.hasChildNodes())
      this._displayStylePickerDiv!.removeChild(this._displayStylePickerDiv!.firstChild!);

    this._displayStylePickerDiv!.appendChild(newComboBox.div);
  }

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._parent = parent;
    this._element = document.createElement("div");
    this._element.className = "debugPanel"; // "toolMenu"; or set display="block"...

    this._removeMe = vp.onViewChanged.addListener((_vp) => this.update());

    this.addDisplayStylePicker();
    this.addRenderMode();
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
    this.addViewFlagAttribute(flagsDiv, "Monochrome", "monochrome");
    this.addViewFlagAttribute(flagsDiv, "Constructions", "constructions");
    this.addViewFlagAttribute(flagsDiv, "Transparency", "transparency");
    this.addViewFlagAttribute(flagsDiv, "Line Weights", "weights");
    this.addViewFlagAttribute(flagsDiv, "Line Styles", "styles");
    this.addViewFlagAttribute(flagsDiv, "Clip Volume", "clipVolume", true);
    this.addViewFlagAttribute(flagsDiv, "Force Surface Discard", "forceSurfaceDiscard", true);

    this.addShadowsToggle(flagsDiv);
    this.addLightingToggle(flagsDiv);
    this.addCameraToggle(flagsDiv);

    this.addEdgeDisplay();

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

    this._updates.push((view) => {
      if (view.is2d())
        nestedMenu.div.hidden = true;
      else
        nestedMenu.div.hidden = false;
    });

    // Create Visible Edges Checkbox
    const visEdgesCb = this.addCheckbox("Visible Edges", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.visibleEdges = enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, nestedMenu.body);
    const visEdgeDiv = this.addHiddenLineEditor(visEdgesCb, edgeDisplayDiv);

    // Create Hidden Edges Checkbox
    const hidEdgesCb = this.addCheckbox("Hidden Edges", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.hiddenEdges = enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, edgeDisplayDiv);
    hidEdgesCb.checkbox.disabled = true;
    const hidEdgeDiv = this.addHiddenLineEditor(hidEdgesCb, edgeDisplayDiv, true);
    this._updates.push((view) => {
      if (view.is3d()) {
        visEdgeDiv.hidden = !view.viewFlags.visibleEdges;
        hidEdgeDiv.hidden = !view.viewFlags.hiddenEdges;
        hidEdgesCb.checkbox.disabled = !view.viewFlags.visibleEdges;
        const visWeightChecked = (visEdgeDiv.children[2].children[0] as HTMLInputElement).checked;
        const hidWeightChecked = (hidEdgeDiv.children[2].children[0] as HTMLInputElement).checked;
        if (visWeightChecked && hidWeightChecked) {
          const visWeight = (visEdgeDiv.children[2].children[2] as HTMLInputElement).value; // visEdgeDiv.children.item(2) !== null ? visEdgeDiv.children.item(2)!.children.item(2)!.value;
          const hidWeight = (hidEdgeDiv.children[2].children[2] as HTMLInputElement).value;
          if (parseInt(hidWeight, 10) > parseInt(visWeight, 10)) {
            (hidEdgeDiv.children[2].children[2] as HTMLInputElement).value = visWeight;
          }
        } else if (!visWeightChecked && hidWeightChecked) {
          (hidEdgeDiv.children[2].children[2] as HTMLInputElement).value = "1";
        }
      }
    });
  }

  private addHiddenLineEditor(parentCb: CheckBox, parent: HTMLDivElement, hiddenEdge?: true): HTMLDivElement {
    const hlSettings = this._vp.view.is3d() ? (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings : HiddenLine.Settings.defaults;
    const hlEdgeSettings = hiddenEdge ? hlSettings.hidden : hlSettings.visible;
    const hlDiv = document.createElement("div");
    hlDiv.hidden = hiddenEdge ? !this._vp.view.viewFlags.hiddenEdges : !this._vp.view.viewFlags.visibleEdges;

    // Create transparency threshold checkbox and slider
    const transDiv = document.createElement("div");
    const transCb = document.createElement("input");
    transCb.type = "checkbox";
    transCb.id = "cb_ovrTrans";
    transDiv.appendChild(transCb);
    const label4 = document.createElement("label");
    label4.htmlFor = "cb_ovrTrans";
    label4.innerText = "Transparency Threshold ";
    transDiv.appendChild(label4);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "slider";
    slider.min = "0.0";
    slider.max = "1.0";
    slider.step = "0.05";
    slider.value = hlSettings.transparencyThreshold.toString();
    slider.disabled = true;
    transDiv.appendChild(slider);
    slider.addEventListener("input", () => {
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      this.updateEdgeDisplay(hlDiv, parseFloat(slider.value),
        colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(patternCb.select.value, 10), // oldHLEdgeSettings.pattern,
        lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    });
    transCb.addEventListener("click", () => {
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      slider.disabled = !transCb.checked;
      this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : undefined,
        colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(patternCb.select.value, 10), // oldHLEdgeSettings.pattern,
        lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    });
    hlDiv.appendChild(transDiv);
    if (hiddenEdge) {
      transDiv.hidden = true;
      transCb.hidden = true;
    }

    // Create color checkbox and color picker
    const colorDiv = document.createElement("div");
    const colorCb = document.createElement("input");
    colorCb.type = "checkbox";
    colorCb.id = "cb_ovrColor";
    colorDiv.appendChild(colorCb);
    const props: ColorInputProps = {
      parent: colorDiv,
      id: "color_ovrColor",
      label: "Color",
      value: hlEdgeSettings.color ? hlEdgeSettings.color.toHexString() : "#ffffff",
      display: "inline",
      disabled: true,
      handler: (value: string) => {
        const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
        const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
        this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
          colorCb.checked ? new ColorDef(value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
          parseInt(patternCb.select.value, 10),
          lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
          hiddenEdge);
      },
    };
    const colorInput: HTMLInputElement = createColorInput(props).input;
    colorCb.addEventListener("click", () => {
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      colorInput.disabled = !colorCb.checked;
      this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
        colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(patternCb.select.value, 10),
        lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    });
    hlDiv.appendChild(colorDiv);
    if (hiddenEdge) {
      colorDiv.hidden = true;
      colorCb.hidden = true;
    }

    // Create weight checkbox and numeric input
    const lbDiv = document.createElement("div");
    const lbCb = document.createElement("input");
    lbCb.type = "checkbox";
    lbCb.id = "cb_ovrWeight";
    lbDiv.appendChild(lbCb);
    const label = document.createElement("label");
    label.htmlFor = "cb_ovrWeight";
    label.innerText = "Weight ";
    lbDiv.appendChild(label);
    const num = createNumericInput({
      parent: lbDiv,
      value: 1,
      disabled: true,
      min: 1,
      max: 31,
      step: 1,
      handler: (value) => {
        const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
        const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
        this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
          colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
          parseInt(patternCb.select.value, 10),
          lbCb.checked ? value : oldHLEdgeSettings.width,
          hiddenEdge);
      },
    });
    lbDiv.appendChild(num);
    lbCb.addEventListener("click", () => {
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      num.disabled = !lbCb.checked;
      this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
        colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(patternCb.select.value, 10),
        lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    });
    hlDiv.appendChild(lbDiv);

    // Create style combo box
    const patternCb = Settings.addStyle(hlDiv, hlEdgeSettings.pattern ? hlEdgeSettings.pattern : LinePixels.Invalid, (select: HTMLSelectElement) => {
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      this.updateEdgeDisplay(hlDiv, transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
        colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(select.value, 10),
        lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    });
    parent.appendChild(hlDiv);

    // Add to update list
    const update = (view: ViewState) => {
      if (this._vp.view.is2d()) {
        parentCb.div.style.display = "none";
        hlDiv.hidden = true;
        return;
      }
      const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
      const oldHLEdgeSettings = hiddenEdge ? oldHLSettings.hidden : oldHLSettings.visible;
      parentCb.div.style.display = "block";
      const checked = parentCb.checkbox.checked;
      parentCb.checkbox.checked = view.viewFlags[hiddenEdge ? "hiddenEdges" : "visibleEdges"];
      this.updateEdgeDisplay(hlDiv, checked && transCb.checked ? parseFloat(slider.value) : oldHLSettings.transparencyThreshold,
        checked && colorCb.checked ? new ColorDef(colorInput.value) : (oldHLEdgeSettings.ovrColor ? oldHLEdgeSettings.color : undefined),
        parseInt(patternCb.select.value, 10), // oldHLEdgeSettings.pattern,
        checked && lbCb.checked ? (isString(num.value) ? parseInt(num.value, 10) : num.value) : oldHLEdgeSettings.width,
        hiddenEdge);
    };
    this._updates.push(update);

    return hlDiv;
  }

  private updateEdgeDisplay(parent: HTMLDivElement, transThresh?: number, color?: ColorDef, pattern?: LinePixels, width?: number, hiddenEdge?: true): void {
    const oldHLSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings;
    const newHLSettings = HiddenLine.Settings.fromJSON({
      visible: hiddenEdge ? oldHLSettings.visible : HiddenLine.Style.fromJSON({
        ovrColor: color ? true : false,
        color,
        pattern,
        width,
      }),
      hidden: !hiddenEdge ? HiddenLine.Style.fromJSON({
        ovrColor: oldHLSettings.hidden.ovrColor,
        color: oldHLSettings.hidden.color,
        pattern: oldHLSettings.hidden.pattern,
        width: (oldHLSettings.hidden.width === undefined || (width !== undefined && oldHLSettings.hidden.width <= width) ? oldHLSettings.hidden.width : width), // verify hidden width <= visible width
      }) : HiddenLine.Style.fromJSON({
        ovrColor: color ? true : false,
        color,
        pattern,
        width: (width === undefined || (oldHLSettings.visible.width !== undefined && width <= oldHLSettings.visible.width) ? width : oldHLSettings.visible.width), // verify hidden width <= visible width
      }, true),
      transThreshold: transThresh,
    });
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.hiddenLineSettings = newHLSettings;
    this.sync();
    parent.hidden = hiddenEdge ? !this._vp.view.viewFlags.hiddenEdges : !this._vp.view.viewFlags.visibleEdges;
  }

  private addDisplayStylePicker(): void {
    this._displayStylePickerDiv = document.createElement("div");
    this._element.appendChild(this._displayStylePickerDiv);
  }

  private addEnvironmentEditor() {
    const nestedMenu = createNestedMenu({
      id: this._nextId,
      label: "Environment",
      parent: this._element,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      expand: ViewAttributes._expandEnvironmentEditor,
      handler: (expanded) => ViewAttributes._expandEnvironmentEditor = expanded,
    }).body;
    const is3d = this._vp.view.is3d();

    this._eeBackgroundColor = createColorInput({
      parent: nestedMenu,
      value: this._vp.view.backgroundColor.toHexString(),
      handler: (value) => {
        this._vp.view.displayStyle.backgroundColor = new ColorDef(value);
        this.sync();
      },
      id: this._nextId,
      label: "Background Color",
      display: is3d ? "none" : "block",
    });
    this._eeBackgroundColor.div.style.textAlign = "right";

    this._vp.onDisplayStyleChanged.addListener((vp) => {
      this.updateEnvironmentEditorUI(vp.view);
    });

    let currentEnvironment: SkyGradient | undefined;
    const eeDiv = document.createElement("div");
    if (this._vp.view.is3d()) {
      const env = this._vp.view.getDisplayStyle3d().environment.sky;

      // Could be a SkySphere, SkyCube, etc...we currently only support editing a SkyGradient.
      if (env instanceof SkyGradient)
        currentEnvironment = env;
    }

    eeDiv.hidden = undefined !== currentEnvironment && !currentEnvironment.display;

    const showSkyboxControls = (enabled: boolean) => {
      eeDiv.hidden = !enabled;
      this._eeBackgroundColor!.div.style.display = enabled ? "none" : "block";
    };

    this.addEnvAttribute(nestedMenu, "Sky Box", "sky", showSkyboxControls);

    nestedMenu.appendChild(this._eeBackgroundColor.div);

    this._eeSkyboxType = createRadioBox({
      id: this._nextId,
      entries: [
        { value: "2colors", label: "2 Colors" },
        { value: "4colors", label: "4 Colors" },
      ],
      handler: (value) => {
        this.updateEnvironment({ twoColor: value === "2colors" });

        // Hide elements not relevant to 2 colors
        const twoColors = value !== "4colors";
        this._eeSkyColor!.div.hidden = twoColors;
        this._eeGroundColor!.div.hidden = twoColors;
        this._eeSkyExponent!.div.style.display = twoColors ? "none" : "block";
        this._eeGroundExponent!.div.style.display = twoColors ? "none" : "block";
      },
      parent: eeDiv,
      defaultValue: (undefined !== currentEnvironment && currentEnvironment.twoColor) ? "2colors" : "4colors",
    });

    const row1 = document.createElement("div");
    eeDiv.appendChild(row1);
    row1.style.display = "flex";
    row1.style.justifyContent = "flex-end";

    this._eeSkyColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ skyColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.skyColor.toHexString(),
      label: "Sky Color",
      parent: row1,
    });
    this._eeSkyColor.div.style.marginRight = "10px";

    this._eeZenithColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ zenithColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.zenithColor.toHexString(),
      label: "Zenith Color",
      parent: row1,
    });

    const row2 = document.createElement("div");
    eeDiv.appendChild(row2);
    row2.style.display = "flex";
    row2.style.justifyContent = "flex-end";

    this._eeGroundColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ groundColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.groundColor.toHexString(),
      label: "Ground Color",
      parent: row2,
    });
    this._eeGroundColor.div.style.marginRight = "16px";

    this._eeNadirColor = createColorInput({
      handler: (value: string) => this.updateEnvironment({ nadirColor: new ColorDef(value) }),
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.nadirColor.toHexString(),
      label: "Nadir Color",
      parent: row2,
    });

    this._eeSkyExponent = createSlider({
      parent: eeDiv,
      name: "Sky Exponent",
      id: this._nextId,
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.skyExponent.toString(),
      handler: (slider) => this.updateEnvironment({ skyExponent: parseFloat(slider.value) }),
    });

    this._eeGroundExponent = createSlider({
      parent: eeDiv,
      name: "Ground Exponent",
      id: this._nextId,
      min: "0.0",
      step: "0.25",
      max: "20.0",
      value: undefined === currentEnvironment ? "#FFFFFF" : currentEnvironment.groundExponent.toString(),
      handler: (slider) => this.updateEnvironment({ groundExponent: parseFloat(slider.value) }),
    });

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

    showSkyboxControls(undefined !== currentEnvironment && currentEnvironment.display);
    nestedMenu.appendChild(eeDiv);
    this._updates.push((view) => {
      let skyboxEnabled = false;
      if (view.is3d()) {
        const env = (view as ViewState3d).getDisplayStyle3d().environment.sky;
        skyboxEnabled = env.display;
      }

      showSkyboxControls(skyboxEnabled);
      this.updateEnvironmentEditorUI(view);
    });
    this.addEnvAttribute(nestedMenu, "Ground Plane", "ground");
  }

  private updateEnvironment(newEnv: SkyBoxProps): void {
    const oldEnv = (this._vp.view as ViewState3d).getDisplayStyle3d().environment;
    const oldSkyEnv = oldEnv.sky as SkyGradient;
    newEnv = {
      display: (oldSkyEnv as SkyBox).display,
      twoColor: undefined !== newEnv.twoColor ? newEnv.twoColor : oldSkyEnv.twoColor,
      zenithColor: undefined !== newEnv.zenithColor ? new ColorDef(newEnv.zenithColor) : oldSkyEnv.zenithColor,
      skyColor: undefined !== newEnv.skyColor ? new ColorDef(newEnv.skyColor) : oldSkyEnv.skyColor,
      groundColor: undefined !== newEnv.groundColor ? new ColorDef(newEnv.groundColor) : oldSkyEnv.groundColor,
      nadirColor: undefined !== newEnv.nadirColor ? new ColorDef(newEnv.nadirColor) : oldSkyEnv.nadirColor,
      skyExponent: undefined !== newEnv.skyExponent ? newEnv.skyExponent : oldSkyEnv.skyExponent,
      groundExponent: undefined !== newEnv.groundExponent ? newEnv.groundExponent : oldSkyEnv.groundExponent,
    };
    (this._vp.view as ViewState3d).getDisplayStyle3d().environment = new Environment(
      {
        sky: new SkyGradient(newEnv),
        ground: oldEnv.ground,
      });
    this.sync();
  }

  private updateEnvironmentEditorUI(view: ViewState): void {
    this._eeBackgroundColor!.input.value = view.backgroundColor.toHexString();
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

  private addShadowsToggle(parent: HTMLElement): void {
    let currentColor: ColorDef | undefined;
    if (this._vp.view.is3d())
      currentColor = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.solarShadowsSettings.color;

    const shadowsColorInput = createColorInput({
      label: "Shadow Color",
      id: this._nextId,
      parent,
      display: "inline",
      value: undefined === currentColor ? "#FFFFFF" : currentColor.toHexString(),
      handler: (color) => {
        (this._vp.view as ViewState3d).getDisplayStyle3d().settings.solarShadowsSettings.color = new ColorDef(color);
        this.sync();
      },
    });
    shadowsColorInput.div.style.cssFloat = "right";

    const elems = this.addCheckbox("Shadows", (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.shadows = enabled;
      this._vp.viewFlags = vf;
      this.sync();
    }, parent);

    const updateUI = (view: ViewState) => {
      if (view.is3d())
        currentColor = (view as ViewState3d).getDisplayStyle3d().settings.solarShadowsSettings.color;
      shadowsColorInput.input.value = undefined === currentColor ? "#FFFFFF" : currentColor.toHexString();
    };

    const update = (view: ViewState) => {
      const vf = view.viewFlags;
      const visible = view.is3d();
      elems.div.style.display = visible ? "block" : "none";
      shadowsColorInput.div.style.display = (visible && vf.shadows) ? "inline" : "none";
      updateUI(view);
      if (visible)
        elems.checkbox.checked = vf.shadows;
    };

    this._vp.onDisplayStyleChanged.addListener((vp) => updateUI(vp.view));

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
  private _displayStylePickerInput?: ComboBox;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
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

      // ###TODO: Is there such a concept as "2d reality models"???
      promises.push(displayStyle.loadContextRealityModels());
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
    this._attributes = new ViewAttributes(this._vp, this._parent);
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
