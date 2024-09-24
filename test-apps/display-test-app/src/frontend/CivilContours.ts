/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, dispose, IDisposable } from "@itwin/core-bentley";
import {
  ColorInput,
  ColorInputProps, ComboBox, ComboBoxEntry, ComboBoxProps, createButton, createColorInput, createComboBox, createLabeledNumericInput,
  createSlider, createTextBox, LabeledNumericInput, Slider,
  SliderProps,
  TextBox,
  TextBoxProps,
  updateSliderValue,
} from "@itwin/frontend-devtools";
import { CivilContour, CivilContourDisplay, CivilContourDisplayProps, CivilTerrainProps, ColorDef, LinePixels } from "@itwin/core-common";
import { Viewport, ViewState3d } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

// size of widget or panel
const winSize = { top: 0, left: 0, width: 318, height: 300 };
const indent1 = "5px";
const bottomSpace1 = "3px";
const bottomSpace2 = "5px";

export class CivilContoursSettings implements IDisposable {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private readonly _subCatTextBox: TextBox;
  private _currentTerrainProps: CivilTerrainProps = {};
  private _currentContourIndex = 0;
  private _minorInterval: LabeledNumericInput;
  private _majorIntervalCount: LabeledNumericInput;
  private _minorLineStyle: ComboBox;
  private _majorLineStyle: ComboBox;
  private _minorColor: ColorInput;
  private _majorColor: ColorInput;
  private _minorWidth: Slider;
  private _majorWidth: Slider;

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

    const _comboDiv = document.createElement("div");
    const entries: ComboBoxEntry[] = [
      { name: "0", value: 0 },
      { name: "1", value: 1 },
      { name: "2", value: 2 },
      { name: "3", value: 3 },
      { name: "4", value: 4 },
    ];

    const cb = createComboBox({
      parent: this._element,
      name: "Contour Definition: ",
      entries,
      id: "viewAttr_renderingStyle",
      value: 0,
      handler: (cbx) => {
        this.loadContourDef(parseInt(cbx.value, 10));
      },
    });
    cb.label!.style.fontWeight = "bold";

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Apply",
      handler: () => { this.applyContourDef(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply contour settings for this definition",
    });
    createButton({
      value: "Clear",
      handler: () => { this.clearContourDef(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Clear contour settings for this definition",
    });
    this._element.appendChild(buttonDiv);

    const hrt1 = document.createElement("hr");
    this._element.appendChild(hrt1);
    hrt1.style.borderColor = "grey";
    const hrt2 = document.createElement("hr");
    this._element.appendChild(hrt2);
    hrt2.style.borderColor = "grey";

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

    this._majorIntervalCount = this.addInterval(this._element, true);
    this._majorColor = this.addColor(this._element, true);
    this._majorWidth = this.addWidth(this._element, true);
    this._majorLineStyle = this.addStyle(this._element, LinePixels.Solid, true);
    this._majorLineStyle.div.style.marginBottom = bottomSpace2;

    const hr2 = document.createElement("hr");
    hr2.style.borderColor = "grey";
    this._element.appendChild(hr2);
    const label2 = document.createElement("label");
    label2.innerText = "Minor Contours";
    label2.style.fontWeight = "bold";
    label2.style.display = "inline";
    this._element.appendChild(label2);

    this._minorInterval = this.addInterval(this._element, false);
    this._minorColor = this.addColor(this._element, false);
    this._minorWidth = this.addWidth(this._element, false);
    this._minorLineStyle = this.addStyle(this._element, LinePixels.Solid, false);
    this._minorLineStyle.div.style.marginBottom = bottomSpace2;

    parent.appendChild(this._element);

    this.loadContourDef(this._currentContourIndex);
  }

  public dispose(): void {
    this._parent.removeChild(this._element);
  }

  private getContourDisplayProps(view: ViewState3d): CivilContourDisplayProps {
    const contours =  view.displayStyle.settings.contours;
    return contours.toJSON();
  }

  private tryParseFloat(value: string): number | undefined {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? undefined : n;
  }

  private getTerrainProps(): CivilTerrainProps {
    return {
      subCategories: this._subCatTextBox.textbox.value.split(","),
      contourDef:{
        majorColor: ColorDef.tryComputeTbgrFromString(this._majorColor.input.value),
        minorColor: ColorDef.tryComputeTbgrFromString(this._minorColor.input.value),
        majorPixelWidth: this.tryParseFloat(this._majorWidth.slider.value),
        minorPixelWidth: this.tryParseFloat(this._minorWidth.slider.value),
        majorPattern: this.tryParseFloat(this._majorLineStyle.select.value),
        minorPattern: this.tryParseFloat(this._minorLineStyle.select.value),
        majorIntervalCount: this.tryParseFloat(this._majorIntervalCount.input.value),
        minorInterval: this.tryParseFloat(this._minorInterval.input.value),
      },
    };
  }

  private loadContourDef(index: number) {
    this._currentContourIndex = index;
    assert(this._vp.view.is3d());
    this._subCatTextBox.textbox.value = this._vp.view.displayStyle.settings.contours.terrains[index]?.subCategories?.join(",") ?? "";
    const curContourDef =  this._vp.view.displayStyle.settings.contours.terrains[index]?.contourDef ?? CivilContour.fromJSON({});
    this._majorColor.input.value = curContourDef.majorColor.toHexString();
    this._minorColor.input.value = curContourDef.minorColor.toHexString();
    updateSliderValue(this._majorWidth, curContourDef.majorPixelWidth.toString());
    updateSliderValue(this._minorWidth, curContourDef.minorPixelWidth.toString());
    this._majorLineStyle.select.value = curContourDef.majorPattern.toString();
    this._minorLineStyle.select.value = curContourDef.minorPattern.toString();
    this._majorIntervalCount.input.value = curContourDef.majorIntervalCount.toString();
    this._minorInterval.input.value = curContourDef.minorInterval.toString();
  }

  private applyContourDef() {
    const view = this._vp.view;
    assert(view.is3d());
    const contoursJson = this.getContourDisplayProps(view);
    if (undefined === contoursJson.terrains)
      contoursJson.terrains = [];
    contoursJson.terrains[this._currentContourIndex] = this.getTerrainProps();
    view.displayStyle.settings.contours = CivilContourDisplay.fromJSON(contoursJson);

    this.sync();
  }

  private clearContourDef() {
    const view = this._vp.view;
    assert(view.is3d());
    const contoursJson = this.getContourDisplayProps(view);
    if (undefined === contoursJson.terrains)
      contoursJson.terrains = [];
    contoursJson.terrains[this._currentContourIndex] = undefined;
    view.displayStyle.settings.contours = CivilContourDisplay.fromJSON(contoursJson);
    this.loadContourDef(this._currentContourIndex);

    this.sync();
  }

  private addInterval(parent: HTMLElement, major: boolean): LabeledNumericInput {
    const div = document.createElement("div");
    const numericIn = createLabeledNumericInput({
      id: major ? "major_interval" : "minor_interval",
      parent: div,
      value: major ? 5 : 1,
      handler: () => {},
      min: major ? 1 : 0,
      parseAsFloat: true,
      step: 1,
      name: major ? "Major Count " : "Minor Interval ",
    });
    numericIn.div.style.marginLeft = indent1;
    // this._thematicStepCount.div.style.marginRight = "1.5em";
    parent.appendChild(div);
    return numericIn;
  }

  private addColor(parent: HTMLElement, major: boolean): ColorInput{
    const div = document.createElement("div");

    const props: ColorInputProps = {
      parent: div,
      id: major ? "major_color" : "minor_color",
      label: "Color",
      value: "#000000",
      display: "inline",
      disabled: false,
      handler: () => {},
    };
    const colorIn = createColorInput(props);

    parent.appendChild(div);
    div.style.marginLeft = indent1;
    div.style.marginTop = indent1;
    div.style.marginBottom = indent1;
    return colorIn;
  }

  private addWidth(parent1: HTMLElement, major: boolean): Slider {
    const props: SliderProps = {
      name: " Width ", id: major ? "major_width" : "minor_width", parent: parent1,
      min: "1.0", max: "8.5", step: "0.5",
      value: "1.5",
      readout: "right", verticalAlign: false, textAlign: false,
      handler: () => {},
    };
    const widthSlider = createSlider(props);
    parent1.appendChild(widthSlider.div);
    widthSlider.div.style.marginLeft = indent1;
    // center the slider with the labels
    widthSlider.label.style.position = "relative";
    widthSlider.label.style.bottom = "3px";
    widthSlider.readout.style.position = "relative";
    widthSlider.readout.style.bottom = "3px";
    widthSlider.readout.style.marginLeft = "3px";

    return widthSlider;
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
      handler: () => {},
    };
    const cb = createComboBox(props);
    cb.div.style.marginLeft = indent1;

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
