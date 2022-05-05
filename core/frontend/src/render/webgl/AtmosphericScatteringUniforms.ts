/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Transform, Vector3d } from "@itwin/core-geometry";
import { AtmosphericScattering } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { desync, sync } from "./Sync";
import { Target } from "./Target";
import { UniformHandle } from "./UniformHandle";

export class AtmosphericScatteringUniforms implements WebGLDisposable {
  private readonly _sunDirection = new Float32Array(3);
  private readonly _earthCenter = new Float32Array(3);
  private _atmosphericScattering?: AtmosphericScattering;
  private _scratchVector = new Vector3d();
  private _atmosphereRadius = 0.0;

  public syncKey = 0;

  public get atmosphericScattering(): AtmosphericScattering | undefined {
    return this._atmosphericScattering;
  }

  public update(target: Target): void {
    const plan = target.plan;
    desync(this);
    if (!(this.atmosphericScattering && plan.atmosphericScattering && this.atmosphericScattering.equals(plan.atmosphericScattering))) {
      this._atmosphericScattering = plan.atmosphericScattering;
    }

    if (!this.atmosphericScattering) {
      return;
    }
    this._updateSunDirection(this.atmosphericScattering.sunDirection, target.uniforms.frustum.viewMatrix);
    this._updateEarthCenter(this.atmosphericScattering.earthCenter, target.uniforms.frustum.viewMatrix);
    this._updateAtmosphereRadius(this.atmosphericScattering.atmosphereRadius);
  }

  private _updateEarthCenter(earthCenter: Vector3d, viewMatrix: Transform) {
    const scratchPoint = viewMatrix.multiplyPoint3d(earthCenter);
    // eslint-disable-next-line no-console
    console.log(this._earthCenter);
    this._earthCenter[0] = scratchPoint.x;
    this._earthCenter[1] = scratchPoint.y;
    this._earthCenter[2] = scratchPoint.z;
  }

  private _updateSunDirection(sunDir: Vector3d, viewMatrix: Transform) {
    viewMatrix.multiplyVector(sunDir, this._scratchVector);
    this._scratchVector.negate(this._scratchVector);
    this._scratchVector.normalizeInPlace();
    this._sunDirection[0] = this._scratchVector.x;
    this._sunDirection[1] = this._scratchVector.y;
    this._sunDirection[2] = this._scratchVector.z;
  }

  private _updateAtmosphereRadius(radius: number) {
    this._atmosphereRadius = radius;
  }

  public bindSunDirection(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._sunDirection);
  }

  public bindEarthCenter(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._earthCenter);
  }

  public bindAtmosphereRadius(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereRadius);
  }

  public get isDisposed(): boolean {
    return true;
  }

  public dispose() {}
}
