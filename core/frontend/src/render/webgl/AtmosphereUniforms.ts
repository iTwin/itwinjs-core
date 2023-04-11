/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Atmosphere } from "@itwin/core-common";
import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { RenderPlanEllipsoid } from "../RenderPlan";
import { WebGLDisposable } from "./Disposable";
import { Matrix3, Matrix4 } from "./Matrix";
import { SyncTarget, desync, sync } from "./Sync";
import { Target } from "./Target";
import { UniformHandle } from "./UniformHandle";

export const MAX_SAMPLE_POINTS = 40; // Maximum number of sample points to be used for the in-scattering and out-scattering computations.

export class AtmosphereUniforms implements WebGLDisposable, SyncTarget {
  private _atmosphere?: Atmosphere.Settings;
  private _ellipsoid?: RenderPlanEllipsoid;

  // Main shader uniforms
  private readonly _earthScaleMatrix = new Matrix3d(new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  private readonly _inverseEllipsoidRotationMatrix = new Matrix3d(new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  private readonly _atmosphereScaleMatrix = new Matrix3d(new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  private readonly _atmosphereData = new Matrix4();
  /**
   * uniform mat3 u_atmosphereData;
   *   { { atmosphereRadiusScaleFactor, atmosphereMaxDensityThresholdScaleFactor, densityFalloff, 0 },
   *   { numViewRaySamples, numSunRaySamples, 0, 0 },
   *   { earthCenter.x, earthCenter.y, earthCenter.z, 0 },
   *   { scatteringCoefficients.x, scatteringCoefficients.y, scatteringCoefficients.z, 0 } }
   */
  public get atmosphereData() { return this._atmosphereData; }

  // Fragment shader uniforms
  private _exposure = 0.0;

  // utility
  public syncKey = 0;
  private _scratchMatrix3d = new Matrix3d();
  private _scratchPoint3d = new Point3d();

  public update(target: Target): void {
    const atmosphereHasNotChanged = this._atmosphere && target.plan.atmosphere && this._atmosphere.equals(target.plan.atmosphere);
    const ellipsoidHasNotChanged = this._ellipsoid && target.plan.ellipsoid && this._ellipsoid.equals(target.plan.ellipsoid);
    if (atmosphereHasNotChanged && ellipsoidHasNotChanged) {
      return;
    }

    this._atmosphere = target.plan.atmosphere;
    this._ellipsoid = target.plan.ellipsoid;
    desync(this);
    if (!this._atmosphere || !this._ellipsoid) {
      return;
    }

    this._updateAtmosphereScaleMatrix(this._atmosphere.atmosphereHeightAboveEarth);
    this._updateExposure(this._atmosphere.exposure);
    this._updateDensityFalloff(this._atmosphere.densityFalloff);
    this._updateEarthCenter(this._ellipsoid.ellipsoidCenter, target.uniforms.frustum.viewMatrix);
    this._updateEarthScaleMatrix(this._ellipsoid.ellipsoidRadii);
    this._updateInverseEllipsoidRotationMatrix(this._ellipsoid.ellipsoidRotation, target.uniforms.frustum.viewMatrix.matrix);
    this._updateAtmosphereRadiusScaleFactor(this._atmosphere.atmosphereHeightAboveEarth);
    this._updateAtmosphereMaxDensityThresholdScaleFactor(this._atmosphere.depthBelowEarthForMaxDensity);
    this._updateNumViewRaySamples(this._atmosphere.numViewRaySamples);
    this._updateNumSunRaySamples(this._atmosphere.numSunRaySamples);
    this._updateScatteringCoefficients(this._atmosphere.scatteringStrength, this._atmosphere.wavelengths);
  }

  private _updateEarthCenter(earthCenter: Point3d, viewMatrix: Transform) {
    viewMatrix.multiplyPoint3d(earthCenter, this._scratchPoint3d);
    this._atmosphereData.data[8] = this._scratchPoint3d.x;
    this._atmosphereData.data[9] = this._scratchPoint3d.y;
    this._atmosphereData.data[10] = this._scratchPoint3d.z;
  }

  private _updateInverseEllipsoidRotationMatrix(ellipsoidRotation: Matrix3d, viewRotation: Matrix3d) {
    viewRotation.inverse(this._scratchMatrix3d);
    ellipsoidRotation.multiplyMatrixInverseMatrix(this._scratchMatrix3d, this._inverseEllipsoidRotationMatrix);
  }

  private _updateEarthScaleMatrix(earthRadii: Point3d) {
    this._earthScaleMatrix.setAt(0, 0, earthRadii.x);
    this._earthScaleMatrix.setAt(1, 1, earthRadii.y);
    this._earthScaleMatrix.setAt(2, 2, earthRadii.z);
  }
  private _updateAtmosphereScaleMatrix(heightAboveSurface: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const scaleFactor = earthPolarRadius === 0 ? 1.0 : (earthPolarRadius + heightAboveSurface) / earthPolarRadius;
    this._earthScaleMatrix.scale(scaleFactor, this._atmosphereScaleMatrix);
  }

  private _updateAtmosphereRadiusScaleFactor(atmosphereHeightAboveEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const minDensityThresholdRadius = earthPolarRadius + atmosphereHeightAboveEarth;
    const atmosphereRadiusScaleFactor = (earthPolarRadius === 0)
      ? 1
      : (minDensityThresholdRadius / earthPolarRadius);
    this.atmosphereData.data[0] = atmosphereRadiusScaleFactor;
  }

  private _updateAtmosphereMaxDensityThresholdScaleFactor(maxDensityDepthBelowEarth: number) {
    const earthPolarRadius = this._earthScaleMatrix.at(2, 2);
    const maxDensityThresholdRadius = earthPolarRadius - maxDensityDepthBelowEarth;
    const atmosphereMaxDensityThresholdScaleFactor = (earthPolarRadius === 0)
      ? 1
      : (maxDensityThresholdRadius / earthPolarRadius);
    this.atmosphereData.data[1] = atmosphereMaxDensityThresholdScaleFactor;
  }

  private _updateDensityFalloff(densityFalloff: number) {
    this.atmosphereData.data[2] = densityFalloff;
  }

  private _updateScatteringCoefficients(scatteringStrength: number, wavelengths: Atmosphere.Wavelengths) {
    // Rayleigh scattering strength is inversely related to the 4th power of the wavelength -> 1/pow(wavelength, 4)
    // Because this produces very small values when the wavelengths are taken in nanometers,
    //   we attempt to normalize them around 1 by taking the smallest wavelength of visible light as a baseline (violet light - 400nm)
    const violetLightWavelength = 400.0;
    this.atmosphereData.data[12] = ((violetLightWavelength / wavelengths.r) ** 4.0) * scatteringStrength;
    this.atmosphereData.data[13] = ((violetLightWavelength / wavelengths.g) ** 4.0) * scatteringStrength;
    this.atmosphereData.data[14] = ((violetLightWavelength / wavelengths.b) ** 4.0) * scatteringStrength;
  }

  private _updateExposure(exposure: number) {
    this._exposure = exposure;
  }

  public bindExposure(uniform: UniformHandle): void {
    if (!sync(this, uniform)) {
      uniform.setUniform1f(this._exposure);
    }
  }

  private _updateNumViewRaySamples(_numViewRaySamples: number) {
    const numViewRaySamples = Math.max(0, Math.min(MAX_SAMPLE_POINTS, _numViewRaySamples));
    this.atmosphereData.data[4] = numViewRaySamples;
  }

  private _updateNumSunRaySamples(_numSunRaySamples: number) {
    const numSunRaySamples = Math.max(0, Math.min(MAX_SAMPLE_POINTS, _numSunRaySamples));
    this.atmosphereData.data[5] = numSunRaySamples;
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

  public get isDisposed(): boolean {
    return true;
  }

  public dispose() { }
}
