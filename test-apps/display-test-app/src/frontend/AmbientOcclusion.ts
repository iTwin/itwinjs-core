/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createButton, createCheckBox, createSlider, Slider } from "@itwin/frontend-devtools";
import { AmbientOcclusion, RenderMode, ViewFlags } from "@itwin/core-common";
import { Viewport, ViewState, ViewState3d } from "@itwin/core-frontend";

export class AmbientOcclusionEditor {
  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;
  private readonly _aoBias: Slider;
  private readonly _aoZLengthCap: Slider;
  private readonly _aoMaxDistance: Slider;
  private readonly _aoIntensity: Slider;
  private readonly _aoTexelStepSize: Slider;
  private readonly _aoBlurDelta: Slider;
  private readonly _aoBlurSigma: Slider;
  private readonly _aoBlurTexelStepSize: Slider;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isAOSupported = (view: ViewState) => view.is3d() && RenderMode.SmoothShade === view.viewFlags.renderMode;
    const isAOEnabled = (view: ViewState) => view.viewFlags.ambientOcclusion;

    const div = document.createElement("div");

    const slidersDiv = document.createElement("div")!;

    const showHideDropDowns = (show: boolean) => {
      const display = show ? "block" : "none";
      slidersDiv.style.display = display;
    };

    const enableAO = (enabled: boolean) => {
      this._vp.viewFlags = this._vp.viewFlags.with("ambientOcclusion", enabled);
      showHideDropDowns(enabled);
      this.sync();
    };

    const checkboxInterface = createCheckBox({
      parent: div,
      handler: (cb) => enableAO(cb.checked),
      name: "Ambient Occlusion",
      id: "cbx_AO",
    });
    const checkbox = checkboxInterface.checkbox;
    const checkboxLabel = checkboxInterface.label;

    this._aoBias = createSlider({
      parent: slidersDiv,
      name: "Bias: ",
      id: "viewAttr_AOBias",
      min: "0.0",
      step: "0.025",
      max: "1.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.bias = parseFloat(slider.value);
      }),
    });

    this._aoZLengthCap = createSlider({
      parent: slidersDiv,
      name: "Length Cap: ",
      id: "viewAttr_AOZLengthCap",
      min: "0.0",
      step: "0.000025",
      max: "0.25",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.zLengthCap = parseFloat(slider.value);
      }),
    });

    this._aoMaxDistance = createSlider({
      parent: slidersDiv,
      name: "Max Distance: ",
      id: "viewAttr_AOMaxDistance",
      min: "1.0",
      step: "10.0",
      max: "2000.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.maxDistance = parseFloat(slider.value);
      }),
    });

    this._aoIntensity = createSlider({
      parent: slidersDiv,
      name: "Intensity: ",
      id: "viewAttr_AOIntensity",
      min: "1.0",
      step: "0.1",
      max: "16.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.intensity = parseFloat(slider.value);
      }),
    });

    this._aoTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Step: ",
      id: "viewAttr_AOTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.texelStepSize = parseFloat(slider.value);
      }),
    });

    this._aoBlurDelta = createSlider({
      parent: slidersDiv,
      name: "Blur Delta: ",
      id: "viewAttr_AOBlurDelta",
      min: "0.5",
      step: "0.0001",
      max: "1.5",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.blurDelta = parseFloat(slider.value);
      }),
    });

    this._aoBlurSigma = createSlider({
      parent: slidersDiv,
      name: "Blur Sigma: ",
      id: "viewAttr_AOBlurSigma",
      min: "0.5",
      step: "0.0001",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.blurSigma = parseFloat(slider.value);
      }),
    });

    this._aoBlurTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Blur Step: ",
      id: "viewAttr_AOBlurTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.blurTexelStepSize = parseFloat(slider.value);
      }),
    });

    const resetButton = createButton({
      parent: slidersDiv,
      id: "viewAttr_AOReset",
      value: "Reset",
      handler: () => this.resetAmbientOcclusion(),
    });
    resetButton.div.style.textAlign = "center";

    this._update = (view) => {
      const visible = isAOSupported(view);
      div.style.display = visible ? "block" : "none";
      if (!visible)
        return;

      checkbox.checked = isAOEnabled(view);
      checkboxLabel.style.fontWeight = checkbox.checked ? "bold" : "500";
      showHideDropDowns(checkbox.checked);

      this.updateAmbientOcclusionUI(view);
    };

    div.appendChild(slidersDiv);

    const hr = document.createElement("hr");
    hr.style.borderColor = "grey";
    div.appendChild(hr);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private updateAmbientOcclusionUI(view: ViewState) {
    const getAOSettings = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings;

    const aoSettings = getAOSettings(view);

    this._aoBias.slider.value = aoSettings.bias.toString();
    this._aoZLengthCap.slider.value = aoSettings.zLengthCap.toString();
    this._aoMaxDistance.slider.value = aoSettings.maxDistance.toString();
    this._aoIntensity.slider.value = aoSettings.intensity.toString();
    this._aoTexelStepSize.slider.value = aoSettings.texelStepSize.toString();
    this._aoBlurDelta.slider.value = aoSettings.blurDelta.toString();
    this._aoBlurSigma.slider.value = aoSettings.blurSigma.toString();
    this._aoBlurTexelStepSize.slider.value = aoSettings.blurTexelStepSize.toString();
  }

  private updateAmbientOcclusion(updateFunction: (aoProps: any) => void) {
    const displayStyleSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings;
    const aoProps = displayStyleSettings.ambientOcclusionSettings.toJSON();
    updateFunction(aoProps);
    displayStyleSettings.ambientOcclusionSettings = AmbientOcclusion.Settings.fromJSON(aoProps);
    this.sync();
  }

  private resetAmbientOcclusion(): void {
    const newAOSettings = AmbientOcclusion.Settings.defaults;
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings = newAOSettings;
    this.sync();
    this.updateAmbientOcclusionUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView();
  }
}
