/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createButton, createCheckBox, createLabeledNumericInput, LabeledNumericInput } from "@itwin/frontend-devtools";
import {
  AtmosphericScattering,
  ViewFlags,
} from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

type Required<T> = {
  [P in keyof T]-?: T[P];
};

const defaultSettings: Required<AtmosphericScattering.Props> = AtmosphericScattering.Settings.defaults;

export class AtmosphericScatteringEditor {

  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;

  private readonly _inScatteringIntensity: LabeledNumericInput;
  private readonly _outScatteringIntensity: LabeledNumericInput;

  private readonly _atmosphereHeightAboveEarth: LabeledNumericInput;
  private readonly _minDensityHeightBellowEarth: LabeledNumericInput;
  private readonly _densityFalloff: LabeledNumericInput;
  private readonly _scatteringStrength: LabeledNumericInput;
  private readonly _wavelengthR: LabeledNumericInput;
  private readonly _wavelengthG: LabeledNumericInput;
  private readonly _wavelengthB: LabeledNumericInput;
  private readonly _numInScatteringPoints: LabeledNumericInput;
  private readonly _numOpticalDepthPoints: LabeledNumericInput;
  private readonly _brightnessAdaptationStrength: LabeledNumericInput;

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
      displaySettings.atmosphericScattering = AtmosphericScattering.Settings.fromJSON(defaultSettings);
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

    const spanIntensity = document.createElement("span");
    spanIntensity.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanIntensity);
    this._inScatteringIntensity = createLabeledNumericInput({
      id: "atmosphericScattering_inScatteringIntensity",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.inScatteringIntensity = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "inScatteringIntensity: ",
    });
    this._outScatteringIntensity = createLabeledNumericInput({
      id: "atmosphericScattering_outScatteringIntensity",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.outScatteringIntensity = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "outScatteringIntensity: ",
    });
    this._brightnessAdaptationStrength = createLabeledNumericInput({
      id: "atmosphericScattering_brightnessAdaptationStrength",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.brightnessAdaptationStrength = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 0.1,
      parseAsFloat: true,
      name: "brightness Adaptation Strength: ",
    });

    const spanAtmosphereScale = document.createElement("span");
    spanAtmosphereScale.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanAtmosphereScale);
    this._atmosphereHeightAboveEarth = createLabeledNumericInput({
      id: "atmosphericScattering_atmosphereHeightAboveEarth",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.atmosphereHeightAboveEarth = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Atmosphere Height Above Earth: ",
    });
    this._minDensityHeightBellowEarth = createLabeledNumericInput({
      id: "atmosphericScattering_minDensityHeightBellowEarth",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.minDensityHeightBelowEarth = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 1.0,
      parseAsFloat: true,
      name: "Min Density Height Below Earth ",
    });

    const spanScattering = document.createElement("span");
    spanScattering.style.display = "flex";
    atmosphericScatteringControlsDiv.appendChild(spanScattering);
    this._scatteringStrength = createLabeledNumericInput({
      id: "atmosphericScattering_scatteringStrength",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
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

    this._wavelengthR = createLabeledNumericInput({
      id: "atmosphericScattering_wavelengthR",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelengths!;
        wavelenghts.r = value;
        props.wavelengths = wavelenghts;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 10,
      parseAsFloat: true,
      name: "Wavelength R: ",
    });
    this._wavelengthR.div.style.marginRight = "0.5em";

    this._wavelengthG = createLabeledNumericInput({
      id: "atmosphericScattering_wavelengthG",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelengths!;
        wavelenghts.g = value;
        props.wavelengths = wavelenghts;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 10,
      parseAsFloat: true,
      name: "G: ",
    });
    this._wavelengthG.div.style.marginRight = "0.5em";

    this._wavelengthB = createLabeledNumericInput({
      id: "atmosphericScattering_wavelengthB",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        const wavelenghts = props.wavelengths!;
        wavelenghts.b = value;
        props.wavelengths = wavelenghts;
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
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
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
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
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
      handler: (value, _) => this.updateAtmosphericScattering((view): AtmosphericScattering.Props => {
        const props = this.getAtmosphericScatteringSettingsProps(view);
        props.numOpticalDepthPoints = value;
        return props;
      }),
      min: 1,
      max: 20,
      step: 1,
      name: "Optical Depth Points: ",
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

  private getAtmosphericScatteringSettings(view: ViewState): AtmosphericScattering.Settings {
    assert(view.is3d());
    return view.displayStyle.settings.atmosphericScattering;
  }

  private getAtmosphericScatteringSettingsProps(view: ViewState): AtmosphericScattering.Props {
    return this.getAtmosphericScatteringSettings(view).toJSON();
  }

  private updateAtmosphericScatteringUI(view: ViewState) {
    const settings = this.getAtmosphericScatteringSettings(view);

    this._inScatteringIntensity.input.value = settings.inScatteringIntensity.toString();
    this._outScatteringIntensity.input.value = settings.outScatteringIntensity.toString();

    this._atmosphereHeightAboveEarth.input.value = settings.atmosphereHeightAboveEarth.toString();
    this._minDensityHeightBellowEarth.input.value = settings.minDensityHeightBelowEarth.toString();
    this._densityFalloff.input.value = settings.densityFalloff.toString();
    this._scatteringStrength.input.value = settings.scatteringStrength.toString();
    this._wavelengthR.input.value = settings.wavelengths.r.toString();
    this._wavelengthG.input.value = settings.wavelengths.g.toString();
    this._wavelengthB.input.value = settings.wavelengths.b.toString();
    this._numInScatteringPoints.input.value = settings.numInScatteringPoints.toString();
    this._numOpticalDepthPoints.input.value = settings.numOpticalDepthPoints.toString();
  }

  private updateAtmosphericScattering(updateFunction: (view: ViewState) => AtmosphericScattering.Props) {
    const props = updateFunction(this._vp.view);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.atmosphericScattering = AtmosphericScattering.Settings.fromJSON(props);
    this.sync();
  }

  private resetAtmosphericScattering(): void {
    const atmosphericScattering = AtmosphericScattering.Settings.fromJSON(defaultSettings);
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.atmosphericScattering = atmosphericScattering;
    this.sync();
    this.updateAtmosphericScatteringUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
