/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, dispose, IDisposable } from "@itwin/core-bentley";
import {
  ColorInput,
  ColorInputProps, ComboBox, ComboBoxEntry, ComboBoxProps, convertHexToRgb, createButton, createColorInput, createComboBox, createLabeledNumericInput, createNumericInput,
  createSlider, createTextBox, LabeledNumericInput, Slider,
  SliderProps,
  TextBox,
  TextBoxProps,
  updateSliderValue,
} from "@itwin/frontend-devtools";
import { CivilContour, CivilContourDisplay, CivilContourDisplayProps, CivilTerrainProps, LinePixels, RgbColor } from "@itwin/core-common";
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

  private getContourDisplayProps(view: ViewState): CivilContourDisplayProps {
    assert(view.is3d());
    const contours =  view.displayStyle.settings.contours;
    return contours.toJSON();
  }

  private loadContourDef(index: number) {
    this._currentContourIndex = index;
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
    this.updateSubCategories(this._subCatTextBox.textbox.value);
    contoursJson.terrains![this._currentContourIndex] = this._currentTerrainProps;
    view.displayStyle.settings.contours.terrains[this._currentContourIndex] = CivilContourDisplay.fromJSON(contoursJson).terrains[this._currentContourIndex];
    this.sync();
    console.log(JSON.stringify(contoursJson));
  }

  private clearContourDef() {
    const view = this._vp.view;
    assert(view.is3d());
    view.displayStyle.settings.contours = CivilContourDisplay.fromJSON({});

    const contoursJson = this.getContourDisplayProps(view);
    if (undefined !== contoursJson.terrains)
      delete contoursJson.terrains[this._currentContourIndex];
    if (undefined !== view.displayStyle.settings.contours.terrains)
      delete view.displayStyle.settings.contours.terrains[this._currentContourIndex];
    this.loadContourDef(this._currentContourIndex);

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

  private updateWidth(width: number | undefined, major: boolean): void {
    if (major)
      this._currentTerrainProps.contourDef!.majorPixelWidth = width;
    else // minor
      this._currentTerrainProps.contourDef!.minorPixelWidth = width;
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

  private addInterval(parent: HTMLElement, major: boolean): LabeledNumericInput {
    const div = document.createElement("div");
    const numericIn = createLabeledNumericInput({
      id: major ? "major_interval" : "minor_interval",
      parent: div,
      value: major ? 5 : 1,
      handler: (value) => this.updateInterval(value, major),
      min: major ? 1 : 0,
      // max: 65536,
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
      handler: (value: string) => this.updateColor(convertHexToRgb(value), major),
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
      min: "1.25", max: "10", step: "0.25",
      value: "1.5",
      readout: "right", verticalAlign: false, textAlign: false,
      handler: (slider) => {
        const wt = Number.parseFloat(slider.value);
        if (!Number.isNaN(wt))
          this.updateWidth(wt, major);
      },
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
