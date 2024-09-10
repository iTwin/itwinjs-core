/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, dispose, IDisposable } from "@itwin/core-bentley";
import {
  ColorInputProps, ComboBox, ComboBoxProps, convertHexToRgb, createButton, createColorInput, createComboBox, createNumericInput,
  createSlider, createTextBox, NumericInputProps, Slider,
  SliderProps,
  TextBox,
  TextBoxProps,
} from "@itwin/frontend-devtools";
import { CivilContourDisplay, CivilContourDisplayProps, CivilTerrainProps, LinePixels, RgbColor } from "@itwin/core-common";
import { Viewport, ViewState } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

// size of widget or panel
const winSize = { top: 0, left: 0, width: 311, height: 300 };
const indent1 = "5px";
const bottomSpace1 = "3px";
const bottomSpace2 = "5px";

export class CivilContoursSettings implements IDisposable {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private readonly _subCatTextBox: TextBox;
  private _currentTerrainProps: CivilTerrainProps = {};

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._currentTerrainProps.contourDef = {};
    this._currentTerrainProps.subCategories = [];

    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.overflowX = "none";
    this._element.style.overflowY = "none";
    const width = winSize.width * 0.98;
    this._element.style.width = `${width}px`;

    const props: TextBoxProps = {
      label: "Subcategory Ids: ",
      id: `contours_subCatIds`,
      parent: this._element,
      tooltip: "Enter comma-separated list of Subcategory Ids to associate this contour styling with",
      inline: true,
    };
    const tb = createTextBox(props);
    tb.textbox.style.marginBottom = bottomSpace1;
    tb.label!.style.fontWeight = "bold";
    this._subCatTextBox = tb;

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
    const cb = this.addStyle(this._element, LinePixels.Solid, true);
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
    const cb2 = this.addStyle(this._element, LinePixels.Solid, false);
    cb2.div.style.marginBottom = bottomSpace2;

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Add",
      handler: () => { this.applyNewTerrain(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply contour settings to specified subcategories",
    });
    createButton({
      value: "Clear",
      handler: () => { this.clearAllTerrains(); },
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

  private getContourDisplayProps(view: ViewState): CivilContourDisplayProps {
    assert(view.is3d());
    const contours =  view.displayStyle.settings.contours;
    return contours.toJSON();
  }

  private applyNewTerrain() {
    const view = this._vp.view;
    assert(view.is3d());

    const contoursJson = this.getContourDisplayProps(view);

    if (undefined === contoursJson.terrains)
      contoursJson.terrains = [];

    this.updateSubCategories(this._subCatTextBox.textbox.value);

    contoursJson.terrains.push(this._currentTerrainProps);

    view.displayStyle.settings.contours = CivilContourDisplay.fromJSON(contoursJson);

    this.sync();

    console.log(JSON.stringify(contoursJson));
  }

  private clearAllTerrains() {
    const view = this._vp.view;
    assert(view.is3d());
    view.displayStyle.settings.contours = CivilContourDisplay.fromJSON({});

    this.sync();
  }

  private updateSubCategories(subCategories: string) {
    const subCatList = subCategories.split(",");
    this._currentTerrainProps.subCategories = subCatList;
  }

  private updateInterval(interval: number | undefined, major: boolean): void {
    if (major)
      this._currentTerrainProps.contourDef!.majorIntervalCount = interval;
    else // minor
      this._currentTerrainProps.contourDef!.minorInterval = interval;
    console.log(JSON.stringify(this._currentTerrainProps));
  }

  private updateColor(rgb: RgbColor | undefined, major: boolean): void {
    if (major)
      this._currentTerrainProps.contourDef!.majorColor = rgb?.toColorDef().toJSON();
    else // minor
      this._currentTerrainProps.contourDef!.minorColor = rgb?.toColorDef().toJSON();
    console.log(JSON.stringify(this._currentTerrainProps));
  }

  private updateWeight(weight: number | undefined, major: boolean): void {
    if (major)
      this._currentTerrainProps.contourDef!.majorPixelWidth = weight;
    else // minor
      this._currentTerrainProps.contourDef!.minorPixelWidth = weight;
    console.log(JSON.stringify(this._currentTerrainProps));
  }

  private updateStyle(style: number, major: boolean): void {
    const linePixels = LinePixels.Invalid !== style ? style : undefined;
    if (major)
      this._currentTerrainProps.contourDef!.majorPattern = linePixels;
    else // minor
      this._currentTerrainProps.contourDef!.minorPattern = linePixels;
    console.log(JSON.stringify(this._currentTerrainProps));
  }

  private addInterval(parent: HTMLElement, major: boolean): void {
    const div = document.createElement("div");

    const label = document.createElement("label");
    label.htmlFor = major ? "major_interval" : "minor_interval";
    label.innerText = major ? "Major Count " : "Minor Interval ";
    div.appendChild(label);

    const props: NumericInputProps = {
      parent: div,
      value: major ? 100 : 50,
      disabled: false,
      min: 1,
      // max: 31,
      step: 1,
      handler: (value) => this.updateInterval(value, major),
    };
    const num = createNumericInput(props);
    div.appendChild(num);
    parent.appendChild(div);
    div.style.marginLeft = indent1;

    this.updateInterval(props.value, major);
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

    this.updateColor(convertHexToRgb(props.value), major);
  }

  private addWeight(parent1: HTMLElement, major: boolean): Slider {
    const props: SliderProps = {
      name: " Weight ", id: major ? "major_weight" : "minor_weight", parent: parent1,
      min: "1.25", max: "10", step: "0.25",
      value: "1.5",
      readout: "right", verticalAlign: false, textAlign: false,
      handler: (slider) => {
        const wt = Number.parseFloat(slider.value);
        if (!Number.isNaN(wt))
          this.updateWeight(wt, major);
      },
    };
    const weightSlider = createSlider(props);
    parent1.appendChild(weightSlider.div);
    weightSlider.div.style.marginLeft = indent1;
    // center the slider with the labels
    weightSlider.label.style.position = "relative";
    weightSlider.label.style.bottom = "3px";
    weightSlider.readout.style.position = "relative";
    weightSlider.readout.style.bottom = "3px";
    weightSlider.readout.style.marginLeft = "3px";

    const wt2 = Number.parseFloat(props.value);
    if (!Number.isNaN(wt2))
      this.updateWeight(wt2, major);

    return weightSlider;
  }

  public addStyle(parent: HTMLElement, value: LinePixels, major: boolean): ComboBox {
    const entries = [
      { name: "Solid", value: 0 },
      { name: "Code1", value: 1 },
      { name: "Code2", value: 2 },
      { name: "Code3", value: 3 },
      { name: "Code4", value: 4 },
      { name: "Code5", value: 5 },
      { name: "Code6", value: 6 },
      { name: "Code7", value: 7 },
      { name: "Hidden Line", value: 8 },
      { name: "Invisible", value: 9 },
    ];

    const props: ComboBoxProps = {
      parent,
      entries,
      id: major ? "major_style" : "minor_style",
      name: "Style ",
      value,
      handler: (select: HTMLSelectElement) => this.updateStyle(parseInt(select.value, 10), major),
    };
    const cb = createComboBox(props);
    cb.div.style.marginLeft = indent1;

    this.updateStyle(value, major);

    return cb;
  }

  private sync(): void {
    this._vp.synchWithView();
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
