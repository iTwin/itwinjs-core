/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, Id64String, IDisposable } from "@itwin/core-bentley";
import {
  ComboBox, ComboBoxHandler, convertHexToRgb, createButton, createCheckBox, createColorInput, createComboBox, createNumericInput,
} from "@itwin/frontend-devtools";
import { FeatureAppearance, FeatureAppearanceProps, LinePixels } from "@itwin/core-common";
import { FeatureOverrideProvider, FeatureSymbology, Viewport } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

export class Provider implements FeatureOverrideProvider {
  private readonly _elementOvrs = new Map<Id64String, FeatureAppearance>();
  private _defaultOvrs: FeatureAppearance | undefined;
  private readonly _vp: Viewport;

  private constructor(vp: Viewport) { this._vp = vp; }

  public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _vp: Viewport): void {
    this._elementOvrs.forEach((appearance, elementId) => ovrs.override({ elementId, appearance }));
    if (undefined !== this._defaultOvrs)
      ovrs.setDefaultOverrides(this._defaultOvrs);
  }

  public overrideElements(app: FeatureAppearance): void {
    for (const id of this._vp.iModel.selectionSet.elements)
      this._elementOvrs.set(id, app);

    this.sync();
  }

  public overrideElementsByArray(elementOvrs: any[]): void {
    elementOvrs.forEach((eo) => {
      const fsa = FeatureAppearance.fromJSON(JSON.parse(eo.fsa) as FeatureAppearanceProps);
      if (eo.id === "-default-")
        this.defaults = fsa;
      else
        this._elementOvrs.set(eo.id, fsa);
    });

    this.sync();
  }

  public toJSON(): any[] | undefined {
    if (0 === this._elementOvrs.size && undefined === this._defaultOvrs)
      return undefined;

    const elementOvrs: any[] = [];
    this._elementOvrs.forEach((value, key) => {
      const elem = { id: key, fsa: JSON.stringify(value.toJSON()) };
      elementOvrs.push(elem);
    });

    // Put the default override into the array as well, at the end with a special ID that we can find later.
    if (undefined !== this._defaultOvrs) {
      const elem = { id: "-default-", fsa: JSON.stringify(this._defaultOvrs.toJSON()) };
      elementOvrs.push(elem);
    }

    return elementOvrs;
  }

  public clear(): void {
    this._elementOvrs.clear();
    this._defaultOvrs = undefined;
    this.sync();
  }

  public set defaults(value: FeatureAppearance | undefined) {
    this._defaultOvrs = value;
    this.sync();
  }

  private sync(): void { this._vp.setFeatureOverrideProviderChanged(); }

  public static get(vp: Viewport): Provider | undefined {
    return vp.findFeatureOverrideProvider((x) => x instanceof Provider) as Provider | undefined;
  }

  public static remove(vp: Viewport): void {
    const provider = this.get(vp);
    if (provider)
      vp.dropFeatureOverrideProvider(provider);
  }

  public static getOrCreate(vp: Viewport): Provider {
    let provider = this.get(vp);
    if (undefined === provider) {
      provider = new Provider(vp);
      vp.addFeatureOverrideProvider(provider);
    }

    return provider;
  }
}

export class Settings implements IDisposable {
  private _appearance = FeatureAppearance.defaults;
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.cssFloat = "left";
    this._element.style.display = "block";

    this.addColors(this._element);
    this.addTransparencies(this._element);
    Settings.addStyle(this._element, LinePixels.Invalid, (select: HTMLSelectElement) => this.updateStyle(parseInt(select.value, 10)));
    this.addWeight(this._element);

    createCheckBox({
      parent: this._element,
      name: "Ignore Material",
      id: "ovr_ignoreMaterial",
      handler: (cb) => this.updateIgnoreMaterial(cb.checked ? true : undefined),
    });

    createCheckBox({
      parent: this._element,
      name: "Non-locatable",
      id: "ovr_nonLocatable",
      handler: (cb) => this.updateNonLocatable(cb.checked ? true : undefined),
    });

    createCheckBox({
      parent: this._element,
      name: "Emphasized",
      id: "ovr_emphasized",
      handler: (cb) => this.updateAppearance("emphasized", cb.checked ? true : undefined),
    });

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Apply",
      handler: () => this._provider.overrideElements(this._appearance),
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply overrides to selection set",
    });
    createButton({
      value: "Default",
      handler: () => this._provider.defaults = this._appearance,
      parent: buttonDiv,
      inline: true,
      tooltip: "Set as default overrides",
    });
    createButton({
      value: "Clear",
      handler: () => this._provider.clear(),
      parent: buttonDiv,
      inline: true,
      tooltip: "Remove all overrides",
    });

    this._element.appendChild(document.createElement("hr"));
    this._element.appendChild(buttonDiv);

    parent.appendChild(this._element);
  }

  public dispose(): void {
    this._parent.removeChild(this._element);
  }

  private get _provider() { return Provider.getOrCreate(this._vp); }

  // private reset() { this._appearance = FeatureSymbology.Appearance.defaults; }

  private updateAppearance(field: "rgb" | "transparency" | "lineRgb" | "lineTransparency" | "linePixels" | "weight" | "ignoresMaterial" | "nonLocatable" | "emphasized" | "viewDependentTransparency", value: any): void {
    const props = this._appearance.toJSON();
    props[field] = value;
    this._appearance = FeatureAppearance.fromJSON(props);
  }

  private updateWeight(weight: number | undefined): void { this.updateAppearance("weight", weight); }
  private updateIgnoreMaterial(ignoresMaterial: true | undefined): void { this.updateAppearance("ignoresMaterial", ignoresMaterial); }
  private updateNonLocatable(nonLocatable: true | undefined): void { this.updateAppearance("nonLocatable", nonLocatable); }
  private updateStyle(style: LinePixels): void {
    const linePixels = LinePixels.Invalid !== style ? style : undefined;
    this.updateAppearance("linePixels", linePixels);
  }

  private addTransparencies(parent: HTMLElement): void {
    const addTransparency = (name: string) => {
      const div = document.createElement("div");
      parent.appendChild(div);

      const cb = createCheckBox({
        parent: div,
        name,
        id: "whatever...",
        handler: () => {
          input.disabled = !cb.checkbox.checked;
          if (cb.checkbox.checked) {
            applyToLineCb.disabled = lineTransElem.checkbox.checked;
          } else {
            applyToLineCb.disabled = true;
            applyToLineCb.checked = false;
          }

          updateTransparencies();
        },
      });

      const input = createNumericInput({
        parent: cb.div,
        display: "inline",
        value: 0,
        disabled: true,
        min: 0,
        max: 255,
        step: 1,
        handler: () => updateTransparencies(),
      });

      return { checkbox: cb.checkbox, input };
    };

    const transElem = addTransparency("Transp ");

    const applyToLineCb = createCheckBox({
      parent,
      id: "ugh",
      name: "Apply to lines",
      handler: () => {
        if (applyToLineCb.checked) {
          lineTransElem.checkbox.disabled = false;
        } else {
          lineTransElem.checkbox.disabled = true;
          lineTransElem.checkbox.checked = false;
        }

        updateTransparencies();
      },
    }).checkbox;
    applyToLineCb.disabled = true;

    const lineTransElem = addTransparency("Line Transp ");
    lineTransElem.checkbox.addEventListener("click", () => {
      if (!lineTransElem.checkbox.checked) {
        applyToLineCb.disabled = !transElem.checkbox.checked;
      } else {
        applyToLineCb.disabled = true;
        applyToLineCb.checked = false;
      }
    });

    createCheckBox({
      parent: this._element,
      name: "View-dependent",
      id: "ovr_viewDep",
      handler: (cb) => this.updateAppearance("viewDependentTransparency", cb.checked ? true : undefined),
    });

    parent.appendChild(document.createElement("hr"));

    const updateTransparencies = () => {
      const trans = transElem.checkbox.checked ? parseInt(transElem.input.value, 10) / 255 : undefined;
      let lineTrans;
      if (!applyToLineCb.checked) {
        lineTrans = lineTransElem.checkbox.checked ? parseInt(lineTransElem.input.value, 10) / 255 : false;
      }

      this.updateAppearance("transparency", trans);
      this.updateAppearance("lineTransparency", lineTrans);
    };
  }

  private addWeight(parent: HTMLElement): void {
    const div = document.createElement("div");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "cb_ovrWeight";
    div.appendChild(cb);

    const label = document.createElement("label");
    label.htmlFor = "cb_ovrWeight";
    label.innerText = "Weight ";
    div.appendChild(label);

    const num = createNumericInput({
      parent: div,
      value: 1,
      disabled: true,
      min: 1,
      max: 31,
      step: 1,
      handler: (value) => this.updateWeight(value),
    });
    div.appendChild(num);

    cb.addEventListener("click", () => {
      num.disabled = !cb.checked;
      this.updateWeight(cb.checked ? parseInt(num.value, 10) : undefined);
    });

    parent.appendChild(div);
  }

  public static addStyle(parent: HTMLElement, value: LinePixels, handler: ComboBoxHandler): ComboBox {
    const entries = [
      { name: "Not overridden", value: LinePixels.Invalid },
      { name: "Solid", value: LinePixels.Solid },
      { name: "Hidden Line", value: LinePixels.HiddenLine },
      { name: "Invisible", value: LinePixels.Invisible },
      { name: "Code1", value: LinePixels.Code1 },
      { name: "Code2", value: LinePixels.Code2 },
      { name: "Code3", value: LinePixels.Code3 },
      { name: "Code4", value: LinePixels.Code4 },
      { name: "Code5", value: LinePixels.Code5 },
      { name: "Code6", value: LinePixels.Code6 },
      { name: "Code7", value: LinePixels.Code7 },
    ];

    return createComboBox({
      parent,
      entries,
      id: "ovr_Style",
      name: "Style ",
      value,
      handler,
    });
  }

  private addColors(parent: HTMLElement): void {
    const addColorPicker = (label: string) => {
      const div = document.createElement("div");
      parent.appendChild(div);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      div.appendChild(checkbox);

      const picker = createColorInput({
        parent: div,
        label,
        value: "#ffffff",
        display: "inline",
        disabled: true,
        handler: () => updateColors(),
      });

      checkbox.addEventListener("click", () => {
        picker.input.disabled = !checkbox.checked;

        if (checkbox.checked) {
          applyToLineCb.checkbox.disabled = lineColorElem.checkbox.checked;
        } else {
          applyToLineCb.checkbox.disabled = true;
          applyToLineCb.checkbox.checked = false;
        }

        updateColors();
      });

      return { checkbox, picker };
    };

    const colorElem = addColorPicker("Color");

    const applyToLineCb = createCheckBox({
      parent,
      id: "why is this required...",
      name: "Apply to lines",
      handler: () => {
        if (applyToLineCb.checkbox.checked) {
          lineColorElem.checkbox.disabled = false;
        } else {
          lineColorElem.checkbox.disabled = true;
          lineColorElem.checkbox.checked = false;
        }

        updateColors();
      },
    });
    applyToLineCb.checkbox.disabled = true;

    const lineColorElem = addColorPicker("Line Color");
    lineColorElem.checkbox.addEventListener("click", () => {
      if (!lineColorElem.checkbox.checked) {
        applyToLineCb.checkbox.disabled = !colorElem.checkbox.checked;
      } else {
        applyToLineCb.checkbox.disabled = true;
        applyToLineCb.checkbox.checked = false;
      }
    });

    parent.appendChild(document.createElement("hr"));

    const updateColors = () => {
      const color = colorElem.checkbox.checked ? convertHexToRgb(colorElem.picker.input.value) : undefined;
      let lineColor;
      if (!applyToLineCb.checkbox.checked) {
        lineColor = lineColorElem.checkbox.checked ? convertHexToRgb(lineColorElem.picker.input.value) : false;
      }

      this.updateAppearance("rgb", color);
      this.updateAppearance("lineRgb", lineColor);
    };
  }
}

export class FeatureOverridesPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _settings?: Settings;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
    this.open();
  }

  public override get onViewChanged(): Promise<void> {
    Provider.remove(this._vp);
    return Promise.resolve();
  }

  protected _open(): void { this._settings = new Settings(this._vp, this._parent); }
  protected _close(): void { this._settings = dispose(this._settings); }
  public get isOpen(): boolean { return undefined !== this._settings; }
}
