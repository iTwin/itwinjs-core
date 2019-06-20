/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Id64String,
} from "@bentley/bentleyjs-core";
import {
  ViewState,
  ViewState3d,
  Viewport,
  DisplayStyle3dState,
  DisplayStyle2dState,
  DisplayStyleState,
} from "@bentley/imodeljs-frontend";
import {
  BackgroundMapProps,
  BackgroundMapProviderName,
  BackgroundMapType,
  RenderMode,
  ViewFlags,
  ColorDef,
  HiddenLine,
  LinePixels,
} from "@bentley/imodeljs-common";
import {
  CheckBox,
  createCheckBox,
  ComboBox,
  createComboBox,
  createColorInput,
  ColorInputProps,
  createNestedMenu,
  createNumericInput,
 } from "@bentley/frontend-devtools";
import { ToolBarDropDown } from "./ToolBar";
import { Settings } from "./FeatureOverrides";
import { isString } from "util";
import { AmbientOcclusionEditor } from "./AmbientOcclusion";
import { EnvironmentEditor } from "./EnvironmentEditor";

type UpdateAttribute = (view: ViewState) => void;

type ViewFlag = "acsTriad" | "grid" | "fill" | "materials" | "textures" | "visibleEdges" | "hiddenEdges" | "monochrome" | "constructions" | "transparency" | "weights" | "styles" | "clipVolume" | "shadows" | "forceSurfaceDiscard";

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
    const ao = new AmbientOcclusionEditor(this._vp, this._element);
    this._updates.push((view) => ao.update(view));
  }

  private addBackgroundMap(): void {
    const isMapSupported = (view: ViewState) => view.is3d() && view.iModel.isGeoLocated;
    const getBackgroundMap = (view: ViewState) => view.displayStyle.settings.backgroundMap;

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
      handler: (select) => this.updateBackgroundMap({ providerName: select.value as BackgroundMapProviderName }),
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
      handler: (select) => this.updateBackgroundMap({ providerData: { mapType: Number.parseInt(select.value, 10) } }),
    }).select;

    const groundBiasDiv = document.createElement("div") as HTMLDivElement;
    const groundBiasLabel = document.createElement("label") as HTMLLabelElement;
    groundBiasLabel.style.display = "inline";
    groundBiasLabel.htmlFor = "ts_viewToolPickRadiusInches";
    groundBiasLabel.innerText = "Ground Bias: ";
    groundBiasDiv.appendChild(groundBiasLabel);
    const groundBias = createNumericInput({
      parent: groundBiasDiv,
      value: getBackgroundMap(this._vp.view).groundBias,
      handler: (value) => this.updateBackgroundMap({ groundBias: value }),
    }, true);
    groundBiasDiv.style.display = "block";
    groundBiasDiv.style.textAlign = "left";
    comboBoxesDiv.appendChild(groundBiasDiv);

    this._updates.push((view) => {
      const visible = isMapSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = view.viewFlags.backgroundMap;
      showHideDropDowns(checkbox.checked);

      const map = getBackgroundMap(view);
      providers.value = map.providerName;
      types.value = map.mapType.toString();
      groundBias.value = map.groundBias.toString();
    });

    div.appendChild(comboBoxesDiv);

    this._element.appendChild(div);
  }

  private updateBackgroundMap(props: BackgroundMapProps): void {
    this._vp.changeBackgroundMapProps(props);
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
