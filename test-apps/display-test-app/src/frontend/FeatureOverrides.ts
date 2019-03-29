/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  dispose,
  Id64String,
  IDisposable,
} from "@bentley/bentleyjs-core";
import {
  ColorByName,
  ColorDef,
  LinePixels,
  RgbColor,
} from "@bentley/imodeljs-common";
import {
  EmphasizeElements,
  FeatureOverrideProvider,
  FeatureSymbology,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { ToolBarDropDown } from "./ToolBar";
import { createButton } from "./Button";
import { createNumericInput } from "./NumericInput";
import { createCheckBox } from "./CheckBox";
import { createComboBox } from "./ComboBox";
import { createColorInput, convertHexToRgb, ColorInputProps } from "./ColorInput";

export function emphasizeSelectedElements(vp: Viewport): void {
  const emph = EmphasizeElements.getOrCreate(vp);
  if (emph.overrideSelectedElements(vp, new ColorDef(ColorByName.orange), undefined, true, false) // replace existing; don't clear selection set...
    && emph.emphasizeSelectedElements(vp, undefined, true)) { // ...replace existing; now clear selection set
    vp.isFadeOutActive = true;
  } else {
    EmphasizeElements.clear(vp); // clear any previous overrides
    vp.isFadeOutActive = false;
  }
}

export class Provider implements FeatureOverrideProvider {
  private readonly _elementOvrs = new Map<Id64String, FeatureSymbology.Appearance>();
  private _defaultOvrs: FeatureSymbology.Appearance | undefined;
  private readonly _vp: Viewport;

  private constructor(vp: Viewport) { this._vp = vp; }

  public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _vp: Viewport): void {
    this._elementOvrs.forEach((value, key) => ovrs.overrideElement(key, value));
    if (undefined !== this._defaultOvrs)
      ovrs.setDefaultOverrides(this._defaultOvrs);
  }

  public overrideElements(app: FeatureSymbology.Appearance): void {
    for (const id of this._vp.iModel.selectionSet.elements)
      this._elementOvrs.set(id, app);

    this.sync();
  }

  public clear(): void {
    this._elementOvrs.clear();
    this._defaultOvrs = undefined;
    this.sync();
  }

  public set defaults(value: FeatureSymbology.Appearance | undefined) {
    this._defaultOvrs = value;
    this.sync();
  }

  private sync(): void { this._vp.view.setFeatureOverridesDirty(); }

  public static get(vp: Viewport): Provider | undefined {
    return vp.featureOverrideProvider instanceof Provider ? vp.featureOverrideProvider : undefined;
  }

  public static remove(vp: Viewport): void {
    if (undefined !== this.get(vp))
      vp.featureOverrideProvider = undefined;
  }

  public static getOrCreate(vp: Viewport): Provider {
    let provider = this.get(vp);
    if (undefined === provider) {
      provider = new Provider(vp);
      vp.featureOverrideProvider = provider;
    }

    return provider;
  }
}

export class Settings implements IDisposable {
  private _appearance = FeatureSymbology.Appearance.defaults;
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

    this.addColor(this._element);
    this.addTransparency(this._element);
    this.addWeight(this._element);
    this.addStyle(this._element);

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

  private updateAppearance(field: "rgb" | "transparency" | "linePixels" | "weight" | "ignoresMaterial" | "nonLocatable", value: any): void {
    const props = this._appearance.toJSON();
    props[field] = value;
    this._appearance = FeatureSymbology.Appearance.fromJSON(props);
  }

  private updateColor(rgb: RgbColor | undefined): void { this.updateAppearance("rgb", rgb); }
  private updateTransparency(transparency: number | undefined): void { this.updateAppearance("transparency", transparency); }
  private updateWeight(weight: number | undefined): void { this.updateAppearance("weight", weight); }
  private updateIgnoreMaterial(ignoresMaterial: true | undefined): void { this.updateAppearance("ignoresMaterial", ignoresMaterial); }
  private updateNonLocatable(nonLocatable: true | undefined): void { this.updateAppearance("nonLocatable", nonLocatable); }
  private updateStyle(style: LinePixels): void {
    const linePixels = LinePixels.Invalid !== style ? style : undefined;
    this.updateAppearance("linePixels", linePixels);
  }

  private addTransparency(parent: HTMLElement): void {
    const div = document.createElement("div");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "cb_ovrTrans";
    div.appendChild(cb);

    const label = document.createElement("label");
    label.htmlFor = "cb_ovrTrans";
    label.innerText = "Transparency ";
    div.appendChild(label);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "slider";
    slider.min = "0.0";
    slider.max = "1.0";
    slider.step = "0.05";
    slider.value = "0.0";
    slider.disabled = true;
    div.appendChild(slider);

    slider.addEventListener("input", () => this.updateTransparency(parseFloat(slider.value)));
    cb.addEventListener("click", () => {
      slider.disabled = !cb.checked;
      this.updateTransparency(cb.checked ? parseFloat(slider.value) : undefined);
    });

    parent.appendChild(div);
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

  private addStyle(parent: HTMLElement): void {
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

    createComboBox({
      parent,
      entries,
      id: "ovr_Style",
      name: "Style ",
      value: LinePixels.Invalid,
      handler: (select) => this.updateStyle(parseInt(select.value, 10)),
    });
  }

  private addColor(parent: HTMLElement): void {
    const div = document.createElement("div");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "cb_ovrColor";
    div.appendChild(cb);

    const update = () => this.updateColor(convertHexToRgb(input.value));
    const props: ColorInputProps = {
      parent: div,
      id: "color_ovrColor",
      label: "Color",
      value: "#ffffff",
      display: "inline",
      disabled: true,
      handler: update,
    };
    const input: HTMLInputElement = createColorInput(props).input;

    cb.addEventListener("click", () => {
      input.disabled = !cb.checked;

      if (cb.checked)
        update();
      else
        this.updateColor(undefined);
    });
    parent.appendChild(div);
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

  public get onViewChanged(): Promise<void> {
    Provider.remove(this._vp);
    return Promise.resolve();
  }

  protected _open(): void { this._settings = new Settings(this._vp, this._parent); }
  protected _close(): void { this._settings = dispose(this._settings); }
  public get isOpen(): boolean { return undefined !== this._settings; }
}
