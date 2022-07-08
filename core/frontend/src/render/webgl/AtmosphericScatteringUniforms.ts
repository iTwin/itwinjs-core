/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Matrix3d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { AtmosphericScattering } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { desync, sync } from "./Sync";
import { Target } from "./Target";
import { UniformHandle } from "./UniformHandle";
import { RenderPlan } from "../RenderPlan";
import { Matrix3 } from "./Matrix";

export class AtmosphericScatteringUniforms implements WebGLDisposable {
  private readonly _earthCenter = new Vector3d();
  private readonly _earthCenterParam = new Float32Array(3);
  private readonly _earthRotation = new Matrix3d();
  private readonly _earthRadii = new Float32Array(3);
  private _atmosphericScattering?: AtmosphericScattering;
  private _scratchPoint3d = new Point3d();
  private _scratchVector3d = new Vector3d();
  private _scratchMatrix3d = new Matrix3d();
  private _atmosphereRadius = 0.0;
  private _earthRadius = 0.0;
  private _scatteringCoefficients = new Float32Array(3);
  private _densityFalloff = 0.0;
  private _numInScatteringPoints = 0.0;
  private _numOpticalDepthPoints = 0.0;
  private _isPlanar = false;

  private _inverseEllipsoidRotationMatrix = new Matrix3d();
  private _ellipsoidToEye = new Vector3d();
  private _earthScaleMatrix = new Matrix3d();
  private _inverseEarthScaleMatrix = new Matrix3d();
  private _atmosphereScale = 0.0;
  private _atmosphereScaleMatrix = new Matrix3d();
  private _inverseAtmosphereScaleMatrix = new Matrix3d();

  public syncKey = 0;

  public get atmosphericScattering(): AtmosphericScattering | undefined {
    return this._atmosphericScattering;
  }

  public update(target: Target): void {
    const plan = target.plan;
    // eslint-disable-next-line no-console
    console.log(`Globe mode is 3D: ${plan.isGlobeMode3D}`);
    desync(this);
    if (!(this.atmosphericScattering && plan.atmosphericScattering && this.atmosphericScattering.equals(plan.atmosphericScattering))) {
      this._atmosphericScattering = plan.atmosphericScattering;
    }

    if (!this.atmosphericScattering) {
      return;
    }
    // this._updateEarthCenter(plan.globeCenter!, plan.frustum.getRotation()!); // real
    this._updateEarthCenter(this.atmosphericScattering.earthCenter, plan.frustum.getRotation()!); // from settings

    // this._updateEarthRotation(plan.globeRotation);
    this._updateInverseEllipsoidRotationMatrix(plan.globeRotation!, plan.frustum.getRotation()!);
    this._updateEllipsoidToEye();

    // this._updateEarthScaleMatrix(plan.globeRadii!);
    this._updateEarthScaleMatrix(this.atmosphericScattering.earthRadii);
    this._updateInverseEarthScaleMatrix();

    this._updateAtmosphereScale(this.atmosphericScattering.atmosphereScale);
    this._updateAtmosphereScaleMatrix();
    this._updateInverseAtmosphereScaleMatrix();

    // this._updateEarthCenterParam(this.atmosphericScattering.earthCenter, target.uniforms.frustum.viewMatrix);
    // this._updateAtmosphereRadius(this.atmosphericScattering.atmosphereRadius);
    // this._updateEarthRadius(this.atmosphericScattering.earthRadius);
    this._updateDensityFalloff(this.atmosphericScattering.densityFalloff);
    this._updateScatteringCoefficients(this.atmosphericScattering.scatteringStrength, this.atmosphericScattering.wavelenghts);
    this._updateNumInScatteringPoints(this.atmosphericScattering.numInScatteringPoints);
    this._updateNumOpticalDepthPoints(this.atmosphericScattering.numOpticalDepthPoints);
    this._updateIsPlanar(this.atmosphericScattering.isPlanar);
  }

  private _updateEllipsoidToEye() {
    this._earthCenter.negate(this._scratchVector3d);
    this._inverseEllipsoidRotationMatrix.multiplyVector(this._scratchVector3d, this._ellipsoidToEye);
    // eslint-disable-next-line no-console
    console.log(`EllipsoidToEye: ${this._ellipsoidToEye.toJSON().toString()}`);
  }

  private _updateInverseEllipsoidRotationMatrix(ellipsoidRotation: Matrix3d, viewRotation: Matrix3d) {
    // eslint-disable-next-line no-console
    console.log(`viewRotation: ${viewRotation.toJSON().toString()}`);
    // eslint-disable-next-line no-console
    console.log(`ellipsoidRotation: ${ellipsoidRotation.toJSON().toString()}`);

    viewRotation.inverse(this._scratchMatrix3d);
    ellipsoidRotation.multiplyMatrixInverseMatrix(this._scratchMatrix3d, this._inverseEllipsoidRotationMatrix);
    // eslint-disable-next-line no-console
    console.log(`inverseEllipsoidRotationMatrix: ${ this._inverseEllipsoidRotationMatrix.toJSON().toString()}`);
  }

  public bindInverseEllipsoidRotationMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._inverseEllipsoidRotationMatrix));
  }

  public bindEllipsoidToEye(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._ellipsoidToEye.toArray());
  }

  public bindEarthScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._earthScaleMatrix));
  }

  public bindAtmosphereScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._atmosphereScaleMatrix));
  }

  private _updateInverseEarthScaleMatrix(): void {
    this._earthScaleMatrix.inverse(this._inverseEarthScaleMatrix);
  }

  public bindInverseEarthScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._inverseEarthScaleMatrix));
  }

  public bindInverseAtmosphereScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._inverseAtmosphereScaleMatrix));
  }

  public bindEarthToEyeInverseScaled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._inverseEarthScaleMatrix.multiplyVector(this._ellipsoidToEye, this._scratchVector3d);
      uniform.setUniform3fv(this._scratchVector3d.toArray());
    }
  }

  public bindAtmosphereToEyeInverseScaled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._inverseAtmosphereScaleMatrix.multiplyVector(this._ellipsoidToEye, this._scratchVector3d);
      uniform.setUniform3fv(this._scratchVector3d.toArray());
    }
  }

  private _updateAtmosphereScale(scale: number) {
    this._atmosphereScale = scale;
  }

  private _updateAtmosphereScaleMatrix() {
    this._earthScaleMatrix.scale(1.0 + this._atmosphereScale, this._atmosphereScaleMatrix);
  }

  private _updateInverseAtmosphereScaleMatrix(): void {
    this._atmosphereScaleMatrix.inverse(this._inverseAtmosphereScaleMatrix);
  }

  // private _updateEarthCenterParam(earthCenter: Point3d, viewMatrix: Transform) {
  //   viewMatrix.multiplyPoint3d(earthCenter, this._scratchPoint3d);
  //   this._earthCenterParam[0] = this._scratchPoint3d.x;
  //   this._earthCenterParam[1] = this._scratchPoint3d.y;
  //   this._earthCenterParam[2] = this._scratchPoint3d.z;
  // }

  private _updateEarthCenter(earthCenter: Point3d, viewMatrix: Matrix3d) {
    viewMatrix.multiplyVector(earthCenter, this._earthCenter);
    // eslint-disable-next-line no-console
    console.log(`center: {${this._earthCenter.x},${this._earthCenter.y},${this._earthCenter.z}}`);
  }

  private _updateEarthRotation(earthRotation: Matrix3d | undefined) {
    if (undefined === earthRotation) {
      this._earthRotation.setZero();
    } else {
      this._earthRotation.setFrom(earthRotation);
    }
  }

  private _updateEarthScaleMatrix(earthRadii: Point3d) {
    this._earthScaleMatrix.setAt(0, 0, earthRadii.x);
    this._earthScaleMatrix.setAt(1, 1, earthRadii.y);
    this._earthScaleMatrix.setAt(2, 3, earthRadii.z);
  }

  private _updateAtmosphereRadius(radius: number) {
    this._atmosphereRadius = radius;
  }

  private _updateEarthRadius(radius: number) {
    this._earthRadius = radius;
  }

  private _updateScatteringCoefficients(scatteringStrength: number, wavelenghts: number[]) {
    this._scatteringCoefficients[0] = ((400.0 / wavelenghts[0]) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[1] = ((400.0 / wavelenghts[1]) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[2] = ((400.0 / wavelenghts[2]) ** 4.0) * scatteringStrength;
  }

  private _updateDensityFalloff(densityFalloff: number) {
    this._densityFalloff = densityFalloff;
  }

  private _updateNumInScatteringPoints(numInScatteringPoints: number) {
    this._numInScatteringPoints = numInScatteringPoints;
  }

  private _updateNumOpticalDepthPoints(numOpticalDepthPoints: number) {
    this._numOpticalDepthPoints = numOpticalDepthPoints;
  }

  private _updateIsPlanar(isPlanar: boolean) {
    this._isPlanar = isPlanar;
  }

  public bindEarthCenter(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._earthCenter.toArray());
  }

  public bindEarthCenterParam(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._earthCenterParam);
  }

  public bindEarthRadii(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._earthRadii);
  }

  public bindAtmosphereRadius(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereRadius);
  }

  public bindEarthRadius(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._earthRadius);
  }

  public bindDensityFalloff(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._densityFalloff);
  }

  public bindScatteringCoefficients(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform3fv(this._scatteringCoefficients);
  }

  public bindNumInScatteringPoints(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._numInScatteringPoints);
  }

  public bindNumOpticalDepthPoints(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._numOpticalDepthPoints);
  }

  public bindIsPlanar(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._isPlanar ? 1 : 0);
  }

  public get isDisposed(): boolean {
    return true;
  }

  public dispose() {}
}
