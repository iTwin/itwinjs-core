/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, IDisposable } from "@itwin/core-bentley";
import {
  ColorInputProps, ComboBox, ComboBoxHandler, convertHexToRgb, createButton, createColorInput, createComboBox, createNumericInput,
  createTextBox,
} from "@itwin/frontend-devtools";
import { LinePixels, RgbColor } from "@itwin/core-common";
import { Viewport } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

export class CivilContoursSettings implements IDisposable {
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

    createTextBox({
      label: "Subcategory Ids: ",
      id: `contours_subCatIds`,
      parent: this._element,
      tooltip: "Enter comma-separated list of Subcategory Ids to associate this contour styling with",
      inline: true,
    });

    this.addColor(this._element);
    this.addWeight(this._element);
    CivilContoursSettings.addStyle(this._element, LinePixels.Invalid, (select: HTMLSelectElement) => this.updateStyle(parseInt(select.value, 10)));

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Apply",
      handler: () => { /* DO SOMETHING */ },
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply contour settings to specified subcategories",
    });
    createButton({
      value: "Clear",
      handler: () => { /* DO SOMETHING */ },
      parent: buttonDiv,
      inline: true,
      tooltip: "Remove all contour settings",
    });

    this._element.appendChild(document.createElement("hr"));
    this._element.appendChild(buttonDiv);

    parent.appendChild(this._element);
  }

  public dispose(): void {
    this._parent.removeChild(this._element);
  }

  private updateColor(_rgb: RgbColor | undefined): void { }
  private updateWeight(_weight: number | undefined): void {  }
  private updateStyle(_style: LinePixels): void {
    // const linePixels = LinePixels.Invalid !== style ? style : undefined;
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

export class CivilContoursPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _settings?: CivilContoursSettings;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
    this.open();
  }

  public override get onViewChanged(): Promise<void> {
    return Promise.resolve();
  }

  protected _open(): void { this._settings = new CivilContoursSettings(this._vp, this._parent); }
  protected _close(): void { this._settings = dispose(this._settings); }
  public get isOpen(): boolean { return undefined !== this._settings; }
}
