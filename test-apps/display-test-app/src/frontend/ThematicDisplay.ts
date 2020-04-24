/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  ViewFlags,
  ColorDef,
  ColorByName,
  ThematicDisplayProps,
  ThematicDisplay,
  ThematicDisplayMode,
  ThematicGradientMode,
  ThematicGradientColorScheme,
  ThematicDisplaySensorProps,
} from "@bentley/imodeljs-common";
import {
  Viewport,
  ViewState,
  ViewState3d,
} from "@bentley/imodeljs-frontend";
import {
  createCheckBox,
  createButton,
  LabeledNumericInput,
  createLabeledNumericInput,
  createComboBox,
  ComboBox,
} from "@bentley/frontend-devtools";
import { Point3d, Range1d } from "@bentley/geometry-core";

export class ThematicDisplayEditor {
  private static _defaultSettings: ThematicDisplayProps = {
    displayMode: ThematicDisplayMode.Height,
    gradientSettings: {
      mode: ThematicGradientMode.Smooth,
      stepCount: 0,
      marginColor: ColorByName.blanchedAlmond,
      colorScheme: ThematicGradientColorScheme.BlueRed,
    },
    axis: [0.0, 0.0, 1.0],
    sensorSettings: {
      sensors: [],
    },
  };

  private _pushNewSensor(sensors: ThematicDisplaySensorProps[]) {
    const extents = this._vp.view.iModel.projectExtents;
    ThematicDisplayEditor._defaultSettings.range = { low: extents.zLow, high: extents.zHigh };

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
      this._appendSensorEntry("Sensor " + i.toString());
  }

  private _appendSensorEntry(name: string) {
    const option = document.createElement("option") as HTMLOptionElement;
    option.innerText = name;
    this._thematicSensor.select.appendChild(option);
  }

  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;
  private readonly _thematicDisplayMode: ComboBox;
  private readonly _thematicColorScheme: ComboBox;
  private readonly _thematicRangeLow: LabeledNumericInput;
  private readonly _thematicRangeHigh: LabeledNumericInput;
  private readonly _thematicAxisX: LabeledNumericInput;
  private readonly _thematicAxisY: LabeledNumericInput;
  private readonly _thematicAxisZ: LabeledNumericInput;
  private readonly _thematicSensor: ComboBox;
  private readonly _thematicSensorX: LabeledNumericInput;
  private readonly _thematicSensorY: LabeledNumericInput;
  private readonly _thematicSensorZ: LabeledNumericInput;
  private readonly _thematicSensorValue: LabeledNumericInput;
  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isThematicDisplaySupported = (view: ViewState) => view.is3d();
    const isThematicDisplayEnabled = (view: ViewState) => view.viewFlags.thematicDisplay;

    const div = document.createElement("div");
    div.appendChild(document.createElement("hr")!);

    const thematicControlsDiv = document.createElement("div")!;

    const showHideControls = (show: boolean) => {
      const display = show ? "block" : "none";
      thematicControlsDiv.style.display = display;
    };

    const enableThematicDisplay = (enabled: boolean) => {
      const extents = this._vp.view.iModel.projectExtents;
      ThematicDisplayEditor._defaultSettings.range = { low: extents.zLow, high: extents.zHigh };

      const sensors = ThematicDisplayEditor._defaultSettings.sensorSettings!.sensors!;

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
      displaySettings.thematic = ThematicDisplay.fromJSON(ThematicDisplayEditor._defaultSettings);
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.thematicDisplay = enabled;
      this._vp.viewFlags = vf;
      showHideControls(enabled);
      this.sync();
    };

    const checkbox = createCheckBox({
      parent: div,
      handler: (cb) => enableThematicDisplay(cb.checked),
      name: "Thematic Display",
      id: "cbx_Thematic",
    }).checkbox;

    const displayModeEntries = [
      { name: "Height", value: ThematicDisplayMode.Height },
      { name: "InverseDistanceWeightedSensors", value: ThematicDisplayMode.InverseDistanceWeightedSensors },
    ];

    this._thematicDisplayMode = createComboBox({
      parent: thematicControlsDiv,
      name: "Display Mode: ",
      entries: displayModeEntries,
      id: "thematic_displayMode",
      value: this._vp.viewFlags.renderMode,
      handler: (thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.displayMode = Number.parseInt(thing.value, 10);
        return props;
      }),
    });

    const colorSchemeEntries = [
      { name: "BlueRed", value: ThematicGradientColorScheme.BlueRed },
      { name: "RedBlue", value: ThematicGradientColorScheme.RedBlue },
      { name: "Monochrome", value: ThematicGradientColorScheme.Monochrome },
      { name: "Topographic", value: ThematicGradientColorScheme.Topographic },
      { name: "SeaMountain", value: ThematicGradientColorScheme.SeaMountain },
      { name: "Custom", value: ThematicGradientColorScheme.Custom },
    ];

    this._thematicColorScheme = createComboBox({
      parent: thematicControlsDiv,
      name: "Color Scheme: ",
      entries: colorSchemeEntries,
      id: "thematic_colorScheme",
      value: this._vp.viewFlags.renderMode,
      handler: (thing) => this.updateThematicDisplay((view): ThematicDisplayProps => {
        const props = this.getThematicSettingsProps(view);
        props.gradientSettings!.colorScheme = Number.parseInt(thing.value, 10);

        // For now, we just hardcode a custom color scheme in here. ###TODO - allow user to specify their own custom values.
        if (props.gradientSettings!.colorScheme === ThematicGradientColorScheme.Custom) {
          const customKeyValues = [[0.0, 255, 255, 0], [0.5, 255, 0, 255], [1.0, 0, 255, 255]];
          props.gradientSettings!.customKeys = [];
          customKeyValues.forEach((key) => props.gradientSettings!.customKeys!.push({ value: key[0], color: ColorDef.computeTbgrFromComponents(key[1], key[2], key[3]) }));
        }
        return props;
      }),
    });

    this._thematicRangeHigh = createLabeledNumericInput({
      id: "thematic_rangeHigh",
      parent: thematicControlsDiv,
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
      name: "High range (meters): ",
    });

    this._thematicRangeLow = createLabeledNumericInput({
      id: "thematic_rangeLow",
      parent: thematicControlsDiv,
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
      name: "Low range (meters): ",
    });

    const defaultAxis = Point3d.fromJSON(ThematicDisplayEditor._defaultSettings.axis!);

    this._thematicAxisX = createLabeledNumericInput({
      id: "thematic_axisX",
      parent: thematicControlsDiv,
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

    this._thematicAxisY = createLabeledNumericInput({
      id: "thematic_axisY",
      parent: thematicControlsDiv,
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
      name: "Axis Y: ",
    });

    this._thematicAxisZ = createLabeledNumericInput({
      id: "thematic_axisZ",
      parent: thematicControlsDiv,
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
      name: "Axis Z: ",
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

    this._thematicSensorX = createLabeledNumericInput({
      id: "thematic_sensorX",
      parent: thematicControlsDiv,
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

    this._thematicSensorY = createLabeledNumericInput({
      id: "thematic_sensorY",
      parent: thematicControlsDiv,
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
      name: "Sensor Y: ",
    });

    this._thematicSensorZ = createLabeledNumericInput({
      id: "thematic_sensorZ",
      parent: thematicControlsDiv,
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
      name: "Sensor Z: ",
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

    const addSensorButton = createButton({
      parent: thematicControlsDiv,
      id: "thematic_addSensor",
      value: "Add Sensor",
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
    addSensorButton.div.style.textAlign = "center";

    const deleteSensorButton = createButton({
      parent: thematicControlsDiv,
      id: "thematic_deleteSensor",
      value: "Delete Sensor",
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
    deleteSensorButton.div.style.textAlign = "center";

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
      showHideControls(checkbox.checked);

      this.updateThematicDisplayUI(view);
    };

    div.appendChild(thematicControlsDiv);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private getThematicSettingsProps(view: ViewState): ThematicDisplayProps {
    const grabSettings = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().settings.thematic;
    return grabSettings(view)!.toJSON();
  }

  private updateThematicDisplayUI(view: ViewState) {
    const props = this.getThematicSettingsProps(view);
    let range = Range1d.fromJSON(props.range);
    if (range.isNull)
      range = Range1d.fromJSON(ThematicDisplayEditor._defaultSettings.range);
    this._thematicRangeLow.input.value = range.low.toString();
    this._thematicRangeHigh.input.value = range.high.toString();
    this._thematicDisplayMode.select.value = (props.displayMode === undefined || props.displayMode === null) ? ThematicDisplayEditor._defaultSettings.displayMode!.toString() : props.displayMode!.toString();
    this._thematicColorScheme.select.value = (props.gradientSettings === undefined || props.gradientSettings === null) ? ThematicDisplayEditor._defaultSettings.gradientSettings!.colorScheme!.toString() : props.gradientSettings!.colorScheme!.toString();
    const axis = (props.axis === undefined || props.axis === null) ? Point3d.fromJSON(ThematicDisplayEditor._defaultSettings.axis!) : Point3d.fromJSON(props.axis);
    this._thematicAxisX.input.value = axis.x.toString();
    this._thematicAxisY.input.value = axis.y.toString();
    this._thematicAxisZ.input.value = axis.z.toString();

    if (undefined !== props.sensorSettings) {
      const sensors = props.sensorSettings.sensors;
      if (undefined !== sensors && sensors.length > 0) {
        if (this._thematicSensor.select.length < 1)
          this._resetSensorEntries(sensors.length);
        const selectedSensor = this._thematicSensor.select.options.selectedIndex;
        const pos = Point3d.fromJSON(sensors[selectedSensor].position);
        this._thematicSensorX.input.value = pos.x.toString();
        this._thematicSensorY.input.value = pos.y.toString();
        this._thematicSensorZ.input.value = pos.z.toString();
        this._thematicSensorValue.input.value = sensors[selectedSensor].value!.toString();
      }
    }
  }

  private updateThematicDisplay(updateFunction: (view: any) => ThematicDisplayProps) {
    const props = updateFunction(this._vp.view);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = ThematicDisplay.fromJSON(props);
    this.sync();
  }

  private resetThematicDisplay(): void {
    const thematicDisplay = ThematicDisplay.fromJSON(ThematicDisplayEditor._defaultSettings);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = thematicDisplay;
    this._resetSensorEntries(thematicDisplay.sensorSettings!.sensors.length);
    this.sync();
    this.updateThematicDisplayUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
