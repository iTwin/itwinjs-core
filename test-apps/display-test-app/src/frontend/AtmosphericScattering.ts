/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createButton, createCheckBox, createLabeledNumericInput, LabeledNumericInput } from "@itwin/frontend-devtools";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import {
  AtmosphericScattering,
  AtmosphericScatteringProps,
  ViewFlags,
} from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

type Required<T> = {
  [P in keyof T]-?: T[P];
};

const defaultSettings: Required<AtmosphericScatteringProps> = {
  sunDirection: [0.0, 0.0, 1.0],
  earthCenter: [0.0, 0.0, -6371000.0],
  atmosphereRadius: 6371100,
};

export class AtmosphericScatteringEditor {

  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;

  private readonly _sunDirectionX: LabeledNumericInput;
  private readonly _sunDirectionY: LabeledNumericInput;
  private readonly _sunDirectionZ: LabeledNumericInput;
  private readonly _earthCenterX: LabeledNumericInput;
  private readonly _earthCenterY: LabeledNumericInput;
  private readonly _earthCenterZ: LabeledNumericInput;
  private readonly _atmosphereRadius: LabeledNumericInput;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isAtmosphericScatteringSupported = (view: ViewState) => view.is3d();
    const isAtmosphericScatteringEnabled = (view: ViewState) => view.viewFlags.atmosphericScattering;

    const div = document.createElement("div");

    const atmosphericScatteringControlsDiv = document.createElement("div")!;

    const showHideControls = (show: boolean) => {
      const display = show ? "block" : "none";
      atmosphericScatteringControlsDiv.style.display = display;
    };

    const enableAtmosphericScattering = (enabled: boolean) => {
      const displaySettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.atmosphericScattering = AtmosphericScattering.fromJSON(defaultSettings);
      this._vp.viewFlags = this._vp.viewFlags.with("atmosphericScattering", enabled);
      showHideControls(enabled);
      this.sync();
    };

    const resetButton = createButton({
      parent: atmosphericScatteringControlsDiv,
      id: "atmosphericScattering_reset",
      value: "Reset",
      handler: () => this.resetAtmosphericScattering(),
    });
    resetButton.div.style.textAlign = "center";

    const checkboxInterface = createCheckBox({
      parent: div,
      handler: (cb) => enableAtmosphericScattering(cb.checked),
      name: "Atmospheric Scattering",
      id: "cbx_AtmosphericScattering",
    });
    const checkbox = checkboxInterface.checkbox;
    const checkboxLabel = checkboxInterface.label;

    const spanEarthCenter = document.createElement("span");
    spanEarthCenter.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanEarthCenter);
    this._earthCenterX = createLabeledNumericInput({
      id: "atmosphericScattering_earthCenterX",
      parent: spanEarthCenter,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthCenter = Vector3d.fromJSON(props.earthCenter);
        props.earthCenter = {x: value, y: earthCenter.y, z: earthCenter.z};
        return props;
      }),
      min: -1000.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Earth Center X: ",
    });

    this._earthCenterY = createLabeledNumericInput({
      id: "atmosphericScattering_earthCenterY",
      parent: spanEarthCenter,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthCenter = Vector3d.fromJSON(props.earthCenter);
        props.earthCenter = {x: earthCenter.x, y: value, z: earthCenter.z};
        return props;
      }),
      min: -1000.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Y: ",
    });

    this._earthCenterZ = createLabeledNumericInput({
      id: "atmosphericScattering_earthCenterZ",
      parent: spanEarthCenter,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthCenter = Vector3d.fromJSON(props.earthCenter);
        props.earthCenter = {x: earthCenter.x, y: earthCenter.y, z: value};
        return props;
      }),
      min: -10000000.0,
      max: 1000,
      step: 1.0,
      parseAsFloat: true,
      name: "Z: ",
    });

    const spanSunDir = document.createElement("span");
    spanSunDir.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanSunDir);
    this._sunDirectionX = createLabeledNumericInput({
      id: "atmosphericScattering_sunDirX",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
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
    this._sunDirectionX.div.style.marginRight = "0.5em";

    this._sunDirectionY = createLabeledNumericInput({
      id: "atmosphericScattering_sunDirY",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
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
    this._sunDirectionY.div.style.marginRight = "0.5em";

    this._sunDirectionZ = createLabeledNumericInput({
      id: "atmosphericScattering_sunDirY",
      parent: spanSunDir,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
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

    this._atmosphereRadius = createLabeledNumericInput({
      id: "atmosphericScattering_atmosphereRadius",
      parent: atmosphericScatteringControlsDiv,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.atmosphereRadius = value;
        return props;
      }),
      min: 0.0,
      max: 10000000.0,
      step: 1,
      parseAsFloat: true,
      name: "Atmosphere Radius: ",
    });

    this._update = (view) => {
      const visible = isAtmosphericScatteringSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isAtmosphericScatteringEnabled(view);
      checkboxLabel.style.fontWeight = checkbox.checked ? "bold" : "500";
      showHideControls(checkbox.checked);

      this.updateAtmosphericScatteringUI(view);
    };

    div.appendChild(atmosphericScatteringControlsDiv);

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    div.appendChild(hr);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private getAtmosphericScatteringSettings(view: ViewState): AtmosphericScattering {
    assert(view.is3d());
    return view.displayStyle.settings.atmosphericScattering;
  }

  private getAtmosphericScatteringSettingsProps(view: ViewState): AtmosphericScatteringProps {
    return this.getAtmosphericScatteringSettings(view).toJSON();
  }

  private updateAtmosphericScatteringUI(view: ViewState) {
    const settings = this.getAtmosphericScatteringSettings(view);

    this._earthCenterX.input.value = settings.earthCenter.x.toString();
    this._earthCenterY.input.value = settings.earthCenter.y.toString();
    this._earthCenterZ.input.value = settings.earthCenter.z.toString();
    this._sunDirectionX.input.value = settings.sunDirection.x.toString();
    this._sunDirectionY.input.value = settings.sunDirection.y.toString();
    this._sunDirectionZ.input.value = settings.sunDirection.z.toString();
    this._atmosphereRadius.input.value = settings.atmosphereRadius.toString();
  }

  private updateAtmosphericScattering(updateFunction: (view: ViewState) => AtmosphericScatteringProps) {
    const props = updateFunction(this._vp.view);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.atmosphericScattering = AtmosphericScattering.fromJSON(props);
    this.sync();
  }

  private resetAtmosphericScattering(): void {
    const atmosphericScattering = AtmosphericScattering.fromJSON(defaultSettings);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.atmosphericScattering = atmosphericScattering;
    this.sync();
    this.updateAtmosphericScatteringUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
