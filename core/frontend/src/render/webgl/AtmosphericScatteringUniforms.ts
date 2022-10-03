/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Matrix3d, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { AtmosphericScattering } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { desync, sync, SyncTarget } from "./Sync";
import { Target } from "./Target";
import { UniformHandle } from "./UniformHandle";
import { Matrix3 } from "./Matrix";
import { FrustumUniformType } from "./FrustumUniforms";

export const MAX_SAMPLE_POINTS = 20;
export const MESH_PROJECTION_CUTOFF_HEIGHT = 500_000;

export class AtmosphericScatteringUniforms implements WebGLDisposable, SyncTarget {
  private _atmosphericScattering?: AtmosphericScattering.Settings;

  // computed values
  private _atmosphereHeightAboveEarth = 0.0;
  private _atmosphereScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _brightnessAdaptationStrength = 0.0;
  private _densityFalloff = 0.0;
  private _earthCenter = new Point3d();
  private _earthScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _ellipsoidToEye = new Vector3d();
  private _inScatteringIntensity = 1.0;
  private _inverseEllipsoidRotationMatrix = new Matrix3d();
  private _isCameraEnabled = true;
  private _minDensityScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _minDensityToAtmosphereScaleFactor: any;
  private _numInScatteringPoints = 0.0;
  private _numOpticalDepthPoints = 0.0;
  private _outScatteringIntensity = 1.0;
  private _scatteringCoefficients = new Float32Array(3);
  private readonly _ellipsoidRotationMatrix = new Matrix3d();
  private _isEnabled = false;

  // utility
  public syncKey = 0;
  private _scratchVector3d = new Vector3d();
  private _scratchMatrix3d = new Matrix3d();

  public get atmosphericScattering(): AtmosphericScattering.Settings | undefined {
    return this._atmosphericScattering;
  }

  public update(target: Target): void {
    desync(this);

    const plan = target.plan;
    if (!(this.atmosphericScattering && plan.atmosphericScattering && this.atmosphericScattering.equals(plan.atmosphericScattering))) {
      this._atmosphericScattering = plan.atmosphericScattering;
    }

    this._updateIsEnabled(target.wantAtmosphericScattering);

    if (!this.atmosphericScattering) {
      return;
    }

    this._updateAtmosphereHeightAboveEarth(this.atmosphericScattering.atmosphereHeightAboveEarth);
    this._updateAtmosphereScaleMatrix(this.atmosphericScattering.atmosphereHeightAboveEarth);
    this._updateBrightnessAdaptationStrength(this.atmosphericScattering.brightnessAdaptationStrength);
    this._updateDensityFalloff(this.atmosphericScattering.densityFalloff);
    this._updateEarthCenter(plan.ellipsoidCenter!, target.uniforms.frustum.viewMatrix);
    this._updateEarthScaleMatrix(plan.ellipsoidRadii!);
    this._updateEllipsoidRotationMatrix(plan.ellipsoidRotation!);
    this._updateEllipsoidToEye();
    this._updateInScatteringIntensity(this.atmosphericScattering.inScatteringIntensity);
    this._updateInverseEllipsoidRotationMatrix(plan.ellipsoidRotation!, target.uniforms.frustum.viewMatrix.matrix);
    this._updateIsCameraEnabled(target.uniforms.frustum.type);
    this._updateMinDensityScaleMatrix(this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateMinDensityToAtmosphereScaleFactor(this.atmosphericScattering.atmosphereHeightAboveEarth, this.atmosphericScattering.minDensityHeightBelowEarth);
    this._updateNumInScatteringPoints(this.atmosphericScattering.numInScatteringPoints);
    this._updateNumOpticalDepthPoints(this.atmosphericScattering.numOpticalDepthPoints);
    this._updateOutScatteringIntensity(this.atmosphericScattering.outScatteringIntensity);
    this._updateScatteringCoefficients(this.atmosphericScattering.scatteringStrength, this.atmosphericScattering.wavelengths);
  }

  private _updateIsEnabled(wantAtmosphericScattering: boolean) {
    this._isEnabled = wantAtmosphericScattering;
  }

  private _updateIsCameraEnabled(frustumType: FrustumUniformType) {
    this._isCameraEnabled = frustumType === FrustumUniformType.Perspective;
  }

  private _updateEarthCenter(earthCenter: Point3d, viewMatrix: Transform) {
    viewMatrix.multiplyPoint3d(earthCenter, this._earthCenter);
  }

  private _updateEllipsoidRotationMatrix(earthRotation: Matrix3d) {
    this._ellipsoidRotationMatrix.setFrom(earthRotation);
  }

  private _updateInverseEllipsoidRotationMatrix(ellipsoidRotation: Matrix3d, viewRotation: Matrix3d) {
    viewRotation.inverse(this._scratchMatrix3d);
    ellipsoidRotation.multiplyMatrixInverseMatrix(this._scratchMatrix3d, this._inverseEllipsoidRotationMatrix);
  }

  private _updateEllipsoidToEye() {
    Vector3d.createFrom(this._earthCenter, this._scratchVector3d);
    this._scratchVector3d.negate(this._scratchVector3d);
    this._inverseEllipsoidRotationMatrix.multiplyVector(this._scratchVector3d, this._ellipsoidToEye);
  }

  private _updateInScatteringIntensity(inScatteringIntensity: number) {
    this._inScatteringIntensity = inScatteringIntensity;
  }

  private _updateOutScatteringIntensity(outScatteringIntensity: number) {
    this._outScatteringIntensity = outScatteringIntensity;
  }

  private _updateEarthScaleMatrix(earthRadii: Point3d) {
    this._earthScaleMatrix.setAt(0, 0, earthRadii.x);
    this._earthScaleMatrix.setAt(1, 1, earthRadii.y);
    this._earthScaleMatrix.setAt(2, 2, earthRadii.z);
  }

  private _updateAtmosphereHeightAboveEarth(atmosphereHeightAboveEarth: number) {
    this._atmosphereHeightAboveEarth = atmosphereHeightAboveEarth;
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

  private _updateMinDensityToAtmosphereScaleFactor(atmosphereHeightAboveEarth: number, minDensityHeightBelowEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const divider = earthPolarRadius - minDensityHeightBelowEarth;
    this._minDensityToAtmosphereScaleFactor = (earthPolarRadius === 0 || divider === 0) ? 1.0 : (earthPolarRadius + atmosphereHeightAboveEarth) / divider;
  }

  private _updateDensityFalloff(densityFalloff: number) {
    this._densityFalloff = densityFalloff;
  }

  private _updateScatteringCoefficients(scatteringStrength: number, wavelenghts: AtmosphericScattering.Wavelengths) {
    this._scatteringCoefficients[0] = ((400.0 / wavelenghts.r) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[1] = ((400.0 / wavelenghts.g) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[2] = ((400.0 / wavelenghts.b) ** 4.0) * scatteringStrength;
  }

  private _updateNumInScatteringPoints(numInScatteringPoints: number) {
    this._numInScatteringPoints = Math.max(0, Math.min(MAX_SAMPLE_POINTS, numInScatteringPoints));
  }

  private _updateNumOpticalDepthPoints(numOpticalDepthPoints: number) {
    this._numOpticalDepthPoints = Math.max(0, Math.min(MAX_SAMPLE_POINTS, numOpticalDepthPoints));
  }

  private _updateBrightnessAdaptationStrength(brightnessAdaptationStrength: number) {
    this._brightnessAdaptationStrength = brightnessAdaptationStrength;
  }

  public bindIsEnabled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      uniform.setUniform1i(this._isEnabled ? 1 : 0);
    }
  }

  public bindIsCameraEnabled(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      uniform.setUniform1i(this._isCameraEnabled ? 1 : 0);
    }
  }

  public bindBrightnessAdaptationStrength(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      uniform.setUniform1f(this._brightnessAdaptationStrength);
    }
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

  public bindInScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._inScatteringIntensity);
  }

  public bindOutScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._outScatteringIntensity);
  }

  public bindAtmosphereHeightAboveEarth(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereHeightAboveEarth);
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

  public bindMinDensityToAtmosphereScaleFactor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._minDensityToAtmosphereScaleFactor);
  }

  public bindEllipsoidRotationMatrix(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setMatrix3(Matrix3.fromMatrix3d(this._ellipsoidRotationMatrix));
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

  public get isDisposed(): boolean {
    return true;
  }

  public dispose() {}
}
