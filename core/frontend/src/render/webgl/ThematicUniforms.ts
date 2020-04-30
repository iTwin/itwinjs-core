/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Gradient, RenderTexture, ThematicDisplay } from "@bentley/imodeljs-common";
import { UniformHandle } from "./Handle";
import { desync, sync } from "./Sync";
import { TextureHandle } from "./Texture";
import { assert, dispose } from "@bentley/bentleyjs-core";
import { RenderPlan } from "../RenderPlan";
import { TextureUnit } from "./RenderFlags";
import { WebGLDisposable } from "./Disposable";
import { ThematicSensors } from "./ThematicSensors";

/** Maintains state for uniforms related to thematic display.
 * @internal
 */
export class ThematicUniforms implements WebGLDisposable {
  private _sensors?: ThematicSensors;
  private _texture?: TextureHandle;
  private readonly _range = new Float32Array(2);
  private readonly _axis = new Float32Array(3);
  private readonly _displayMode = new Float32Array(1);
  private _numSensors: number = 0;

  private _thematicDisplay?: ThematicDisplay;

  public syncKey = 0;

  public get thematicDisplay(): ThematicDisplay | undefined { return this._thematicDisplay; }

  public update(plan: RenderPlan): void {
    if (this.thematicDisplay && plan.thematic && this.thematicDisplay.equals(plan.thematic) && this._texture && this._sensors)
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
    this._numSensors = (undefined === sensorSettings || undefined === sensorSettings.sensors) ? 0 : sensorSettings.sensors.length;

    this._sensors = dispose(this._sensors);
    this._sensors = ThematicSensors.create(sensorSettings);

    const symb = Gradient.Symb.createThematic(this.thematicDisplay.gradientSettings);
    const image = symb.getImage(1, 8192);
    this._texture = TextureHandle.createForImageBuffer(image, RenderTexture.Type.Normal);
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

  public bindNumSensors(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._numSensors);
  }

  public bindSensors(uniform: UniformHandle, unit: TextureUnit): void {
    assert(undefined !== this._sensors);
    this._sensors!.texture.bindSampler(uniform, unit);
  }

  public bindTexture(uniform: UniformHandle, unit: TextureUnit): void {
    assert(undefined !== this._texture);
    this._texture!.bindSampler(uniform, unit);
  }

  public get isDisposed(): boolean {
    return undefined === this._texture && undefined === this._sensors;
  }

  public dispose() {
    this._texture = dispose(this._texture);
    this._sensors = dispose(this._sensors);
  }
}
