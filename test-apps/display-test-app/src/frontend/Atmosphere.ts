/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createButton, createCheckBox, createLabeledNumericInput, createNestedMenu, LabeledNumericInput } from "@itwin/frontend-devtools";
import { Atmosphere } from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

export class AtmosphereEditor {

  private readonly _vp: Viewport;
  private readonly _update: (view: ViewState) => void;

  private static _expandAtmosphereEditor = false;

  private readonly _atmosphereHeightAboveEarth: LabeledNumericInput;
  private readonly _depthBelowEarthForMaxDensity: LabeledNumericInput;
  private readonly _densityFalloff: LabeledNumericInput;
  private readonly _scatteringStrength: LabeledNumericInput;
  private readonly _wavelengthR: LabeledNumericInput;
  private readonly _wavelengthG: LabeledNumericInput;
  private readonly _wavelengthB: LabeledNumericInput;
  private readonly _numViewRaySamples: LabeledNumericInput;
  private readonly _numSunRaySamples: LabeledNumericInput;
  private readonly _exposure: LabeledNumericInput;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isAtmosphereSupported = (view: ViewState) => view.is3d();
    const isAtmosphereEnabled = (view: ViewState) => view.is3d() ? view.getDisplayStyle3d().environment.displayAtmosphere : false;

    const atmosphereMenu = createNestedMenu({
      id: "atmosphere_menu",
      label: "Atmosphere",
      parent,
      // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
      expand: AtmosphereEditor._expandAtmosphereEditor,
      handler: (expanded) => {
        AtmosphereEditor._expandAtmosphereEditor = expanded;
        atmosphereMenu.label.style.fontWeight = expanded ? "bold" : "500";
      },
    });
    (atmosphereMenu.div.firstElementChild!.lastElementChild! as HTMLElement).style.borderColor = "grey";
    atmosphereMenu.label.style.fontWeight = AtmosphereEditor._expandAtmosphereEditor ? "bold" : "500";

    const checkboxInterface = createCheckBox({
      parent: atmosphereMenu.body,
      handler: (cb) => enableAtmosphere(cb.checked),
      name: "Enable Atmosphere",
      id: "cbx_Atmosphere",
    });
    const checkbox = checkboxInterface.checkbox;
    const checkboxLabel = checkboxInterface.label;

    const atmosphereControlsDiv = document.createElement("div");
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

    const spanIntensity = document.createElement("span");
    spanIntensity.style.display = "flex";
    atmosphereControlsDiv.appendChild(spanIntensity);
    this._exposure = createLabeledNumericInput({
      id: "atmosphere_exposure",
      parent: spanIntensity,
      value: 2.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.exposure = value;
        return props;
      }),
      min: 0.0,
      max: 1000.0,
      step: 0.1,
      parseAsFloat: true,
      name: "Exposure: ",
    });

    const spanAtmosphereScale = document.createElement("span");
    spanAtmosphereScale.style.display = "flex";
    atmosphereControlsDiv.appendChild(spanAtmosphereScale);
    this._atmosphereHeightAboveEarth = createLabeledNumericInput({
      id: "atmosphere_atmosphereHeightAboveEarth",
      parent: spanAtmosphereScale,
      value: 100000.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.atmosphereHeightAboveEarth = value;
        return props;
      }),
      min: 0.0,
      max: 1000000.0,
      step: 10000.0,
      parseAsFloat: true,
      name: "Atmosphere Height Above Earth: ",
    });
    this._depthBelowEarthForMaxDensity = createLabeledNumericInput({
      id: "atmosphere_depthBelowEarthForMaxDensity",
      parent: spanAtmosphereScale,
      value: 0.0,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.depthBelowEarthForMaxDensity = value;
        return props;
      }),
      min: 0.0,
      max: 1000000.0,
      step: 10000.0,
      parseAsFloat: true,
      name: "Depth Below Earth For Max Density",
    });

    const spanScattering = document.createElement("span");
    spanScattering.style.display = "flex";
    atmosphereControlsDiv.appendChild(spanScattering);
    this._scatteringStrength = createLabeledNumericInput({
      id: "atmosphere_scatteringStrength",
      parent: spanScattering,
      value: 100.0,
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
      value: 700.0,
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
      value: 530.0,
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
      value: 400.0,
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
      value: 10.0,
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

    this._numViewRaySamples = createLabeledNumericInput({
      id: "atmosphere_numViewRaySamples",
      parent: spanSamplePoints,
      value: 10,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.numViewRaySamples = value;
        return props;
      }),
      min: 1,
      max: 40,
      step: 1,
      name: "# Samples per View Ray: ",
    });

    this._numSunRaySamples = createLabeledNumericInput({
      id: "atmosphere_numSunRaySamples",
      parent: spanSamplePoints,
      value: 5,
      handler: (value, _) => this.updateAtmosphere((view): Atmosphere.Props => {
        const props = this.getAtmosphereSettingsProps(view);
        props.numSunRaySamples = value;
        return props;
      }),
      min: 1,
      max: 40,
      step: 1,
      name: "# Samples per Sun Ray: ",
    });

    this._update = (view) => {
      const visible = isAtmosphereSupported(view);
      atmosphereMenu.div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isAtmosphereEnabled(view);
      checkboxLabel.style.fontWeight = checkbox.checked ? "bold" : "500";
      showHideControls(checkbox.checked);

      this.updateAtmosphereUI(view);
    };

    atmosphereMenu.body.appendChild(atmosphereControlsDiv);

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    atmosphereMenu.body.appendChild(hr);
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

    this._atmosphereHeightAboveEarth.input.value = settings.atmosphereHeightAboveEarth.toString();
    this._depthBelowEarthForMaxDensity.input.value = settings.depthBelowEarthForMaxDensity.toString();
    this._densityFalloff.input.value = settings.densityFalloff.toString();
    this._scatteringStrength.input.value = settings.scatteringStrength.toString();
    this._wavelengthR.input.value = settings.wavelengths.r.toString();
    this._wavelengthG.input.value = settings.wavelengths.g.toString();
    this._wavelengthB.input.value = settings.wavelengths.b.toString();
    this._numViewRaySamples.input.value = settings.numViewRaySamples.toString();
    this._numSunRaySamples.input.value = settings.numSunRaySamples.toString();
    this._exposure.input.value = settings.exposure.toString();
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
