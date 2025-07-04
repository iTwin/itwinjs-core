/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, CompressedId64Set, dispose } from "@itwin/core-bentley";
import {
  CheckBox,
  ColorInput,
  ColorInputProps, ComboBox, ComboBoxEntry, ComboBoxProps, createButton, createCheckBox, createColorInput, createComboBox, createLabeledNumericInput,
  createSlider, createTextBox, LabeledNumericInput, Slider,
  SliderProps,
  TextBox,
  TextBoxProps,
  updateSliderValue,
} from "@itwin/frontend-devtools";
import { ColorDef, Contour, ContourDisplay, ContourDisplayProps, ContourGroupProps, LinePixels, RgbColor } from "@itwin/core-common";
import { Viewport, ViewState3d } from "@itwin/core-frontend";
import { ToolBarDropDown } from "./ToolBar";

// size of widget or panel
const winSize = { top: 0, left: 0, width: 318, height: 300 };
const indent1 = "5px";
const bottomSpace1 = "3px";
const bottomSpace2 = "5px";

export class ContoursSettings implements Disposable {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private readonly _element: HTMLElement;
  private readonly _curGroupDiv: HTMLElement;
  private readonly _subCatTextBox: TextBox;
  private readonly _nameTextBox: TextBox;
  private _currentTerrainProps: ContourGroupProps = {};
  private _currentContourIndex = 0;
  private _minorInterval: LabeledNumericInput;
  private _majorIntervalCount: LabeledNumericInput;
  private _minorLineStyle: ComboBox;
  private _majorLineStyle: ComboBox;
  private _minorColor: ColorInput;
  private _majorColor: ColorInput;
  private _minorWidth: Slider;
  private _majorWidth: Slider;
  private _dispElemCkbx: CheckBox;
  private _checkbox: CheckBox;
  private _combobox: ComboBox;

  private toggleCurrentGroup(enable: boolean) {
    this._curGroupDiv.style.display = enable ? "block" : "none";
  }

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._currentTerrainProps.contourDef = {};
    this._currentTerrainProps.subCategories = "";

    this._vp = vp;
    this._parent = parent;

    this._element = document.createElement("div");
    this._element.className = "toolMenu";
    this._element.style.display = "block";
    this._element.style.overflowX = "none";
    this._element.style.overflowY = "none";
    const width = winSize.width * 0.98;
    this._element.style.width = `${width}px`;

    this._curGroupDiv = document.createElement("div");
    this._curGroupDiv.className = "toolMenu2";
    this._curGroupDiv.style.display = "block";
    this._curGroupDiv.style.overflowX = "none";
    this._curGroupDiv.style.overflowY = "none";
    const cgWidth = winSize.width * 0.98;
    this._curGroupDiv.style.width = `${cgWidth}px`;

    this._checkbox = createCheckBox({
      parent: this._element,
      name: "Display contours in the viewport",
      id: "cbx_toggleDisplayContours",
      handler: (checkbox) => {
        assert(this._vp.view.is3d());
        this._vp.view.displayStyle.settings.contours = this._vp.view.displayStyle.settings.contours.withDisplayContours(checkbox.checked);
        this.sync();
      },
    });

    const _comboDiv = document.createElement("div");
    const entries: ComboBoxEntry[] = [
      { name: "0", value: 0 },
      { name: "1", value: 1 },
      { name: "2", value: 2 },
      { name: "3", value: 3 },
      { name: "4", value: 4 },
    ];

    this._combobox = createComboBox({
      parent: this._element,
      name: "Contour Group: ",
      entries,
      id: "viewAttr_renderingStyle",
      value: 0,
      handler: (cbx) => {
        this.loadContourDef(parseInt(cbx.value, 10));
      },
    });
    this._combobox.label!.style.fontWeight = "bold";

    const hrt1 = document.createElement("hr");
    this._element.appendChild(hrt1);
    hrt1.style.borderColor = "grey";
    const hrt2 = document.createElement("hr");
    this._element.appendChild(hrt2);
    hrt2.style.borderColor = "grey";

    const nameProps: TextBoxProps = {
      label: "Name: ",
      id: `contours_name`,
      parent: this._curGroupDiv,
      tooltip: "Enter an optional name to identify this grouping",
      inline: true,
    };
    const nameTb = createTextBox(nameProps);
    nameTb.textbox.style.marginBottom = bottomSpace1;
    nameTb.label!.style.fontWeight = "bold";
    this._nameTextBox = nameTb;

    const props: TextBoxProps = {
      label: "Subcategory Ids: ",
      id: `contours_subCatIds`,
      parent: this._curGroupDiv,
      tooltip: "Enter comma-separated list of Subcategory Ids to associate this contour styling with",
      inline: true,
    };
    const tb = createTextBox(props);
    tb.textbox.style.marginBottom = bottomSpace1;
    tb.label!.style.fontWeight = "bold";
    this._subCatTextBox = tb;

    const hr1a = document.createElement("hr");
    hr1a.style.borderColor = "grey";
    this._curGroupDiv.appendChild(hr1a);

    this._dispElemCkbx = createCheckBox({
      parent: this._curGroupDiv,
      name: "Show Element",
      id: "cbx_toggleShowElement",
      tooltip: "Display element where contours are not applied",
      handler: () => {},
    });
    const hr1 = document.createElement("hr");
    hr1.style.borderColor = "grey";
    this._curGroupDiv.appendChild(hr1);

    const label1 = document.createElement("label");
    label1.innerText = "Major Contours";
    label1.style.display = "inline";
    label1.style.fontWeight = "bold";
    this._curGroupDiv.appendChild(label1);

    this._majorIntervalCount = this.addInterval(this._curGroupDiv, true);
    this._majorColor = this.addColor(this._curGroupDiv, true);
    this._majorWidth = this.addWidth(this._curGroupDiv, true);
    this._majorLineStyle = this.addStyle(this._curGroupDiv, LinePixels.Solid, true);
    this._majorLineStyle.div.style.marginBottom = bottomSpace2;

    const hr2 = document.createElement("hr");
    hr2.style.borderColor = "grey";
    this._curGroupDiv.appendChild(hr2);
    const label2 = document.createElement("label");
    label2.innerText = "Minor Contours";
    label2.style.fontWeight = "bold";
    label2.style.display = "inline";
    this._curGroupDiv.appendChild(label2);

    this._minorInterval = this.addInterval(this._curGroupDiv, false);
    this._minorColor = this.addColor(this._curGroupDiv, false);
    this._minorWidth = this.addWidth(this._curGroupDiv, false);
    this._minorLineStyle = this.addStyle(this._curGroupDiv, LinePixels.Solid, false);
    this._minorLineStyle.div.style.marginBottom = bottomSpace2;

    const buttonDiv = document.createElement("div");
    buttonDiv.style.textAlign = "center";
    createButton({
      value: "Add",
      handler: () => { this.addContourDef(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Add a new contour grouping",
    });
    createButton({
      value: "Apply",
      handler: () => { this.applyContourDef(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Apply contour settings for this definition",
    });
    createButton({
      value: "Delete",
      handler: () => { this.deleteContourDef(); },
      parent: buttonDiv,
      inline: true,
      tooltip: "Delete contour settings for this definition",
    });
    this._element.appendChild(buttonDiv);

    this._element.appendChild(this._curGroupDiv);
    parent.appendChild(this._element);

    this.toggleCurrentGroup(false);
    this.loadContourDef(this._currentContourIndex);

    assert(this._vp.view.is3d());
    this._checkbox.checkbox.checked = this._vp.view.displayStyle.settings.contours.displayContours;
  }

  public [Symbol.dispose](): void {
    this._parent.removeChild(this._element);
  }

  private getContourDisplayProps(view: ViewState3d): ContourDisplayProps {
    const contours =  view.displayStyle.settings.contours;
    return contours.toJSON();
  }

  private tryParseFloat(value: string): number | undefined {
    const n = Number.parseFloat(value);
    return Number.isNaN(n) ? undefined : n;
  }

  private getTerrainProps(): ContourGroupProps {
    const majorColor = ColorDef.fromJSON(ColorDef.tryComputeTbgrFromString(this._majorColor.input.value));
    const minorColor = ColorDef.fromJSON(ColorDef.tryComputeTbgrFromString(this._minorColor.input.value));
    return {
      subCategories: CompressedId64Set.sortAndCompress(this._subCatTextBox.textbox.value.split(",")),
      name: this._nameTextBox.textbox.value,
      contourDef:{
        majorStyle: {
          color: majorColor ? RgbColor.fromColorDef(majorColor) : undefined,
          pixelWidth: this.tryParseFloat(this._majorWidth.slider.value),
          pattern: this.tryParseFloat(this._majorLineStyle.select.value),
        },
        minorStyle: {
          color: minorColor ? RgbColor.fromColorDef(minorColor) : undefined,
          pixelWidth: this.tryParseFloat(this._minorWidth.slider.value),
          pattern: this.tryParseFloat(this._minorLineStyle.select.value),
        },
        majorIntervalCount: this.tryParseFloat(this._majorIntervalCount.input.value),
        minorInterval: this.tryParseFloat(this._minorInterval.input.value),
        showGeometry: this._dispElemCkbx.checkbox.checked,
      },
    };
  }

  private loadContourDef(index: number) {
    this._currentContourIndex = index;

    assert(this._vp.view.is3d());

    const groups = this._vp.view.displayStyle.settings.contours.groups;
    if (this._currentContourIndex > groups.length - 1) {
      this.toggleCurrentGroup(false);
      return;
    }

    this.toggleCurrentGroup(true);

    const subCats = groups[index].subCategories;
    this._subCatTextBox.textbox.value = (subCats ? [...subCats] : []).join(",") ?? "";
    this._nameTextBox.textbox.value = groups[index].name;
    const curContourDef =  groups[index].contourDef ?? Contour.fromJSON({});
    this._majorColor.input.value = curContourDef.majorStyle.color.toHexString();
    this._minorColor.input.value = curContourDef.minorStyle.color.toHexString();
    updateSliderValue(this._majorWidth, curContourDef.majorStyle.pixelWidth.toString());
    updateSliderValue(this._minorWidth, curContourDef.minorStyle.pixelWidth.toString());
    this._majorLineStyle.select.value = curContourDef.majorStyle.pattern.toString();
    this._minorLineStyle.select.value = curContourDef.minorStyle.pattern.toString();
    this._majorIntervalCount.input.value = curContourDef.majorIntervalCount.toString();
    this._minorInterval.input.value = curContourDef.minorInterval.toString();
    this._dispElemCkbx.checkbox.checked = curContourDef.showGeometry ?? true;
  }

  private addContourDef() {
    const view = this._vp.view;
    assert(view.is3d());
    const contoursJson = this.getContourDisplayProps(view);
    const groups = undefined === contoursJson.groups ? [] : contoursJson.groups;

    if (groups.length + 1 > 5) {
      return;
    }

    groups.push({});
    contoursJson.groups = groups;
    view.displayStyle.settings.contours = ContourDisplay.fromJSON(contoursJson);

    const newNdx = groups.length - 1;
    this.loadContourDef(newNdx);
    this._combobox.select.value = newNdx.toString();

    this.sync();
  }

  private applyContourDef() {
    const view = this._vp.view;
    assert(view.is3d());
    const contoursJson = this.getContourDisplayProps(view);
    const groups = undefined === contoursJson.groups ? [] : contoursJson.groups;

    if (this._currentContourIndex > groups.length - 1) {
      return;
    }

    groups[this._currentContourIndex] = this.getTerrainProps();
    contoursJson.groups = groups;
    view.displayStyle.settings.contours = ContourDisplay.fromJSON(contoursJson);

    this.sync();
  }

  private deleteContourDef() {
    assert(this._vp.view.is3d());

    const contoursJson = this.getContourDisplayProps(this._vp.view);
    const groups = undefined === contoursJson.groups ? [] : contoursJson.groups;

    if (this._currentContourIndex > groups.length - 1) {
      return;
    }

    groups.splice(this._currentContourIndex, 1);

    contoursJson.groups = groups;

    this._vp.view.displayStyle.settings.contours = ContourDisplay.fromJSON(contoursJson);

    this._currentContourIndex = 0;
    this._combobox.select.value = "0";
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

export class ContoursPanel extends ToolBarDropDown {
  private readonly _vp: Viewport;
  private readonly _parent: HTMLElement;
  private _settings?: ContoursSettings;

  public constructor(vp: Viewport, parent: HTMLElement) {
    super();
    this._vp = vp;
    this._parent = parent;
    this.open();
  }

  public override get onViewChanged(): Promise<void> {
    return Promise.resolve();
  }

  protected _open(): void { this._settings = new ContoursSettings(this._vp, this._parent); }
  protected _close(): void { this._settings = dispose(this._settings); }
  public get isOpen(): boolean { return undefined !== this._settings; }
}
