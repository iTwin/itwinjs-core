/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { Atmosphere } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { desync, sync, SyncTarget } from "./Sync";
import { Target } from "./Target";
import { UniformHandle } from "./UniformHandle";
import { Matrix3 } from "./Matrix";

export class AtmosphereUniforms implements WebGLDisposable, SyncTarget {
  private _atmosphere?: Atmosphere.Settings;
  public get atmosphere(): Atmosphere.Settings | undefined {
    return this._atmosphere;
  }

  // Atmosphere effect parameters
  private _earthCenter = new Point3d();
  private _earthScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _inverseEllipsoidRotationMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _atmosphereRadiusScaleFactor = 1.0;
  private _atmosphereScaleMatrix = new Matrix3d(new Float64Array([1,0,0,0,1,0,0,0,1]));
  private _atmosphereMaxDensityThresholdScaleFactor = 1.0;
  private _densityFalloff = 0.0;
  private _inScatteringIntensity = 1.0;
  private _outScatteringIntensity = 1.0;
  private _exposure = 0.0;
  private _scatteringCoefficients = new Float32Array(3);

  // Iteration parameters
  private _numInScatteringPoints = 0.0;
  private _numOpticalDepthPoints = 0.0;

  // utility
  public syncKey = 0;
  private _scratchMatrix3d = new Matrix3d();

  public update(target: Target): void {
    desync(this);

    const plan = target.plan;
    if (!(this.atmosphere && plan.atmosphere && this.atmosphere.equals(plan.atmosphere))) {
      this._atmosphere = plan.atmosphere;
    }

    if (!this.atmosphere || !plan.ellipsoid) {
      return;
    }

    this._updateAtmosphereScaleMatrix(this.atmosphere.atmosphereHeightAboveEarth);
    this._updateExposure(this.atmosphere.exposure);
    this._updateDensityFalloff(this.atmosphere.densityFalloff);
    this._updateEarthCenter(plan.ellipsoid.ellipsoidCenter, target.uniforms.frustum.viewMatrix);
    this._updateEarthScaleMatrix(plan.ellipsoid.ellipsoidRadii);
    this._updateInScatteringIntensity(this.atmosphere.inScatteringIntensity);
    this._updateInverseEllipsoidRotationMatrix(plan.ellipsoid.ellipsoidRotation, target.uniforms.frustum.viewMatrix.matrix);
    this._updateAtmosphereRadiusScaleFactor(this.atmosphere.atmosphereHeightAboveEarth);
    this._updateAtmosphereMaxDensityThresholdScaleFactor(this.atmosphere.depthBelowEarthForMaxDensity);
    this._updateNumInScatteringPoints(this.atmosphere.numInScatteringPoints);
    this._updateNumOpticalDepthPoints(this.atmosphere.numOpticalDepthPoints);
    this._updateOutScatteringIntensity(this.atmosphere.outScatteringIntensity);
    this._updateScatteringCoefficients(this.atmosphere.scatteringStrength, this.atmosphere.wavelengths);
  }

  private _updateEarthCenter(earthCenter: Point3d, viewMatrix: Transform) {
    viewMatrix.multiplyPoint3d(earthCenter, this._earthCenter);
  }

  private _updateInverseEllipsoidRotationMatrix(ellipsoidRotation: Matrix3d, viewRotation: Matrix3d) {
    viewRotation.inverse(this._scratchMatrix3d);
    ellipsoidRotation.multiplyMatrixInverseMatrix(this._scratchMatrix3d, this._inverseEllipsoidRotationMatrix);
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
  private _updateAtmosphereScaleMatrix(heightAboveSurface: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const scaleFactor =  earthPolarRadius === 0 ? 1.0 : (earthPolarRadius + heightAboveSurface) / earthPolarRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._atmosphereScaleMatrix);
  }

  private _updateAtmosphereRadiusScaleFactor(atmosphereHeightAboveEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const minDensityThresholdRadius = earthPolarRadius + atmosphereHeightAboveEarth;
    this._atmosphereRadiusScaleFactor = (earthPolarRadius === 0)
      ? 1
      : (minDensityThresholdRadius / earthPolarRadius);
  }

  private _updateAtmosphereMaxDensityThresholdScaleFactor(maxDensityDepthBelowEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const maxDensityThresholdRadius = earthPolarRadius - maxDensityDepthBelowEarth;
    this._atmosphereMaxDensityThresholdScaleFactor = (earthPolarRadius === 0)
      ? 1
      : (maxDensityThresholdRadius / earthPolarRadius);
  }

  private _updateDensityFalloff(densityFalloff: number) {
    this._densityFalloff = densityFalloff;
  }

  private _updateScatteringCoefficients(scatteringStrength: number, wavelengths: Atmosphere.Wavelengths) {
    // Rayleigh scattering strength is inversely related to the 4th power of the wavelength -> 1/pow(wavelength, 4)
    // Because this produces very small values when the wavelengths are taken in nanometers,
    //   we attempt to normalize them around 1 by taking the smallest wavelength of visible light as a baseline (violet light - 400nm)
    const violetLightWavelength = 400.0;
    this._scatteringCoefficients[0] = ((violetLightWavelength / wavelengths.r) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[1] = ((violetLightWavelength / wavelengths.g) ** 4.0) * scatteringStrength;
    this._scatteringCoefficients[2] = ((violetLightWavelength / wavelengths.b) ** 4.0) * scatteringStrength;
  }

  private _updateNumInScatteringPoints(numInScatteringPoints: number) {
    this._numInScatteringPoints = Math.max(0, numInScatteringPoints);
  }

  private _updateNumOpticalDepthPoints(numOpticalDepthPoints: number) {
    this._numOpticalDepthPoints = Math.max(0, numOpticalDepthPoints);
  }

  private _updateExposure(exposure: number) {
    this._exposure = exposure;
  }

  public bindExposure(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      uniform.setUniform1f(this._exposure);
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

  public bindInScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._inScatteringIntensity);
  }

  public bindOutScatteringIntensity(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._outScatteringIntensity);
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

  public bindAtmosphereRadiusScaleFactor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereRadiusScaleFactor);
  }

  public bindAtmosphereMaxDensityThresholdScaleFactor(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform1f(this._atmosphereMaxDensityThresholdScaleFactor);
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
