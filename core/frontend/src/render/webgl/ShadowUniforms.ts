/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Matrix4d } from "@itwin/core-geometry";
import { ColorDef, RgbColor } from "@itwin/core-common";
import { FloatRgba } from "./FloatRGBA";
import type { UniformHandle } from "./UniformHandle";
import { Matrix4 } from "./Matrix";
import type { SyncToken } from "./Sync";
import { desync, sync } from "./Sync";
import type { Target } from "./Target";

/** Maintains state of uniforms used for applying shadows.
 * @internal
 */
export class ShadowUniforms {
  // The projection matrix depends on the model matrix.
  public syncToken?: SyncToken;
  public syncKey = 0;

  // CPU state
  private readonly _target: Target;
  private _enabled = false;
  private readonly _projectionMatrix = Matrix4d.createIdentity();
  private _color = RgbColor.fromJSON(undefined);
  private _bias = 0;

  // GPU state
  private readonly _projection32 = new Matrix4();
  private readonly _colorAndBias = new FloatRgba();

  // Working variables
  private readonly _scratchModel = Matrix4d.createIdentity();
  private readonly _scratchModelProjection = Matrix4d.createIdentity();

  public constructor(target: Target) {
    this._target = target;
  }

  public update(): void {
    const map = this._target.solarShadowMap;
    if (this._enabled !== map.isEnabled) {
      desync(this);
      this._enabled = map.isEnabled;
    }

    if (!map.isEnabled)
      return;

    const settings = map.settings!;

    if (this._bias !== settings.bias) {
      desync(this);
      this._bias = this._colorAndBias.alpha = settings.bias;
    }

    if (!this._color.equals(settings.color)) {
      desync(this);
      this._color = settings.color;
      this._colorAndBias.setTbgr(ColorDef.computeTbgrFromComponents(settings.color.r, settings.color.g, settings.color.b));
      this._colorAndBias.alpha = this._bias;
    }

    // NB: The projection matrix must be computed later when it is bound because it uses the model matrix.
    const proj = map.projectionMatrix;
    if (!proj.isExactEqual(this._projectionMatrix)) {
      desync(this);
      proj.clone(this._projectionMatrix);
    }
  }

  private computeProjection(): void {
    const branch = this._target.uniforms.branch;
    if (sync(branch, this))
      return;

    // NB: We could decouple from the other uniforms so they don't get invalidated when frustum changes but meh.
    desync(this);

    const proj = this._target.solarShadowMap.projectionMatrix;
    const model = Matrix4d.createTransform(this._target.currentTransform, this._scratchModel);
    const modelProj = proj.multiplyMatrixMatrix(model, this._scratchModelProjection);
    this._projection32.initFromMatrix4d(modelProj);
  }

  public bindColorAndBias(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      this._colorAndBias.bind(uniform);
  }

  public bindProjectionMatrix(uniform: UniformHandle): void {
    this.computeProjection();
    if (!sync(this, uniform))
      uniform.setMatrix4(this._projection32);
  }
}
