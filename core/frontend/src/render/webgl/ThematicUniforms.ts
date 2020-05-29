/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Gradient, RenderTexture, ThematicDisplay } from "@bentley/imodeljs-common";
import { WebGLDisposable } from "./Disposable";
import { UniformHandle } from "./Handle";
import { TextureUnit } from "./RenderFlags";
import { desync, sync } from "./Sync";
import { TextureHandle } from "./Texture";
import { ThematicSensors } from "./ThematicSensors";
import { Range3d } from "@bentley/geometry-core";
import { Target } from "./Target";
import { System } from "./System";

/** Maintains state for uniforms related to thematic display.
 * @internal
 */
export class ThematicUniforms implements WebGLDisposable {
  private _sensors?: ThematicSensors; // NB: This is only used if no distance cutoff is applied (this is shared among all batches)
  private _texture?: TextureHandle;
  private readonly _range = new Float32Array(2);
  private readonly _axis = new Float32Array(3);
  private readonly _displayMode = new Float32Array(1);
  private readonly _distanceCutoff = new Float32Array(1);
  private _numSensors: number = 0;
  private _gradientDimension = _getGradientDimension();

  private _thematicDisplay?: ThematicDisplay;

  public syncKey = 0;

  public get thematicDisplay(): ThematicDisplay | undefined {
    return this._thematicDisplay;
  }

  public get wantGlobalSensorTexture(): boolean {
    return !(this._distanceCutoff[0] > 0);
  }

  public get bytesUsed(): number {
    return this._sensors ? this._sensors.bytesUsed : 0;
  }

  public update(target: Target): void {
    const plan = target.plan;

    if (this.thematicDisplay && plan.thematic && this.thematicDisplay.equals(plan.thematic) && this._texture)
      return;

    desync(this);

    this._thematicDisplay = plan.thematic;
    this._texture = dispose(this._texture);
    if (!this.thematicDisplay)
      return;

    this._range[0] = this.thematicDisplay.range.low;
    this._range[1] = this.thematicDisplay.range.high;

    this._axis[0] = this.thematicDisplay.axis.x;
    this._axis[1] = this.thematicDisplay.axis.y;
    this._axis[2] = this.thematicDisplay.axis.z;

    this._displayMode[0] = this.thematicDisplay.displayMode;

    const sensorSettings = this.thematicDisplay.sensorSettings;
    this._distanceCutoff[0] = (undefined === sensorSettings) ? 0 : this.thematicDisplay.sensorSettings.distanceCutoff;

    // If we want sensors and have no distance cutoff, then create a global shared sensor texture.
    if (target.wantThematicSensors && !(this._distanceCutoff[0] > 0)) {
      this._numSensors = sensorSettings.sensors.length;
      this._sensors = dispose(this._sensors);
      this._sensors = ThematicSensors.create(target, Range3d.createNull());
    }

    const symb = Gradient.Symb.createThematic(this.thematicDisplay.gradientSettings);
    const image = symb.getImage(1, this._gradientDimension);
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

  public bindDisplayMode(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1fv(this._displayMode);
  }

  public bindDistanceCutoff(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1fv(this._distanceCutoff);
  }

  public bindTexture(uniform: UniformHandle, unit: TextureUnit): void {
    assert(undefined !== this._texture);
    this._texture!.bindSampler(uniform, unit);
  }

  public bindNumSensors(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._numSensors);
  }

  public bindSensors(uniform: UniformHandle): void {
    assert(undefined !== this._sensors);
    this._sensors!.texture.bindSampler(uniform, TextureUnit.ThematicSensors);
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
