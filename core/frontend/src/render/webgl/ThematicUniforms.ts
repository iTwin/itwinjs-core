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

/** Maintains state for uniforms related to thematic display.
 * @internal
 */
export class ThematicUniforms implements WebGLDisposable {
  private _texture?: TextureHandle;
  private readonly _range = new Float32Array(2);
  private readonly _axis = new Float32Array(3);

  private _thematicDisplay?: ThematicDisplay;

  public syncKey = 0;

  public get thematicDisplay(): ThematicDisplay | undefined { return this._thematicDisplay; }

  public update(plan: RenderPlan): void {
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

  public bindTexture(uniform: UniformHandle, unit: TextureUnit): void {
    assert(undefined !== this._texture);
    this._texture!.bindSampler(uniform, unit);
  }

  public get isDisposed(): boolean {
    return undefined === this._texture;
  }

  public dispose() {
    this._texture = dispose(this._texture);
  }
}
