/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */
import { JsonUtils } from "@itwin/core-bentley";

/** Namespace containing types controlling how the atmospheric scattering effect should be drawn.
 * @public
 */
export namespace Atmosphere {

  /** JSON representation of a [[Wavelengths]] object, with each wavelength value a positive number. */
  export interface WavelengthsProps {
    r: number;
    g: number;
    b: number;
  }

  /** An immutable container of wavelength values for the red, green and blue pixel components. Values are in nanometers. */
  export class Wavelengths implements WavelengthsProps {
    /** Constructs from red, green, and blue wavelength values.
     * @param r Wavelength value for red
     * @param g Wavelength value for green
     * @param b Wavelength value for blue
     */
    constructor(public readonly r: number, public readonly g: number, public readonly b: number) {
      this.r = Math.max(0, r);
      this.g = Math.max(0, g);
      this.b = Math.max(0, b);
    }

    public equals(other: Wavelengths): boolean {
      return  this.r === other.r && this.g === other.g && this.b === other.b;
    }

    public toJSON(): WavelengthsProps {
      return { r: this.r, g: this.g, b: this.b };
    }

    public static fromJSON(json: WavelengthsProps | undefined): Wavelengths {
      let r = 0;
      let g = 0;
      let b = 0;
      if (undefined !== json) {
        if (typeof json.r === "number")
          r = json.r;
        if (typeof json.g === "number")
          g = json.g;
        if (typeof json.b === "number")
          b = json.b;
      }
      return new Wavelengths(r, g, b);
    }
  }

  /** Describes the properties with which the atmospheric scattering effect should be drawn. Theses properties correspond to a physics-based approximation of atmospheric scattering phenomenons. */
  export interface Props {
    /** Whether the ground plane should be displayed. Defaults to false. */
    display?: boolean;
    /** See [[Settings.atmosphereHeightAboveEarth]] */
    atmosphereHeightAboveEarth?: number;
    /** See [[Settings.brightnessAdaptationStrength]] */
    brightnessAdaptationStrength?: number;
    /** See [[Settings.densityFalloff]] */
    densityFalloff?: number;
    /** See [[Settings.inScatteringIntensity]] */
    inScatteringIntensity?: number;
    /** See [[Settings.minDensityHeightBelowEarth]] */
    minDensityHeightBelowEarth?: number;
    /** See [[Settings.numInScatteringPoints]] */
    numInScatteringPoints?: number;
    /** See [[Settings.numOpticalDepthPoints]] */
    numOpticalDepthPoints?: number;
    /** See [[Settings.outScatteringIntensity]] */
    outScatteringIntensity?: number;
    /** See [[Settings.scatteringStrength]] */
    scatteringStrength?: number;
    /** See [[Settings.wavelengths]] */
    wavelengths?: WavelengthsProps;
  }

  /** Describes the properties with which the atmospheric scattering effect should be drawn. Theses properties correspond to a physics-based approximation of atmospheric scattering phenomenons. */
  export class Settings implements Props {
    private static _defaultAtmosphereHeightAboveEarth: number = 100000.0;
    private static _defaultBrightnessAdaptationStrength: number = 0.1;
    private static _defaultDensityFalloff: number = 1.0;
    private static _defaultInScatteringIntensity: number = 6.0;
    private static _defaultMinDensityHeightBelowEarth: 0.0;
    private static _defaultNumInScatteringPoints: number = 10;
    private static _defaultNumOpticalDepthPoints: number = 10;
    private static _defaultOutScatteringIntensity: number = 1.0;
    private static _defaultScatteringStrength: number = 5;
    private static _defaultWavelengths: Wavelengths = new Wavelengths(700.0, 530.0, 440.0);

    public static readonly defaults = new Settings();

    /** If defined, corresponds to the height in meters above the earth's pole at which the atmosphere terminates. Physically, this is the point at which there are no more air molecules to interfere with light transmission. Defaults to 100_000.0. */
    public readonly atmosphereHeightAboveEarth: number;
    /** If defined, this value can be used to modulate the overall brightness of the effect to compensate for very low and very high inScatteringIntensity values. Defaults to 0.1. */
    public readonly brightnessAdaptationStrength: number;
    /** If defined, controls the rate at which the air density decreases between the point it is the highest and the point is is the lowest. A higher value means a faster decrease in air density. Defaults to 1.0. */
    public readonly densityFalloff: number;
    /** If defined, multiplies the amount of light redirected by the atmosphere toward the viewing eye by this value. A higher value increases perceived overall brightness and thickness of the atmosphere. Defaults to 6.0. */
    public readonly inScatteringIntensity: number;
    /** If defined, corresponds to the height in meters below the earth's pole at which the atmosphere is at its densest. Physically, this is the point at which there is the most air molecules to interfere with light transmission. Defaults to 0.0. */
    public readonly minDensityHeightBelowEarth: number;
    /** If defined, corresponds to the number of atmospheric density samples uses to compute the amount of light reflected toward the viewing eye. A higher value increases fidelity but greatly decreases performance. The range is 1 to 20. Defaults to 10. */
    public readonly numInScatteringPoints: number;
    /** If defined, corresponds to the number of atmospheric density samples uses to compute the amount of light scattered away from the viewing eye. A higher value increases fidelity but greatly decreases performance. The range is 1 to 20. Defaults to 10. */
    public readonly numOpticalDepthPoints: number;
    /** If defined, multiplies the amount of light scattered away from the viewing eye by this value. A higher value decreases perceived overall brightness of the elements in the atmosphere and thickness of the atmosphere. Defaults to 1.0. */
    public readonly outScatteringIntensity: number;
    /** If defined, controls how strongly the atmosphere's air diverts light. Defaults to 5.0.  */
    public readonly scatteringStrength: number;
    /** If defined, corresponds the wavelengths of the red, green and blue color components in nanometers used to simulate how the atmosphere's air molecules affects light transmission. (See Rayleigh Scattering) Thus, a value of 470 for the red wavelength will make the red light component scatter as if it physically were a cyan light ray. The default value is {r:700.0, g:530.0, b:440.0}. */
    public readonly wavelengths: Wavelengths;

    public equals(other: Settings): boolean {
      if (this.atmosphereHeightAboveEarth !== other.atmosphereHeightAboveEarth)
        return false;
      if (this.brightnessAdaptationStrength !== other.brightnessAdaptationStrength)
        return false;
      if (this.densityFalloff !== other.densityFalloff)
        return false;
      if (this.inScatteringIntensity !== other.inScatteringIntensity)
        return false;
      if (this.minDensityHeightBelowEarth !== other.minDensityHeightBelowEarth)
        return false;
      if (this.numInScatteringPoints !== other.numInScatteringPoints)
        return false;
      if (this.numOpticalDepthPoints !== other.numOpticalDepthPoints)
        return false;
      if (this.outScatteringIntensity !== other.outScatteringIntensity)
        return false;
      if (this.scatteringStrength !== other.scatteringStrength)
        return false;
      if (!this.wavelengths.equals(other.wavelengths))
        return false;
      return true;
    }

    private constructor(json: Props = {}) {
      this.atmosphereHeightAboveEarth = JsonUtils.asDouble(json.atmosphereHeightAboveEarth, Settings._defaultAtmosphereHeightAboveEarth);
      this.brightnessAdaptationStrength = JsonUtils.asDouble(json.brightnessAdaptationStrength, Settings._defaultBrightnessAdaptationStrength);
      this.densityFalloff = JsonUtils.asDouble(json.densityFalloff, Settings._defaultDensityFalloff);
      this.inScatteringIntensity = JsonUtils.asDouble(json.inScatteringIntensity, Settings._defaultInScatteringIntensity);
      this.minDensityHeightBelowEarth = JsonUtils.asDouble(json.minDensityHeightBelowEarth, Settings._defaultMinDensityHeightBelowEarth);
      this.numInScatteringPoints = JsonUtils.asDouble(json.numInScatteringPoints, Settings._defaultNumInScatteringPoints);
      this.numOpticalDepthPoints = JsonUtils.asDouble(json.numOpticalDepthPoints, Settings._defaultNumOpticalDepthPoints);
      this.outScatteringIntensity = JsonUtils.asDouble(json.outScatteringIntensity, Settings._defaultOutScatteringIntensity);
      this.scatteringStrength = JsonUtils.asDouble(json.scatteringStrength, Settings._defaultScatteringStrength);
      this.wavelengths = Wavelengths.fromJSON(JsonUtils.asObject(json.wavelengths)) ?? Settings._defaultWavelengths;
    }

    public static fromJSON(json?: Props) {
      return new Settings(json);
    }

    public toJSON(display?: boolean): Props {
      const json: Props = {
        atmosphereHeightAboveEarth: this.atmosphereHeightAboveEarth,
        brightnessAdaptationStrength: this.brightnessAdaptationStrength,
        densityFalloff: this.densityFalloff,
        inScatteringIntensity: this.inScatteringIntensity,
        minDensityHeightBelowEarth: this.minDensityHeightBelowEarth,
        numInScatteringPoints: this.numInScatteringPoints,
        numOpticalDepthPoints: this.numOpticalDepthPoints,
        outScatteringIntensity: this.outScatteringIntensity,
        scatteringStrength: this.scatteringStrength,
        wavelengths: this.wavelengths.toJSON(),
      };

      if (undefined !== display)
        json.display = display;

      return json;
    }
  }
}
