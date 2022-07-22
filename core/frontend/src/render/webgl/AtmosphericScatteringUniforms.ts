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
import { threadId } from "worker_threads";

export const MAX_SAMPLE_POINTS = 20;
export const MESH_PROJECTION_CUTOFF_HEIGHT = 500_000;

export class AtmosphericScatteringUniforms implements WebGLDisposable {
  private _atmosphereHeightAboveEarth = 0.0;
  private readonly _earthCenter = new Point3d();
  private readonly _ellipsoidRotationMatrix = new Matrix3d();
  private _atmosphericScattering?: AtmosphericScattering;
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

  private _inScatteringIntensity = 1.0;
  private _outScatteringIntensity = 1.0;

  private _isTerrainEnabled = false;

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

    this._updateEarthCenter(plan.ellipsoidCenter!, target.uniforms.frustum.viewMatrix);
    this._updateEllipsoidRotationMatrix(plan.ellipsoidRotation!);
    this._updateInverseEllipsoidRotationMatrix(plan.ellipsoidRotation!, target.uniforms.frustum.viewMatrix.matrix);
    this._updateEllipsoidToEye();
    this._updateInScatteringIntensity(this.atmosphericScattering.inScatteringIntensity);
    this._updateOutScatteringIntensity(this.atmosphericScattering.outScatteringIntensity);
    this._updateEarthScaleMatrix(plan.ellipsoidRadii!);
    this._updateAtmosphereHeightAboveEarth(this.atmosphericScattering.atmosphereHeightAboveEarth);
    this._updateAtmosphereScaleMatrix(this.atmosphericScattering.atmosphereHeightAboveEarth);
    this._updateMinDensityScaleMatrix(this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateMinDensityToAtmosphereScaleFactor(this.atmosphericScattering.atmosphereHeightAboveEarth, this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateDensityFalloff(this.atmosphericScattering.densityFalloff);
    this._updateScatteringCoefficients(this.atmosphericScattering.scatteringStrength, this.atmosphericScattering.wavelengths);
    this._updateNumInScatteringPoints(this.atmosphericScattering.numInScatteringPoints);
    this._updateNumOpticalDepthPoints(this.atmosphericScattering.numOpticalDepthPoints);
    this._updateIsPlanar(this.atmosphericScattering.isPlanar);
  }

  public bindInverseRotationInverseEarthScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._earthScaleMatrix.multiplyMatrixInverseMatrix(this._inverseEllipsoidRotationMatrix, this._scratchMatrix3d);
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._scratchMatrix3d));
    }
  }

  public bindInverseRotationInverseAtmosphereScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._atmosphereScaleMatrix.multiplyMatrixInverseMatrix(this._inverseEllipsoidRotationMatrix, this._scratchMatrix3d);
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._scratchMatrix3d));
    }
  }

  public bindInverseRotationInverseMinDensityScaleMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      this._minDensityScaleMatrix.multiplyMatrixInverseMatrix(this._inverseEllipsoidRotationMatrix, this._scratchMatrix3d);
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._scratchMatrix3d));
    }
  }

  private _updateInScatteringIntensity(inScatteringIntensity: number) {
    this._inScatteringIntensity = inScatteringIntensity;
  }

  public bindInScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._inScatteringIntensity);
  }

  private _updateOutScatteringIntensity(outScatteringIntensity: number) {
    this._outScatteringIntensity = outScatteringIntensity;
  }

  public bindOutScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._outScatteringIntensity);
  }

  public bindIsTerrainEnabled(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1i(this._isTerrainEnabled ? 1 : 0);
  }

  private _updateAtmosphereHeightAboveEarth(atmosphereHeightAboveEarth: number) {
    this._atmosphereHeightAboveEarth = atmosphereHeightAboveEarth;
  }

  public bindAtmosphereHeightAboveEarth(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereHeightAboveEarth);
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

  private _updateMinDensityToAtmosphereScaleFactor(atmosphereHeightAboveEarth: number, minDensityHeightBelowEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const divider = earthPolarRadius - minDensityHeightBelowEarth;
    this._minDensityToAtmosphereScaleFactor = (earthPolarRadius === 0 || divider === 0) ? 1.0 : (earthPolarRadius + atmosphereHeightAboveEarth) / divider;
  }

  public bindMinDensityToAtmosphereScaleFactor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._minDensityToAtmosphereScaleFactor);
  }

  private _updateAtmosphereScaleMatrix(heightAboveSurface: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const scaleFactor =  earthPolarRadius === 0 ? 1.0 : (earthPolarRadius + heightAboveSurface) / earthPolarRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._atmosphereScaleMatrix);
  }

  private _updateMinDensityScaleMatrix(heightBellowSurface: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const scaleFactor = earthPolarRadius === 0 ? 1.0 : (earthPolarRadius - heightBellowSurface) / earthPolarRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._minDensityScaleMatrix);
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
    this._numInScatteringPoints = Math.max(0, Math.min(MAX_SAMPLE_POINTS, numInScatteringPoints));
  }

  private _updateNumOpticalDepthPoints(numOpticalDepthPoints: number) {
    this._numOpticalDepthPoints = Math.max(0, Math.min(MAX_SAMPLE_POINTS, numOpticalDepthPoints));
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
