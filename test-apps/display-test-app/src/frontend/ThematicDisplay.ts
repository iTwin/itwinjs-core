/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { ComboBox, ComboBoxEntry, createButton, createCheckBox, createComboBox, createLabeledNumericInput, createSlider, LabeledNumericInput, Slider } from "@itwin/frontend-devtools";
import { Point3d, Range1d } from "@itwin/core-geometry";
import {
  calculateSolarDirectionFromAngles, ColorByName, ColorDef, ThematicDisplay, ThematicDisplayMode, ThematicDisplayProps,
  ThematicDisplaySensorProps, ThematicGradientColorScheme, ThematicGradientMode, ViewFlags,
} from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

type Required<T> = {
  [P in keyof T]-?: T[P];
};

const defaultSettings: Required<ThematicDisplayProps> = {
  displayMode: ThematicDisplayMode.Height,
  gradientSettings: {
    mode: ThematicGradientMode.Smooth,
    marginColor: ColorByName.blanchedAlmond,
    colorScheme: ThematicGradientColorScheme.BlueRed,
  },
  axis: [0.0, 0.0, 1.0],
  range: [0, 1],
  sunDirection: calculateSolarDirectionFromAngles({ azimuth: 315.0, elevation: 45.0 }).toJSON(),
  sensorSettings: {
    sensors: [],
    distanceCutoff: 0,
  },
};

export class ThematicDisplayEditor {
  // create a 32x32 grid of sensors spread evenly within the extents of the project
  private _createSensorGrid(sensors: ThematicDisplaySensorProps[]) {
    const sensorGridXLength = 32;
    const sensorGridYLength = 32;

    const sensorValues: number[] = [0.1, 0.9, 0.25, 0.15, 0.8, 0.34, 0.78, 0.32, 0.15, 0.29, 0.878, 0.95, 0.5, 0.278, 0.44, 0.33, 0.71];

    const extents = this._vp.view.iModel.projectExtents;
    const xRange = Range1d.createXX(extents.xLow, extents.xHigh);
    const yRange = Range1d.createXX(extents.yLow, extents.yHigh);
    const sensorZ = extents.low.z + (extents.high.z - extents.low.z) / 2.0;

    let sensorValueIndex = 0;

    for (let y = 0; y < sensorGridYLength; y++) {
      const sensorY = yRange.fractionToPoint(y / (sensorGridYLength - 1));

      for (let x = 0; x < sensorGridXLength; x++) {
        const sensorX = xRange.fractionToPoint(x / (sensorGridXLength - 1));

        const sensorPos = Point3d.create(sensorX, sensorY, sensorZ);
        this._pushNewSensor(sensors, { position: sensorPos, value: sensorValues[sensorValueIndex] });

        sensorValueIndex++;
        if (sensorValueIndex >= sensorValues.length)
          sensorValueIndex = 0;
      }
    }
  }

  private _pushNewSensor(sensors: ThematicDisplaySensorProps[], sensorProps?: ThematicDisplaySensorProps) {
    if (undefined !== sensorProps) {
      sensors.push(sensorProps);
      return;
    }

    const extents = this._vp.view.iModel.projectExtents;
    defaultSettings.range = { low: extents.zLow, high: extents.zHigh };

    const sensorZ = extents.low.z + (extents.high.z - extents.low.z) / 2.0;
    const sensorLow = extents.low.cloneAsPoint3d();
    const sensorHigh = extents.high.cloneAsPoint3d();
    sensorLow.z = sensorHigh.z = sensorZ;

    const sensorPos = sensorLow.interpolate(0.5, sensorHigh);

    sensors.push({ position: sensorPos, value: 0.5 });
  }

  private _resetSensorEntries(count: number) {
    const select = this._thematicSensor.select;
    while (select.length > 0)
      select.remove(0);

    for (let i = 0; i < count; i++)
      this._appendSensorEntry(`Sensor ${i.toString()}`);
  }

  private _appendSensorEntry(name: string) {
    const option = document.createElement("option");
    option.innerText = name;
    this._thematicSensor.select.appendChild(option);
  }

  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;
  private readonly _thematicDisplayMode: ComboBox;
  private readonly _thematicGradientMode: ComboBox;
  private readonly _thematicStepCount: LabeledNumericInput;
  private readonly _thematicColorScheme: ComboBox;
  private readonly _thematicRangeLow: LabeledNumericInput;
  private readonly _thematicRangeHigh: LabeledNumericInput;
  private readonly _thematicColorMix: Slider;
  private readonly _thematicAxisX: LabeledNumericInput;
  private readonly _thematicAxisY: LabeledNumericInput;
  private readonly _thematicAxisZ: LabeledNumericInput;
  private readonly _thematicSunDirX: LabeledNumericInput;
  private readonly _thematicSunDirY: LabeledNumericInput;
  private readonly _thematicSunDirZ: LabeledNumericInput;
  private readonly _thematicDistanceCutoff: LabeledNumericInput;
  private readonly _thematicSensor: ComboBox;
  private readonly _thematicSensorX: LabeledNumericInput;
  private readonly _thematicSensorY: LabeledNumericInput;
  private readonly _thematicSensorZ: LabeledNumericInput;
  private readonly _thematicSensorValue: LabeledNumericInput;

  private static _gradientModeEntriesForHeight = [
    { name: "Smooth", value: ThematicGradientMode.Smooth },
    { name: "Stepped", value: ThematicGradientMode.Stepped },
    { name: "SteppedWithDelimiter", value: ThematicGradientMode.SteppedWithDelimiter },
    { name: "IsoLines", value: ThematicGradientMode.IsoLines },
  ];
  private static _gradientModeEntriesForOthers = [
    { name: "Smooth", value: ThematicGradientMode.Smooth },
    { name: "Stepped", value: ThematicGradientMode.Stepped },
  ];

  private static _appendComboBoxEntry(select: HTMLSelectElement, entry: ComboBoxEntry) {
    const option = document.createElement("option");
    option.innerText = entry.name;
    if (undefined !== entry.value)
      option.value = entry.value.toString();
    select.appendChild(option);
  }

  private static _setComboBoxEntries(cb: ComboBox, entries: ComboBoxEntry[]) {
    // remove all existing entries
    let i;
    const ln = cb.select.options.length - 1;
    for (i = ln; i >= 0; i--) {
      cb.select.remove(i);
    }

    // add new entries
    for (const entry of entries) {
      ThematicDisplayEditor._appendComboBoxEntry(cb.select, entry);
    }
  }

  public updateDefaultRange() {
    const extents = this._vp.view.iModel.projectExtents;
    defaultSettings.range = { low: extents.zLow, high: extents.zHigh };
  }

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isThematicDisplaySupported = (view: ViewState) => view.is3d();
    const isThematicDisplayEnabled = (view: ViewState) => view.viewFlags.thematicDisplay;

    const div = document.createElement("div");

    const thematicControlsDiv = document.createElement("div")!;

    const showHideControls = (show: boolean) => {
      const display = show ? "block" : "none";
      thematicControlsDiv.style.display = display;
    };

    const enableThematicDisplay = (enabled: boolean) => {
      const extents = this._vp.view.iModel.projectExtents;
      defaultSettings.range = { low: extents.zLow, high: extents.zHigh };
      const sensors = defaultSettings.sensorSettings.sensors!;
      defaultSettings.sensorSettings.distanceCutoff = extents.xLength() / 25.0;

      const sensorZ = extents.low.z + (extents.high.z - extents.low.z) / 2.0;
      const sensorLow = extents.low.cloneAsPoint3d();
      const sensorHigh = extents.high.cloneAsPoint3d();
      sensorLow.z = sensorHigh.z = sensorZ;

      const sensorPosA = sensorLow.interpolate(0.25, sensorHigh);
      const sensorPosB = sensorLow.interpolate(0.5, sensorHigh);
      const sensorPosC = sensorLow.interpolate(0.65, sensorHigh);
      const sensorPosD = sensorLow.interpolate(0.75, sensorHigh);

      sensors[0] = { position: sensorPosA, value: 0.025 };
      sensors[1] = { position: sensorPosB, value: 0.5 };
      sensors[2] = { position: sensorPosC, value: 0.025 };
      sensors[3] = { position: sensorPosD, value: 0.75 };

      this._resetSensorEntries(4);

      const displaySettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.thematic = ThematicDisplay.fromJSON(defaultSettings);
      this._vp.viewFlags = this._vp.viewFlags.with("thematicDisplay", enabled);
      showHideControls(enabled);
      this.sync();
    };

    const checkboxInterface = createCheckBox({
      parent: div,
      handler: (cb) => enableThematicDisplay(cb.checked),
      name: "Thematic Display",
      id: "cbx_Thematic",
    });
    const checkbox = checkboxInterface.checkbox;
    const checkboxLabel = checkboxInterface.label;

    const displayModeEntries = [
      { name: "Height", value: ThematicDisplayMode.Height },
      { name: "InverseDistanceWeightedSensors", value: ThematicDisplayMode.InverseDistanceWeightedSensors },
      { name: "Slope", value: ThematicDisplayMode.Slope },
      { name: "HillShade", value: ThematicDisplayMode.HillShade },
    ];

    this._thematicDisplayMode = createComboBox({
      parent: thematicControlsDiv,
      name: "Display Mode: ",
      entries: displayModeEntries,
      id: "thematic_displayMode",
      value: 0,
      handler: (thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const prevDisplayMode = props.displayMode;
        const newDisplayMode = props.displayMode = Number.parseInt(thing.value, 10);
        if (ThematicDisplayMode.Slope === newDisplayMode) {
          props.range = { low: 0.0, high: 90.0 };
        } else if (ThematicDisplayMode.Slope === prevDisplayMode) {
          this.updateDefaultRange();
          const range1d = Range1d.fromJSON(defaultSettings.range);
          props.range = { low: range1d.low, high: range1d.high };
        }
        return props;
      }),
    });

    this._thematicGradientMode = createComboBox({
      parent: thematicControlsDiv,
      name: "Gradient Mode: ",
      entries: ThematicDisplayEditor._gradientModeEntriesForHeight,
      id: "thematic_gradientMode",
      value: 0,
      handler: (thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.gradientSettings!.mode = Number.parseInt(thing.value, 10);
        return props;
      }),
    });

    const spanStepAndColor = document.createElement("span");
    spanStepAndColor.style.display = "flex";
    thematicControlsDiv.appendChild(spanStepAndColor);
    this._thematicStepCount = createLabeledNumericInput({
      id: "thematic_stepCount",
      parent: spanStepAndColor,
      value: 1,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.gradientSettings!.stepCount = value;
        return props;
      }),
      min: 2,
      max: 65536,
      step: 1,
      name: "Step Count: ",
    });
    this._thematicStepCount.div.style.marginRight = "1.5em";

    const colorSchemeEntries = [
      { name: "BlueRed", value: ThematicGradientColorScheme.BlueRed },
      { name: "RedBlue", value: ThematicGradientColorScheme.RedBlue },
      { name: "Monochrome", value: ThematicGradientColorScheme.Monochrome },
      { name: "Topographic", value: ThematicGradientColorScheme.Topographic },
      { name: "SeaMountain", value: ThematicGradientColorScheme.SeaMountain },
      { name: "Custom", value: ThematicGradientColorScheme.Custom },
    ];

    this._thematicColorScheme = createComboBox({
      parent: spanStepAndColor,
      name: "Color Scheme: ",
      entries: colorSchemeEntries,
      id: "thematic_colorScheme",
      value: 0,
      handler: (thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.gradientSettings!.colorScheme = Number.parseInt(thing.value, 10);

        // For now, we just hard code a custom color scheme in here. ###TODO - allow user to specify their own custom values.
        if (props.gradientSettings!.colorScheme === ThematicGradientColorScheme.Custom) {
          const customKeyValues = [[0.0, 255, 255, 0], [0.5, 255, 0, 255], [1.0, 0, 255, 255]];
          props.gradientSettings!.customKeys = [];
          customKeyValues.forEach((key) => props.gradientSettings!.customKeys!.push({ value: key[0], color: ColorDef.computeTbgrFromComponents(key[1], key[2], key[3]) }));
        }
        return props;
      }),
    });

    const spanRange = document.createElement("span");
    spanRange.style.display = "flex";
    thematicControlsDiv.appendChild(spanRange);
    this._thematicRangeHigh = createLabeledNumericInput({
      id: "thematic_rangeHigh",
      parent: spanRange,
      value: -1.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const oldRange = Range1d.fromJSON(props.range);
        props.range = { low: oldRange.low, high: value };
        return props;
      }),
      min: -100000.0,
      max: 100000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "High range: ",
    });
    this._thematicRangeHigh.div.style.marginRight = "0.5em";

    this._thematicRangeLow = createLabeledNumericInput({
      id: "thematic_rangeLow",
      parent: spanRange,
      value: 1.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const oldRange = Range1d.fromJSON(props.range);
        props.range = { low: value, high: oldRange.high };
        return props;
      }),
      min: -100000.0,
      max: 100000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Low range: ",
    });

    const defaultAxis = Point3d.fromJSON(defaultSettings.axis);

    const spanAxis = document.createElement("span");
    spanAxis.style.display = "flex";
    thematicControlsDiv.appendChild(spanAxis);
    this._thematicAxisX = createLabeledNumericInput({
      id: "thematic_axisX",
      parent: spanAxis,
      value: defaultAxis.x,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const axis = Point3d.fromJSON(props.axis);
        axis.x = value;
        props.axis = axis.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Axis X: ",
    });
    this._thematicAxisX.div.style.marginRight = "0.5em";

    this._thematicAxisY = createLabeledNumericInput({
      id: "thematic_axisY",
      parent: spanAxis,
      value: defaultAxis.y,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const axis = Point3d.fromJSON(props.axis);
        axis.y = value;
        props.axis = axis.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Y: ",
    });
    this._thematicAxisY.div.style.marginRight = "0.5em";

    this._thematicAxisZ = createLabeledNumericInput({
      id: "thematic_axisZ",
      parent: spanAxis,
      value: defaultAxis.z,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const axis = Point3d.fromJSON(props.axis);
        axis.z = value;
        props.axis = axis.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Z: ",
    });

    this._thematicColorMix = createSlider({
      id: "thematic_colorMix",
      name: "Terrain/PointCloud Mix",
      parent: thematicControlsDiv,
      min: "0.0",
      max: "1.0",
      step: "0.05",
      value: "0.0",
      handler: (_) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.gradientSettings!.colorMix = parseFloat(this._thematicColorMix.slider.value);
        return props;
      }),
    });
    this._thematicColorMix.div.style.textAlign = "left";

    const spanSunDir = document.createElement("span");
    spanSunDir.style.display = "flex";
    thematicControlsDiv.appendChild(spanSunDir);
    this._thematicSunDirX = createLabeledNumericInput({
      id: "thematic_sunDirX",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const sunDir = Point3d.fromJSON(props.sunDirection);
        sunDir.x = value;
        props.sunDirection = sunDir.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Sun Direction X: ",
    });
    this._thematicSunDirX.div.style.marginRight = "0.5em";

    this._thematicSunDirY = createLabeledNumericInput({
      id: "thematic_sunDirY",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const sunDir = Point3d.fromJSON(props.sunDirection);
        sunDir.y = value;
        props.sunDirection = sunDir.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Y: ",
    });
    this._thematicSunDirY.div.style.marginRight = "0.5em";

    this._thematicSunDirZ = createLabeledNumericInput({
      id: "thematic_sunDirZ",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const sunDir = Point3d.fromJSON(props.sunDirection);
        sunDir.z = value;
        props.sunDirection = sunDir.toJSON();
        return props;
      }),
      min: -1.0,
      max: 1.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Z: ",
    });

    this._thematicDistanceCutoff = createLabeledNumericInput({
      id: "thematic_distanceCutoff",
      parent: thematicControlsDiv,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.sensorSettings!.distanceCutoff = value;
        return props;
      }),
      min: -999999.0,
      max: 999999.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Distance Cutoff: ",
    });

    this._thematicSensor = createComboBox({
      parent: thematicControlsDiv,
      name: "Selected Sensor: ",
      entries: [],
      id: "thematic_sensor",
      value: 0,
      handler: (_thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        return this.getThematicSettingsProps(view);
      }),
    });

    const spanSensor = document.createElement("span");
    spanSensor.style.display = "flex";
    thematicControlsDiv.appendChild(spanSensor);
    this._thematicSensorX = createLabeledNumericInput({
      id: "thematic_sensorX",
      parent: spanSensor,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const selectedSensor = this._thematicSensor.select.options.selectedIndex;
        const pos = Point3d.fromJSON(props.sensorSettings!.sensors![selectedSensor].position);
        pos.x = value;
        props.sensorSettings!.sensors![selectedSensor].position = pos.toJSON();
        return props;
      }),
      min: -999999.0,
      max: 999999.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Sensor X: ",
    });
    this._thematicSensorX.div.style.marginRight = "0.5em";

    this._thematicSensorY = createLabeledNumericInput({
      id: "thematic_sensorY",
      parent: spanSensor,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const selectedSensor = this._thematicSensor.select.options.selectedIndex;
        const pos = Point3d.fromJSON(props.sensorSettings!.sensors![selectedSensor].position);
        pos.y = value;
        props.sensorSettings!.sensors![selectedSensor].position = pos.toJSON();
        return props;
      }),
      min: -999999.0,
      max: 999999.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Y: ",
    });
    this._thematicSensorY.div.style.marginRight = "0.5em";

    this._thematicSensorZ = createLabeledNumericInput({
      id: "thematic_sensorZ",
      parent: spanSensor,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const selectedSensor = this._thematicSensor.select.options.selectedIndex;
        const pos = Point3d.fromJSON(props.sensorSettings!.sensors![selectedSensor].position);
        pos.z = value;
        props.sensorSettings!.sensors![selectedSensor].position = pos.toJSON();
        return props;
      }),
      min: -999999.0,
      max: 999999.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Z: ",
    });

    this._thematicSensorValue = createLabeledNumericInput({
      id: "thematic_sensorValue",
      parent: thematicControlsDiv,
      value: 0.0,
      handler: (value, _) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        const selectedSensor = this._thematicSensor.select.options.selectedIndex;
        props.sensorSettings!.sensors![selectedSensor].value = value;
        return props;
      }),
      min: 0.0,
      max: 1.0,
      step: 0.025,
      parseAsFloat: true,
      name: "Sensor Value: ",
    });

    const sensorsControlsDiv = document.createElement("div")!;

    createButton({
      parent: sensorsControlsDiv,
      id: "thematic_addSensor",
      value: "Add Sensor",
      inline: true,
      handler: () => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        if (props.sensorSettings!.sensors !== undefined) {
          this._pushNewSensor(props.sensorSettings!.sensors);
          this._resetSensorEntries(props.sensorSettings!.sensors.length);
          this._thematicSensor.select.selectedIndex = props.sensorSettings!.sensors.length - 1;
        }
        return props;
      }),
    });

    createButton({
      parent: sensorsControlsDiv,
      id: "thematic_deleteSensor",
      value: "Delete Sensor",
      inline: true,
      handler: () => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        if (props.sensorSettings!.sensors !== undefined && props.sensorSettings!.sensors.length > 1) {
          const selectedSensorIndex = this._thematicSensor.select.options.selectedIndex;
          props.sensorSettings!.sensors.splice(selectedSensorIndex, 1);
          if (props.sensorSettings!.sensors === undefined)
            props.sensorSettings!.sensors = [];
          this._thematicSensor.select.options.remove(selectedSensorIndex);
        }
        return props;
      }),
    });

    createButton({
      parent: sensorsControlsDiv,
      id: "thematic_createSensorGrid",
      value: "Create Sensor Grid",
      inline: true,
      handler: () => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        if (props.sensorSettings!.sensors !== undefined) {
          props.sensorSettings!.sensors = [];
          this._createSensorGrid(props.sensorSettings!.sensors);
          this._resetSensorEntries(props.sensorSettings!.sensors.length);
          this._thematicSensor.select.selectedIndex = props.sensorSettings!.sensors.length - 1;
        }
        return props;
      }),
    });

    sensorsControlsDiv.style.textAlign = "center";
    thematicControlsDiv.appendChild(sensorsControlsDiv);

    const resetButton = createButton({
      parent: thematicControlsDiv,
      id: "thematic_reset",
      value: "Reset",
      handler: () => this.resetThematicDisplay(),
    });
    resetButton.div.style.textAlign = "center";

    this._update = (view) => {
      const visible = isThematicDisplaySupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isThematicDisplayEnabled(view);
      checkboxLabel.style.fontWeight = checkbox.checked ? "bold" : "500";
      showHideControls(checkbox.checked);

      this.updateThematicDisplayUI(view);
    };

    div.appendChild(thematicControlsDiv);

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    div.appendChild(hr);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private getThematicSettings(view: ViewState): ThematicDisplay {
    assert(view.is3d());
    return view.displayStyle.settings.thematic;
  }

  private getThematicSettingsProps(view: ViewState): ThematicDisplayProps {
    return this.getThematicSettings(view).toJSON();
  }

  private updateThematicDisplayUI(view: ViewState) {
    const settings = this.getThematicSettings(view);

    let range = settings.range;
    if (range.isNull) {
      this.updateDefaultRange();
      range = Range1d.fromJSON(defaultSettings.range);
    }
    this._thematicRangeLow.input.value = range.low.toString();
    this._thematicRangeHigh.input.value = range.high.toString();

    this._thematicDisplayMode.select.value = settings.displayMode.toString();

    const displayMode = Number.parseInt(this._thematicDisplayMode.select.value, 10);
    if (ThematicDisplayMode.Height === displayMode) {
      ThematicDisplayEditor._setComboBoxEntries(this._thematicGradientMode, ThematicDisplayEditor._gradientModeEntriesForHeight);
    } else {
      ThematicDisplayEditor._setComboBoxEntries(this._thematicGradientMode, ThematicDisplayEditor._gradientModeEntriesForOthers);
    }

    this._thematicGradientMode.select.value = settings.gradientSettings.mode.toString();
    this._thematicStepCount.input.value = settings.gradientSettings.stepCount.toString();
    this._thematicColorScheme.select.value = settings.gradientSettings.colorScheme.toString();
    this._thematicColorMix.slider.value = settings.gradientSettings.colorMix.toString();

    this._thematicAxisX.input.value = settings.axis.x.toString();
    this._thematicAxisY.input.value = settings.axis.y.toString();
    this._thematicAxisZ.input.value = settings.axis.z.toString();

    this._thematicSunDirX.input.value = settings.sunDirection.x.toString();
    this._thematicSunDirY.input.value = settings.sunDirection.y.toString();
    this._thematicSunDirZ.input.value = settings.sunDirection.z.toString();

    this._thematicDistanceCutoff.input.value = settings.sensorSettings.distanceCutoff.toString();
    const sensors = settings.sensorSettings.sensors;
    if (sensors.length > 0) {
      if (this._thematicSensor.select.length < 1)
        this._resetSensorEntries(sensors.length);

      const selectedSensor = this._thematicSensor.select.options.selectedIndex;
      const pos = Point3d.fromJSON(sensors[selectedSensor].position);
      this._thematicSensorX.input.value = pos.x.toString();
      this._thematicSensorY.input.value = pos.y.toString();
      this._thematicSensorZ.input.value = pos.z.toString();
      this._thematicSensorValue.input.value = sensors[selectedSensor].value.toString();
    }
  }

  private updateThematicDisplay(updateFunction: (view: ViewState) => ThematicDisplayProps) {
    const props = updateFunction(this._vp.view);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = ThematicDisplay.fromJSON(props);
    this.sync();
  }

  private resetThematicDisplay(): void {
    const thematicDisplay = ThematicDisplay.fromJSON(defaultSettings);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = thematicDisplay;
    this._resetSensorEntries(thematicDisplay.sensorSettings.sensors.length);
    this.sync();
    this.updateThematicDisplayUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
