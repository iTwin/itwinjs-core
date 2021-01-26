/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Gradient, RenderTexture, ThematicDisplay, ThematicDisplayMode, ThematicGradientMode } from "@bentley/imodeljs-common";
import { WebGLDisposable } from "./Disposable";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { desync, sync } from "./Sync";
import { TextureHandle } from "./Texture";
import { ThematicSensors } from "./ThematicSensors";
import { Angle, Range3d, Transform, Vector3d } from "@bentley/geometry-core";
import { Target } from "./Target";
import { System } from "./System";
import { FloatRgb } from "./FloatRGBA";

/** Maintains state for uniforms related to thematic display.
 * @internal
 */
export class ThematicUniforms implements WebGLDisposable {
  private _sensors?: ThematicSensors; // NB: This is only used if no distance cutoff is applied (this is shared among all batches)
  private _texture?: TextureHandle;
  private readonly _range = new Float32Array(2);
  private _colorMix = 0.0;
  private readonly _axis = new Float32Array(3);
  private readonly _sunDirection = new Float32Array(3);
  private readonly _marginColor = new Float32Array(3);
  private readonly _displayMode = new Float32Array(1);
  private readonly _fragSettings = new Float32Array(3); // gradientMode, distanceCutoff, stepCount
  private _numSensors = 0;
  private _gradientDimension = _getGradientDimension();
  private _thematicDisplay?: ThematicDisplay;

  public syncKey = 0;

  private get _distanceCutoff(): number { return this._fragSettings[1]; }

  public get thematicDisplay(): ThematicDisplay | undefined {
    return this._thematicDisplay;
  }

  public get wantIsoLines(): boolean {
    if (undefined !== this.thematicDisplay)
      return ThematicDisplayMode.Height === this._displayMode[0] && ThematicGradientMode.IsoLines === this.thematicDisplay.gradientSettings.mode;
    return false;
  }

  public get wantSlopeMode(): boolean {
    return (undefined !== this.thematicDisplay) ? ThematicDisplayMode.Slope === this._displayMode[0] : false;
  }

  public get wantHillShadeMode(): boolean {
    return (undefined !== this.thematicDisplay) ? ThematicDisplayMode.HillShade === this._displayMode[0] : false;
  }

  public get wantGlobalSensorTexture(): boolean {
    return !(this._distanceCutoff > 0);
  }

  public get bytesUsed(): number {
    return this._sensors ? this._sensors.bytesUsed : 0;
  }

  private _scratchVector = new Vector3d();

  private _updateAxis(axis: Vector3d, viewMatrix?: Transform) {
    const tAxis = (viewMatrix !== undefined) ? viewMatrix.multiplyVector(axis, this._scratchVector) : axis;
    tAxis.normalizeInPlace();
    this._axis[0] = tAxis.x;
    this._axis[1] = tAxis.y;
    this._axis[2] = tAxis.z;
  }

  private _updateSunDirection(sunDir: Vector3d, viewMatrix: Transform) {
    viewMatrix.multiplyVector(sunDir, this._scratchVector);
    this._scratchVector.negate(this._scratchVector);
    this._scratchVector.normalizeInPlace();
    this._sunDirection[0] = this._scratchVector.x;
    this._sunDirection[1] = this._scratchVector.y;
    this._sunDirection[2] = this._scratchVector.z;
  }

  public update(target: Target): void {
    const plan = target.plan;

    if (this.thematicDisplay && plan.thematic && this.thematicDisplay.equals(plan.thematic) && this._texture) {
      if (undefined !== this._sensors)
        this._sensors.update(target.uniforms.frustum.viewMatrix);

      if (ThematicDisplayMode.Slope === this.thematicDisplay.displayMode) {
        this._updateAxis(this.thematicDisplay.axis, target.uniforms.frustum.viewMatrix);
        desync(this);
      } else if (ThematicDisplayMode.HillShade === this.thematicDisplay.displayMode) {
        this._updateSunDirection(this.thematicDisplay.sunDirection, target.uniforms.frustum.viewMatrix);
        desync(this);
      }

      return;
    }

    desync(this);

    this._thematicDisplay = plan.thematic;
    this._texture = dispose(this._texture);
    if (!this.thematicDisplay)
      return;

    if (ThematicDisplayMode.Slope === this.thematicDisplay.displayMode) {
      this._range[0] = Angle.degreesToRadians(this.thematicDisplay.range.low);
      this._range[1] = Angle.degreesToRadians(this.thematicDisplay.range.high);
    } else {
      this._range[0] = this.thematicDisplay.range.low;
      this._range[1] = this.thematicDisplay.range.high;
    }

    this._colorMix = this.thematicDisplay.gradientSettings.colorMix;

    this._updateAxis(this.thematicDisplay.axis, (ThematicDisplayMode.Slope === this.thematicDisplay.displayMode) ? target.uniforms.frustum.viewMatrix : undefined);

    if (ThematicDisplayMode.HillShade === this.thematicDisplay.displayMode)
      this._updateSunDirection(this.thematicDisplay.sunDirection, target.uniforms.frustum.viewMatrix);

    const marginRgb = FloatRgb.fromColorDef(this.thematicDisplay.gradientSettings.marginColor);
    this._marginColor[0] = marginRgb.red;
    this._marginColor[1] = marginRgb.green;
    this._marginColor[2] = marginRgb.blue;

    this._displayMode[0] = this.thematicDisplay.displayMode;

    this._fragSettings[0] = this.thematicDisplay.gradientSettings.mode;

    const sensorSettings = this.thematicDisplay.sensorSettings;
    this._fragSettings[1] = (undefined === sensorSettings) ? 0 : this.thematicDisplay.sensorSettings.distanceCutoff;

    this._fragSettings[2] = Math.min(this.thematicDisplay.gradientSettings.stepCount, this._gradientDimension);

    // If we want sensors and have no distance cutoff, then create a global shared sensor texture.
    if (target.wantThematicSensors && !(this._distanceCutoff > 0)) {
      this._numSensors = sensorSettings.sensors.length;
      this._sensors = dispose(this._sensors);
      this._sensors = ThematicSensors.create(target, Range3d.createNull());
    }

    const symb = Gradient.Symb.createThematic(this.thematicDisplay.gradientSettings);
    const image = symb.getThematicImageForRenderer(this._gradientDimension);
    this._texture = TextureHandle.createForImageBuffer(image, RenderTexture.Type.ThematicGradient);
  }

  public bindRange(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform2fv(this._range);
  }

  public bindAxis(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._axis);
  }

  public bindSunDirection(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._sunDirection);
  }

  public bindMarginColor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._marginColor);
  }

  public bindDisplayMode(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1fv(this._displayMode);
  }

  public bindFragSettings(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._fragSettings);
  }

  public bindTexture(uniform: UniformHandle, unit: TextureUnit): void {
    assert(undefined !== this._texture);
    this._texture.bindSampler(uniform, unit);
  }

  public bindNumSensors(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._numSensors);
  }

  public bindSensors(uniform: UniformHandle): void {
    assert(undefined !== this._sensors);
    this._sensors.texture.bindSampler(uniform, TextureUnit.ThematicSensors);
  }

  public get isDisposed(): boolean {
    return undefined === this._texture && undefined === this._sensors;
  }

  public dispose() {
    this._texture = dispose(this._texture);
    this._sensors = dispose(this._sensors);
  }
}

function _getGradientDimension(): number {
  const preferDimension = 8192;
  const maxDimension = System.instance.capabilities.maxTextureSize;
  return (preferDimension > maxDimension) ? maxDimension : preferDimension;
}
