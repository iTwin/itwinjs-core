/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, IDisposable } from "@itwin/core-bentley";
import {
  ColorInputProps, ComboBox, ComboBoxHandler, convertHexToRgb, createButton, createColorInput, createComboBox, createNumericInput,
  createSlider, createTextBox, Slider,
} from "@itwin/frontend-devtools";
import { LinePixels, RgbColor } from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";
// import { CivilContourDisplay, CivilContourDisplayProps } from "@itwin/core-common/lib/cjs/CivilContourDisplay";

// size of widget or panel
const winSize = { top: 0, left: 0, width: 311, height: 300 };
const indent1 = "5px";
const bottomSpace1 = "3px";
const bottomSpace2 = "5px";

export class CivilContoursSettings implements IDisposable {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.overflowX = "none";
    this._element.style.overflowY = "none";
    const width = winSize.width * 0.98;
    this._element.style.width = `${width}px`;

    const tb = createTextBox({
      label: "Subcategory Ids: ",
      id: `contours_subCatIds`,
      parent: this._element,
      tooltip: "Enter comma-separated list of Subcategory Ids to associate this contour styling with",
      inline: true,
    });
    tb.textbox.style.marginBottom = bottomSpace1;
    tb.label!.style.fontWeight = "bold";

    const hr1 = document.createElement("hr");
    hr1.style.borderColor = "grey";
    this._element.appendChild(hr1);
    const label1 = document.createElement("label");
    label1.innerText = "Major Contours";
    label1.style.display = "inline";
    label1.style.fontWeight = "bold";
    this._element.appendChild(label1);

    this.addInterval(this._element, true);
    this.addColor(this._element, true);
    this.addWeight(this._element, true);
    const cb = CivilContoursSettings.addStyle(this._element, LinePixels.Solid, (select: HTMLSelectElement) => this.updateStyle(parseInt(select.value, 10), true), true);
    cb.div.style.marginBottom = bottomSpace2;

    const hr2 = document.createElement("hr");
    hr2.style.borderColor = "grey";
    this._element.appendChild(hr2);
    const label2 = document.createElement("label");
    label2.innerText = "Minor Contours";
    label2.style.fontWeight = "bold";
    label2.style.display = "inline";
    this._element.appendChild(label2);

    this.addInterval(this._element, false);
    this.addColor(this._element, false);
    this.addWeight(this._element, false);
    const cb2 = CivilContoursSettings.addStyle(this._element, LinePixels.Solid, (select: HTMLSelectElement) => this.updateStyle(parseInt(select.value, 10), false), false);
    cb2.div.style.marginBottom = bottomSpace2;

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

    const hr3 = document.createElement("hr");
    this._element.appendChild(hr3);
    hr3.style.borderColor = "grey";

    this._element.appendChild(buttonDiv);

    parent.appendChild(this._element);
  }

  public dispose(): void {
    this._parent.removeChild(this._element);
  }

  private updateInterval(_weight: number | undefined, _major: boolean): void {  }
  private updateColor(_rgb: RgbColor | undefined, _major: boolean): void { }
  private updateWeight(_weight: number | undefined, _major: boolean): void {  }
  private updateStyle(_style: LinePixels, _major: boolean): void {
    // const linePixels = LinePixels.Invalid !== style ? style : undefined;
  }

  private addInterval(parent: HTMLElement, major: boolean): void {
    const div = document.createElement("div");

    const label = document.createElement("label");
    label.htmlFor = major ? "major_interval" : "minor_interval";
    label.innerText = "Interval ";
    div.appendChild(label);

    const num = createNumericInput({
      parent: div,
      value: major ? 100 : 50,
      disabled: false,
      min: 1,
      // max: 31,
      step: 1,
      handler: (value) => this.updateInterval(value, major),
    });
    div.appendChild(num);
    parent.appendChild(div);
    div.style.marginLeft = indent1;
  }

  private addColor(parent: HTMLElement, major: boolean): void {
    const div = document.createElement("div");

    const update = () => this.updateColor(convertHexToRgb(input.value), major);
    const props: ColorInputProps = {
      parent: div,
      id: major ? "major_color" : "minor_color",
      label: "Color",
      value: "#000000",
      display: "inline",
      disabled: false,
      handler: update,
    };
    const input: HTMLInputElement = createColorInput(props).input;

    parent.appendChild(div);
    div.style.marginLeft = indent1;
    div.style.marginTop = indent1;
    div.style.marginBottom = indent1;
  }

  private addWeight(parent1: HTMLElement, major: boolean): Slider {
    const weightSlider = createSlider({
      name: " Weight ", id: major ? "major_weight" : "minor_weight", parent: parent1,
      min: "1.25", max: "10", step: "0.25",
      value: "1.5",
      readout: "right", verticalAlign: false, textAlign: false,
      handler: (slider) => {
        const wt = Number.parseFloat(slider.value);
        if (!Number.isNaN(wt))
          this.updateWeight(wt, major);
      },
    });
    parent1.appendChild(weightSlider.div);
    weightSlider.div.style.marginLeft = indent1;
    // center the slider with the labels
    weightSlider.label.style.position = "relative";
    weightSlider.label.style.bottom = "3px";
    weightSlider.readout.style.position = "relative";
    weightSlider.readout.style.bottom = "3px";
    weightSlider.readout.style.marginLeft = "3px";

    return weightSlider;
  }

  public static addStyle(parent: HTMLElement, value: LinePixels, handler: ComboBoxHandler, major: boolean): ComboBox {
    const entries = [
      { name: "Solid", value: LinePixels.Solid },
      { name: "Code1", value: LinePixels.Code1 },
      { name: "Code2", value: LinePixels.Code2 },
      { name: "Code3", value: LinePixels.Code3 },
      { name: "Code4", value: LinePixels.Code4 },
      { name: "Code5", value: LinePixels.Code5 },
      { name: "Code6", value: LinePixels.Code6 },
      { name: "Code7", value: LinePixels.Code7 },
      { name: "Hidden Line", value: LinePixels.HiddenLine },
      { name: "Invisible", value: LinePixels.Invisible },
    ];

    const cb = createComboBox({
      parent,
      entries,
      id: major ? "major_style" : "minor_style",
      name: "Style ",
      value,
      handler,
    });
    cb.div.style.marginLeft = indent1;
    return cb;
  }

  private updateContoursDisplay(updateFunction: (view: ViewState) => CivilContourDisplayProps) {
    // const props = updateFunction(this._vp.view);
    // (this._vp.view as ViewState3d).getDisplayStyle3d().settings.contours = CivilContourDisplay.fromJSON(props);
    this.sync();
  }

  private resetContoursDisplay(): void {
    // const contours = CivilContourDisplay.fromJSON({});
    // (this._vp.view as ViewState3d).getDisplayStyle3d().settings.contours = contours;
    this.sync();
    this.updateContourDisplayUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }

  private updateContourDisplayUI(_view: ViewState) {
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
