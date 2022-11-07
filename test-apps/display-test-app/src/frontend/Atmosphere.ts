/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createButton, createCheckBox, createLabeledNumericInput, LabeledNumericInput } from "@itwin/frontend-devtools";
import { Atmosphere } from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

export class AtmosphereEditor {

  private readonly _vp: Viewport;
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

    const isAtmosphereSupported = (view: ViewState) => view.is3d();
    const isAtmosphereEnabled = (view: ViewState) => view.is3d() ? view.getDisplayStyle3d().environment.displayAtmosphere : false;
    const div = document.createElement("div");

    const atmosphereControlsDiv = document.createElement("div")!;

    const showHideControls = (show: boolean) => {
      const display = show ? "block" : "none";
      atmosphereControlsDiv.style.display = display;
    };

    const enableAtmosphere = (enabled: boolean) => {
      const displaySettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings;
      displaySettings.environment = displaySettings.environment.clone({ displayAtmosphere: enabled });
      showHideControls(enabled);
      this.sync();
    };

    const resetButton = createButton({
      parent: atmosphereControlsDiv,
      id: "atmosphere_reset",
      value: "Reset",
      handler: () => this.resetAtmosphere(),
    });
    resetButton.div.style.textAlign = "center";

    const checkboxInterface = createCheckBox({
      parent: div,
      handler: (cb) => enableAtmosphere(cb.checked),
      name: "Atmosphere",
      id: "cbx_Atmosphere",
    });
    const checkbox = checkboxInterface.checkbox;
    const checkboxLabel = checkboxInterface.label;

    const spanIntensity = document.createElement("span");
    spanIntensity.style.display = "flex";
    atmosphereControlsDiv.appendChild(spanIntensity);
    this._inScatteringIntensity = createLabeledNumericInput({
      id: "atmosphere_inScatteringIntensity",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_outScatteringIntensity",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_brightnessAdaptationStrength",
      parent: spanIntensity,
      value: 1.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
    atmosphereControlsDiv.appendChild(spanAtmosphereScale);
    this._atmosphereHeightAboveEarth = createLabeledNumericInput({
      id: "atmosphere_atmosphereHeightAboveEarth",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_minDensityHeightBellowEarth",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
    atmosphereControlsDiv.appendChild(spanScattering);
    this._scatteringStrength = createLabeledNumericInput({
      id: "atmosphere_scatteringStrength",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_wavelengthR",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_wavelengthG",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_wavelengthB",
      parent: spanScattering,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
      id: "atmosphere_densityFalloff",
      parent: atmosphereControlsDiv,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
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
    atmosphereControlsDiv.appendChild(spanSamplePoints);

    this._numInScatteringPoints = createLabeledNumericInput({
      id: "atmosphere_numInScatteringPoints",
      parent: spanSamplePoints,
      value: 10,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.numInScatteringPoints = value;
        return props;
      }),
      min: 1,
      max: 20,
      step: 1,
      name: "InScattering Points: ",
    });

    this._numOpticalDepthPoints = createLabeledNumericInput({
      id: "atmosphere_numOpticalDepthPoints",
      parent: spanSamplePoints,
      value: 10,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.numOpticalDepthPoints = value;
        return props;
      }),
      min: 1,
      max: 20,
      step: 1,
      name: "Optical Depth Points: ",
    });

    this._update = (view) => {
      const visible = isAtmosphereSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isAtmosphereEnabled(view);
      checkboxLabel.style.fontWeight = checkbox.checked ? "bold" : "500";
      showHideControls(checkbox.checked);

      this.updateAtmosphereUI(view);
    };

    div.appendChild(atmosphereControlsDiv);

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    div.appendChild(hr);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private getAtmosphereSettings(view: ViewState): Atmosphere.Settings {
    assert(view.is3d());
    return view.displayStyle.settings.environment.atmosphere;
  }

  private getAtmosphereSettingsProps(view: ViewState): Atmosphere.Props {
    return this.getAtmosphereSettings(view).toJSON();
  }

  private updateAtmosphereUI(view: ViewState) {
    const settings = this.getAtmosphereSettings(view);

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
    this._brightnessAdaptationStrength.input.value = settings.brightnessAdaptationStrength.toString();
  }

  private updateAtmosphere(updateFunction: (view: ViewState) => Atmosphere.Props) {
    const props = updateFunction(this._vp.view);
    assert(this._vp.view.is3d());
    const settings = (this._vp.view).getDisplayStyle3d().settings;
    settings.environment = settings.environment.clone({ atmosphere: Atmosphere.Settings.fromJSON(props) });
    this.sync();
    this.updateAtmosphereUI(this._vp.view);
  }

  private resetAtmosphere(): void {
    this.updateAtmosphere(() => Atmosphere.Settings.defaults);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
