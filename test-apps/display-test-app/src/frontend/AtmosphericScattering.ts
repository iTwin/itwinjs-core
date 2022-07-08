/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { CheckBox, createButton, createCheckBox, createLabeledNumericInput, LabeledNumericInput } from "@itwin/frontend-devtools";
import { Vector3d } from "@itwin/core-geometry";
import {
  AtmosphericScattering,
  AtmosphericScatteringProps,
  defaultAtmosphericScatteringProps,
  ViewFlags,
} from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

type Required<T> = {
  [P in keyof T]-?: T[P];
};

const defaultSettings: Required<AtmosphericScatteringProps> = defaultAtmosphericScatteringProps;

export class AtmosphericScatteringEditor {

  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;

  private readonly _earthCenterX: LabeledNumericInput;
  private readonly _earthCenterY: LabeledNumericInput;
  private readonly _earthCenterZ: LabeledNumericInput;
  private readonly _earthRadiusX: LabeledNumericInput;
  private readonly _earthRadiusY: LabeledNumericInput;
  private readonly _earthRadiusZ: LabeledNumericInput;
  private readonly _atmosphereScale: LabeledNumericInput;
  // private readonly _earthRadius: LabeledNumericInput;
  private readonly _densityFalloff: LabeledNumericInput;
  private readonly _scatteringStrength: LabeledNumericInput;
  private readonly _wavelenghtR: LabeledNumericInput;
  private readonly _wavelenghtG: LabeledNumericInput;
  private readonly _wavelenghtB: LabeledNumericInput;
  private readonly _numInScatteringPoints: LabeledNumericInput;
  private readonly _numOpticalDepthPoints: LabeledNumericInput;
  private readonly _isPlanar: CheckBox;

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

    const spanEarthRadii = document.createElement("span");
    spanEarthRadii.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanEarthRadii);
    this._earthRadiusX = createLabeledNumericInput({
      id: "atmosphericScattering_earthRadiusX",
      parent: spanEarthRadii,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthRadii = Vector3d.fromJSON(props.earthRadii);
        props.earthRadii = {x: value, y: earthRadii.y, z: earthRadii.z};
        return props;
      }),
      min: -1000.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Earth radius X: ",
    });

    this._earthRadiusY = createLabeledNumericInput({
      id: "atmosphericScattering_earthRadiusY",
      parent: spanEarthRadii,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthRadii = Vector3d.fromJSON(props.earthRadii);
        props.earthRadii = {x: earthRadii.x, y: value, z: earthRadii.z};
        return props;
      }),
      min: -1000.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Y: ",
    });

    this._earthRadiusZ = createLabeledNumericInput({
      id: "atmosphericScattering_earthRadiusZ",
      parent: spanEarthRadii,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const earthRadii = Vector3d.fromJSON(props.earthRadii);
        props.earthRadii = {x: earthRadii.x, y: earthRadii.y, z: value};
        return props;
      }),
      min: -1000.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Z: ",
    });

    const spanAtmosphereScale = document.createElement("span");
    spanAtmosphereScale.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanAtmosphereScale);
    this._atmosphereScale = createLabeledNumericInput({
      id: "atmosphericScattering_atmosphereScale",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.atmosphereScale = value;
        return props;
      }),
      min: 0.0,
      max: 2.0,
      step: 0.01,
      parseAsFloat: true,
      name: "Atmosphere Scale: ",
    });

    // this._earthRadius = createLabeledNumericInput({
    //   id: "atmosphericScattering_earthRadius",
    //   parent: spanRadius,
    //   value: 0.0,
    //   handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
    //     const props = this.getAtmosphericScatteringSettingsProps(view);
    //     props.earthRadius = value;
    //     return props;
    //   }),
    //   min: 0.0,
    //   max: 10000000.0,
    //   step: 1,
    //   parseAsFloat: true,
    //   name: "Earth Radius: ",
    // });

    const spanScattering = document.createElement("span");
    spanScattering.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanScattering);
    this._scatteringStrength = createLabeledNumericInput({
      id: "atmosphericScattering_scatteringStrength",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.scatteringStrength = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Scattering Strength: ",
    });

    this._wavelenghtR = createLabeledNumericInput({
      id: "atmosphericScattering_wavelenghtR",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelenghts!;
        wavelenghts[0] = value;
        props.wavelenghts = wavelenghts;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 10,
      parseAsFloat: true,
      name: "Wavelenght R: ",
    });
    this._wavelenghtR.div.style.marginRight = "0.5em";

    this._wavelenghtG = createLabeledNumericInput({
      id: "atmosphericScattering_wavelenghtG",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelenghts!;
        wavelenghts[1] = value;
        props.wavelenghts = wavelenghts;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 10,
      parseAsFloat: true,
      name: "G: ",
    });
    this._wavelenghtG.div.style.marginRight = "0.5em";

    this._wavelenghtB = createLabeledNumericInput({
      id: "atmosphericScattering_wavelenghtB",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelenghts!;
        wavelenghts[2] = value;
        props.wavelenghts = wavelenghts;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 10,
      parseAsFloat: true,
      name: "B: ",
    });

    this._densityFalloff = createLabeledNumericInput({
      id: "atmosphericScattering_densityFalloff",
      parent: atmosphericScatteringControlsDiv,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.densityFalloff = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Density Falloff: ",
    });

    const spanSamplePoints = document.createElement("span");
    spanSamplePoints.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanSamplePoints);

    this._numInScatteringPoints = createLabeledNumericInput({
      id: "atmosphericScattering_numInScatteringPoints",
      parent: spanSamplePoints,
      value: 10,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.numInScatteringPoints = value;
        return props;
      }),
      min: 1,
      max: 20,
      step: 1,
      name: "InScattering Points: ",
    });

    this._numOpticalDepthPoints = createLabeledNumericInput({
      id: "atmosphericScattering_numOpticalDepthPoints",
      parent: spanSamplePoints,
      value: 10,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.numOpticalDepthPoints = value;
        return props;
      }),
      min: 1,
      max: 20,
      step: 1,
      name: "Optical Depth Points: ",
    });

    this._isPlanar = createCheckBox({
      id: "atmosphericScattering_isPlanar",
      parent: atmosphericScatteringControlsDiv,
      handler: (cbx) => this.updateAtmosphericScattering((view): AtmosphericScatteringProps => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.isPlanar = cbx.checked;
        return props;
      }),
      name: "Is Planar:",
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
    this._earthRadiusX.input.value = settings.earthRadii.x.toString();
    this._earthRadiusY.input.value = settings.earthRadii.y.toString();
    this._earthRadiusZ.input.value = settings.earthRadii.z.toString();
    this._atmosphereScale.input.value = settings.atmosphereScale.toString();
    // this._earthRadius.input.value = settings.earthRadius.toString();
    this._densityFalloff.input.value = settings.densityFalloff.toString();
    this._scatteringStrength.input.value = settings.scatteringStrength.toString();
    this._wavelenghtR.input.value = settings.wavelenghts[0].toString();
    this._wavelenghtG.input.value = settings.wavelenghts[1].toString();
    this._wavelenghtB.input.value = settings.wavelenghts[2].toString();
    this._numInScatteringPoints.input.value = settings.numInScatteringPoints.toString();
    this._numOpticalDepthPoints.input.value = settings.numOpticalDepthPoints.toString();
    this._isPlanar.checkbox.checked = settings.isPlanar;
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
