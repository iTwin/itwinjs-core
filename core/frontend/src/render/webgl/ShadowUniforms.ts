/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Matrix4d, Vector3d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { desync, sync, SyncToken } from "./Sync";
import { Target } from "./Target";
import { FloatRgba } from "./FloatRGBA";
import { SolarShadowMap } from "./SolarShadowMap";
import { Matrix4 } from "./Matrix";
import { UniformHandle } from "./Handle";

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
  private readonly _color = ColorDef.white.clone();
  private _bias = 0;
  private _direction = new Vector3d();

  // GPU state
  private readonly _projection32 = new Matrix4();
  private readonly _colorAndBias = new FloatRgba();
  private readonly _sunDirection32 = new Float32Array(3);

  // Working variables
  private readonly _scratchModel = Matrix4d.createIdentity();
  private readonly _scratchModelProjection = Matrix4d.createIdentity();
  private readonly _scratchDirection = new Vector3d();

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
      settings.color.clone(this._color);
      this._colorAndBias.setColorDef(settings.color);
      this._colorAndBias.alpha = this._bias;
    }

    // NB: The direction and projection matrix must be computed later when they are bound because they use the view and model matrices respectivles.
    const dir = map.direction!;
    if (!this._direction.isExactEqual(dir)) {
      desync(this);
      dir.clone(this._direction);
    }

    const proj = map.projectionMatrix;
    if (!proj.isExactEqual(this._projectionMatrix)) {
      desync(this);
      proj.clone(this._projectionMatrix);
    }
  }

  private computeDirectionAndProjection(): void {
    const branch = this._target.uniforms.branch;
    if (sync(branch, this))
      return;

    // NB: We could decouple from the other uniforms so they don't get invalidated when frustum changes but meh.
    desync(this);

    const proj = this._target.solarShadowMap.projectionMatrix;
    const model = Matrix4d.createTransform(this._target.currentTransform, this._scratchModel);
    const modelProj = proj.multiplyMatrixMatrix(model, this._scratchModelProjection);
    this._projection32.initFromMatrix4d(modelProj);

    const viewDir = this._scratchDirection;
    this._target.uniforms.frustum.viewMatrix.multiplyVector(this._direction, viewDir);
    viewDir.normalizeInPlace();

    this._sunDirection32[0] = -viewDir.x;
    this._sunDirection32[1] = -viewDir.y;
    this._sunDirection32[2] = -viewDir.z;
  }

  public bindColorAndBias(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      this._colorAndBias.bind(uniform);
  }

  public bindSunDirection(uniform: UniformHandle): void {
    this.computeDirectionAndProjection();
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._sunDirection32);
  }

  public bindProjectionMatrix(uniform: UniformHandle): void {
    this.computeDirectionAndProjection();
    if (!sync(this, uniform))
      uniform.setMatrix4(this._projection32);
  }
}
