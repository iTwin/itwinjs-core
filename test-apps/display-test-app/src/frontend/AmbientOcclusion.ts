/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  AmbientOcclusion,
  RenderMode,
  ViewFlags,
} from "@bentley/imodeljs-common";
import {
  Viewport,
  ViewState,
  ViewState3d,
} from "@bentley/imodeljs-frontend";
import { createSlider, Slider } from "./Slider";
import { createCheckBox } from "./CheckBox";
import { createButton } from "./Button";

export class AmbientOcclusionEditor {
  private readonly _vp: Viewport;
  private readonly _scratchViewFlags = new ViewFlags();
  private readonly _update: (view: ViewState) => void;
  private readonly _aoBias: Slider;
  private readonly _aoZLengthCap: Slider;
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
    div.appendChild(document.createElement("hr")!);

    const slidersDiv = document.createElement("div")!;

    const showHideDropDowns = (show: boolean) => {
      const display = show ? "block" : "none";
      slidersDiv.style.display = display;
    };

    const enableAO = (enabled: boolean) => {
      const vf = this._vp.viewFlags.clone(this._scratchViewFlags);
      vf.ambientOcclusion = enabled;
      this._vp.viewFlags = vf;
      showHideDropDowns(enabled);
      this.sync();
    };

    const checkbox = createCheckBox({
      parent: div,
      handler: (cb) => enableAO(cb.checked),
      name: "Ambient Occlusion",
      id: "cbx_AO",
    }).checkbox;

    this._aoBias = createSlider({
      parent: slidersDiv,
      name: "Bias: ",
      id: "viewAttr_AOBias",
      min: "0.0",
      step: "0.025",
      max: "1.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(parseFloat(slider.value)),
    });

    this._aoZLengthCap = createSlider({
      parent: slidersDiv,
      name: "Length Cap: ",
      id: "viewAttr_AOZLengthCap",
      min: "0.0",
      step: "0.000025",
      max: "0.25",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, parseFloat(slider.value)),
    });

    this._aoIntensity = createSlider({
      parent: slidersDiv,
      name: "Intensity: ",
      id: "viewAttr_AOIntensity",
      min: "1.0",
      step: "0.1",
      max: "16.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, parseFloat(slider.value)),
    });

    this._aoTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Step: ",
      id: "viewAttr_AOTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurDelta = createSlider({
      parent: slidersDiv,
      name: "Blur Delta: ",
      id: "viewAttr_AOBlurDelta",
      min: "0.5",
      step: "0.0001",
      max: "1.5",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurSigma = createSlider({
      parent: slidersDiv,
      name: "Blur Sigma: ",
      id: "viewAttr_AOBlurSigma",
      min: "0.5",
      step: "0.0001",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, undefined, parseFloat(slider.value)),
    });

    this._aoBlurTexelStepSize = createSlider({
      parent: slidersDiv,
      name: "Blur Step: ",
      id: "viewAttr_AOBlurTexelStepSize",
      min: "1.0",
      step: "0.005",
      max: "5.0",
      value: "0.0",
      handler: (slider) => this.updateAmbientOcclusion(undefined, undefined, undefined, undefined, undefined, undefined, parseFloat(slider.value)),
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
      showHideDropDowns(checkbox.checked);

      this.updateAmbientOcclusionUI(view);
    };

    div.appendChild(slidersDiv);

    parent.appendChild(div);
  }

  public update(view: ViewState): void {
    this._update(view);
  }

  private updateAmbientOcclusionUI(view: ViewState) {
    const getAOSettings = (v: ViewState) => (v as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings;

    const aoSettings = getAOSettings(view);

    this._aoBias!.slider.value = aoSettings.bias!.toString();
    this._aoZLengthCap!.slider.value = aoSettings.zLengthCap!.toString();
    this._aoIntensity!.slider.value = aoSettings.intensity!.toString();
    this._aoTexelStepSize!.slider.value = aoSettings.texelStepSize!.toString();
    this._aoBlurDelta!.slider.value = aoSettings.blurDelta!.toString();
    this._aoBlurSigma!.slider.value = aoSettings.blurSigma!.toString();
    this._aoBlurTexelStepSize!.slider.value = aoSettings.blurTexelStepSize!.toString();
  }

  private updateAmbientOcclusion(newBias?: number, newZLengthCap?: number, newIntensity?: number, newTexelStepSize?: number, newBlurDelta?: number, newBlurSigma?: number, newBlurTexelStepSize?: number): void {
    const oldAOSettings = (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings;
    const newAOSettings = AmbientOcclusion.Settings.fromJSON({
      bias: newBias !== undefined ? newBias : oldAOSettings.bias,
      zLengthCap: newZLengthCap !== undefined ? newZLengthCap : oldAOSettings.zLengthCap,
      intensity: newIntensity !== undefined ? newIntensity : oldAOSettings.intensity,
      texelStepSize: newTexelStepSize !== undefined ? newTexelStepSize : oldAOSettings.texelStepSize,
      blurDelta: newBlurDelta !== undefined ? newBlurDelta : oldAOSettings.blurDelta,
      blurSigma: newBlurSigma !== undefined ? newBlurSigma : oldAOSettings.blurSigma,
      blurTexelStepSize: newBlurTexelStepSize !== undefined ? newBlurTexelStepSize : oldAOSettings.blurTexelStepSize,
    });
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings = newAOSettings;
    this.sync();
  }

  private resetAmbientOcclusion(): void {
    const newAOSettings = AmbientOcclusion.Settings.defaults;
    (this._vp.view as ViewState3d).getDisplayStyle3d().settings.ambientOcclusionSettings = newAOSettings;
    this.sync();
    this.updateAmbientOcclusionUI(this._vp.view);
  }

  private sync(): void {
    this._vp.synchWithView(true);
  }
}
