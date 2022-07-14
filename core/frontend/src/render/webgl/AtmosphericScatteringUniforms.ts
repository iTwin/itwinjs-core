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
import { Matrix3 } from "./Matrix";

export class AtmosphericScatteringUniforms implements WebGLDisposable {
  private readonly _earthCenter = new Point3d();
  private readonly _ellipsoidRotationMatrix = new Matrix3d();
  private readonly _earthRadii = new Point3d();
  private _atmosphericScattering?: AtmosphericScattering;
  // private _scratchPoint3d = new Point3d();
  private _scratchVector3d = new Vector3d();
  private _scratchMatrix3d = new Matrix3d();
  private _scatteringCoefficients = new Float32Array(3);
  private _densityFalloff = 0.0;
  private _numInScatteringPoints = 0.0;
  private _numOpticalDepthPoints = 0.0;
  private _isPlanar = false;

  private _inverseEllipsoidRotationMatrix = new Matrix3d();
  private _ellipsoidToEye = new Vector3d();
  private _earthScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _atmosphereScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _minDensityScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));

  public syncKey = 0;
  private _minDensityToAtmosphereScaleFactor: any;

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

    this._updateEarthCenter(this.atmosphericScattering.earthCenter, target.uniforms.frustum.viewMatrix); // real
    this._updateEllipsoidRotationMatrix(plan.globeRotation!);
    this._updateInverseEllipsoidRotationMatrix(plan.globeRotation!, target.uniforms.frustum.viewMatrix.matrix);
    this._updateEllipsoidToEye();
    this._updateEarthScaleMatrix(this.atmosphericScattering.earthRadii);
    this._updateAtmosphereScaleMatrix(this.atmosphericScattering.earthRadii.z, this.atmosphericScattering.atmosphereHeightAboveEarth);
    this._updateMinDensityScaleMatrix(this.atmosphericScattering.earthRadii.z, this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateMinDensityToAtmosphereScaleFactor(this.atmosphericScattering.earthRadii.z, this.atmosphericScattering.atmosphereHeightAboveEarth, this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateDensityFalloff(this.atmosphericScattering.densityFalloff);
    this._updateScatteringCoefficients(this.atmosphericScattering.scatteringStrength, this.atmosphericScattering.wavelengths);
    this._updateNumInScatteringPoints(this.atmosphericScattering.numInScatteringPoints);
    this._updateNumOpticalDepthPoints(this.atmosphericScattering.numOpticalDepthPoints);
    this._updateIsPlanar(this.atmosphericScattering.isPlanar);
  }

  private _updateEllipsoidToEye() {
    Vector3d.createFrom(this._earthCenter, this._scratchVector3d);
    this._scratchVector3d.negate(this._scratchVector3d);
    this._inverseEllipsoidRotationMatrix.multiplyVector(this._scratchVector3d, this._ellipsoidToEye);
  }

  private _updateInverseEllipsoidRotationMatrix(ellipsoidRotation: Matrix3d, viewRotation: Matrix3d) {
    viewRotation.inverse(this._scratchMatrix3d);
    ellipsoidRotation.multiplyMatrixInverseMatrix(this._scratchMatrix3d, this._inverseEllipsoidRotationMatrix);
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

  public bindInverseEarthScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._earthScaleMatrix.inverse()!));
  }

  public bindInverseAtmosphereScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._atmosphereScaleMatrix.inverse()!));
  }

  public bindMinDensityScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._minDensityScaleMatrix));
  }

  public bindInverseMinDensityScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._minDensityScaleMatrix.inverse()!));
  }

  public bindEarthToEyeInverseScaled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._earthScaleMatrix.multiplyInverse(this._ellipsoidToEye, this._scratchVector3d);
      uniform.setUniform3fv(this._scratchVector3d.toArray());
    }
  }

  public bindAtmosphereToEyeInverseScaled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._atmosphereScaleMatrix.multiplyInverse(this._ellipsoidToEye, this._scratchVector3d);
      uniform.setUniform3fv(this._scratchVector3d.toArray());
    }
  }

  private _updateMinDensityToAtmosphereScaleFactor(earthMinRadius: number, atmosphereHeightAboveEarth: number, minDensityHeightBelowEarth: number) {
    this._minDensityToAtmosphereScaleFactor = earthMinRadius === 0 ? 1.0 : earthMinRadius + atmosphereHeightAboveEarth / earthMinRadius - minDensityHeightBelowEarth;
  }

  public bindMinDensityToAtmosphereScaleFactor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._minDensityToAtmosphereScaleFactor);
  }

  private _updateAtmosphereScaleMatrix(earthMinRadius: number, heightAboveSurface: number) {
    const scaleFactor = earthMinRadius === 0 ? 1.0 : (earthMinRadius + heightAboveSurface) / earthMinRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._atmosphereScaleMatrix);
    this._atmosphereScaleMatrix.computeCachedInverse(true);
  }

  private _updateMinDensityScaleMatrix(earthMinRadius: number, heightBellowSurface: number) {
    const scaleFactor = earthMinRadius === 0 ? 1.0 : (earthMinRadius - heightBellowSurface) / earthMinRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._minDensityScaleMatrix);
    this._minDensityScaleMatrix.computeCachedInverse(true);
  }

  private _updateEarthCenter(earthCenter: Point3d, viewMatrix: Transform) {
    viewMatrix.multiplyPoint3d(earthCenter, this._earthCenter);
  }

  private _updateEllipsoidRotationMatrix(earthRotation: Matrix3d) {
    this._ellipsoidRotationMatrix.setFrom(earthRotation);
  }

  public bindEllipsoidRotationMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._ellipsoidRotationMatrix));
  }

  private _updateEarthScaleMatrix(earthRadii: Point3d) {
    this._earthScaleMatrix.setAt(0, 0, earthRadii.x);
    this._earthScaleMatrix.setAt(1, 1, earthRadii.y);
    this._earthScaleMatrix.setAt(2, 2, earthRadii.z);
    this._earthScaleMatrix.computeCachedInverse(true);
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
