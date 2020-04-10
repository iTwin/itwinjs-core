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
      marginColor: new ColorDef(ColorByName.blanchedAlmond),
      colorScheme: ThematicGradientColorScheme.BlueRed,
    },
    axis: [0.0, 0.0, 1.0],
  };

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
          customKeyValues.forEach((key) => props.gradientSettings!.customKeys!.push({ value: key[0], color: ColorDef.from(key[1], key[2], key[3]) }));
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
  }

  private updateThematicDisplay(updateFunction: (view: any) => ThematicDisplayProps) {
    const props = updateFunction(this._vp.view);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = ThematicDisplay.fromJSON(props);
    this.sync();
  }

  private resetThematicDisplay(): void {
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.thematic = ThematicDisplay.fromJSON(ThematicDisplayEditor._defaultSettings);
    this.sync();
    this.updateThematicDisplayUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
