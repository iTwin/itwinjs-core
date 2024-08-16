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
  private readonly _angleOffset: Slider;
  private readonly _spacialOffset: Slider;
  private readonly _c1: Slider;
  private readonly _c2: Slider;
  private readonly _ssaoLimit: Slider;
  private readonly _ssaoSamples: Slider;
  private readonly _ssaoRadius: Slider;
  private readonly _ssaoFalloff: Slider;
  private readonly _ssaoThicknessMix: Slider;
  private readonly _ssaoMaxStride: Slider;
  private readonly _aoMaxDistance: Slider;
  private readonly _aoBlurDelta: Slider;
  private readonly _aoBlurSigma: Slider;
  private readonly _aoBlurTexelStepSize: Slider;

  public constructor(vp: Viewport, parent: HTMLElement) {
    this._vp = vp;

    const isAOSupported = (view: ViewState) => view.is3d() && RenderMode.SmoothShade === view.viewFlags.renderMode;
    const isAOEnabled = (view: ViewState) => view.viewFlags.ambientOcclusion;

    const div = document.createElement("div");

    const slidersDiv = document.createElement("div");

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

    this._angleOffset = createSlider({
      parent: slidersDiv,
      name: "Angle Offset: ",
      id: "viewAttr_AngleOffset",
      min: "0.0",
      step: "0.1",
      max: "6.283", // 2 * PI for full circle
      value: "0.0",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.angleOffset = parseFloat(slider.value);
      }),
    });

    this._spacialOffset = createSlider({
      parent: slidersDiv,
      name: "Spacial Offset: ",
      id: "viewAttr_SpacialOffset",
      min: "0.0",
      step: "0.1",
      max: "10.0",
      value: "0.0",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.spacialOffset = parseFloat(slider.value);
      }),
    });

    this._c1 = createSlider({
      parent: slidersDiv,
      name: "C1: ",
      id: "viewAttr_C1",
      min: "-1.0",
      step: "0.1",
      max: "1.0",
      value: "-1.0",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.c1 = parseFloat(slider.value);
      }),
    });

    this._c2 = createSlider({
      parent: slidersDiv,
      name: "C2: ",
      id: "viewAttr_C2",
      min: "-1.0",
      step: "0.1",
      max: "1.0",
      value: "-1.0",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.c2 = parseFloat(slider.value);
      }),
    });

    this._ssaoLimit = createSlider({
      parent: slidersDiv,
      name: "SSAO Limit: ",
      id: "viewAttr_SSAOLimit",
      min: "10",
      step: "10",
      max: "500",
      value: "100",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoLimit = parseInt(slider.value, 10);
      }),
    });

    this._ssaoSamples = createSlider({
      parent: slidersDiv,
      name: "SSAO Samples: ",
      id: "viewAttr_SSAOSamples",
      min: "1",
      step: "1",
      max: "16",
      value: "4",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoSamples = parseInt(slider.value, 10);
      }),
    });

    this._ssaoRadius = createSlider({
      parent: slidersDiv,
      name: "SSAO Radius: ",
      id: "viewAttr_SSAORadius",
      min: "0.1",
      step: "0.1",
      max: "10.0",
      value: "2.5",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoRadius = parseFloat(slider.value);
      }),
    });

    this._ssaoFalloff = createSlider({
      parent: slidersDiv,
      name: "SSAO Falloff: ",
      id: "viewAttr_SSAOFalloff",
      min: "0.1",
      step: "0.1",
      max: "5.0",
      value: "1.5",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoFalloff = parseFloat(slider.value);
      }),
    });

    this._ssaoThicknessMix = createSlider({
      parent: slidersDiv,
      name: "SSAO Thickness Mix: ",
      id: "viewAttr_SSAOThicknessMix",
      min: "0.0",
      step: "0.1",
      max: "1.0",
      value: "0.2",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoThicknessMix = parseFloat(slider.value);
      }),
    });

    this._ssaoMaxStride = createSlider({
      parent: slidersDiv,
      name: "SSAO Max Stride: ",
      id: "viewAttr_SSAOMaxStride",
      min: "1",
      step: "1",
      max: "100",
      value: "1",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.ssaoMaxStride = parseInt(slider.value, 10);
      }),
    });

    this._aoMaxDistance = createSlider({
      parent: slidersDiv,
      name: "Max Distance: ",
      id: "viewAttr_AOMaxDistance",
      min: "1.0",
      step: "10.0",
      max: "50000.0",
      value: "0.0",
      readout: "right",
      handler: (slider) => this.updateAmbientOcclusion((aoProps) => {
        aoProps.maxDistance = parseFloat(slider.value);
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
      readout: "right",
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
      readout: "right",
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
      readout: "right",
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

    this._angleOffset.slider.value = this._angleOffset.readout.innerText = aoSettings.angleOffset.toString();
    this._spacialOffset.slider.value = this._spacialOffset.readout.innerText = aoSettings.spacialOffset.toString();
    this._c1.slider.value = this._c1.readout.innerText = aoSettings.c1.toString();
    this._c2.slider.value = this._c2.readout.innerText = aoSettings.c2.toString();
    this._ssaoLimit.slider.value = this._ssaoLimit.readout.innerText = aoSettings.ssaoLimit.toString();
    this._ssaoSamples.slider.value = this._ssaoSamples.readout.innerText = aoSettings.ssaoSamples.toString();
    this._ssaoRadius.slider.value = this._ssaoRadius.readout.innerText = aoSettings.ssaoRadius.toString();
    this._ssaoFalloff.slider.value = this._ssaoFalloff.readout.innerText = aoSettings.ssaoFalloff.toString();
    this._ssaoThicknessMix.slider.value = this._ssaoThicknessMix.readout.innerText = aoSettings.ssaoThicknessMix.toString();
    this._ssaoMaxStride.slider.value = this._ssaoMaxStride.readout.innerText = aoSettings.ssaoMaxStride.toString();
    this._aoMaxDistance.slider.value = this._aoMaxDistance.readout.innerText = aoSettings.maxDistance.toString();
    this._aoBlurDelta.slider.value = this._aoBlurDelta.readout.innerText = aoSettings.blurDelta.toString();
    this._aoBlurSigma.slider.value = this._aoBlurSigma.readout.innerText = aoSettings.blurSigma.toString();
    this._aoBlurTexelStepSize.slider.value = this._aoBlurTexelStepSize.readout.innerText = aoSettings.blurTexelStepSize.toString();
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
