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
export namespace AtmosphericScattering {

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
    /** If defined, corresponds to the height in meters above the earth's pole at which the atmosphere terminates. Physically, this is the point at which there are no more air molecules to interfere with light transmission. Defaults to 100_000.0. */
    atmosphereHeightAboveEarth?: number;
    /** If defined, this value can be used to modulate the overall brightness of the effect to compensate for very low and very high inScatteringIntensity values. Defaults to 0.1. */
    brightnessAdaptationStrength?: number;
    /** If defined, controls the rate at which the air density decreases between the point it is the highest and the point is is the lowest. A higher value means a faster decrease in air density. Defaults to 1.0. */
    densityFalloff?: number;
    /** If defined, multiplies the amount of light redirected by the atmosphere toward the viewing eye by this value. A higher value increases perceived overall brightness and thickness of the atmosphere. Defaults to 6.0. */
    inScatteringIntensity?: number;
    /** If defined, corresponds to the height in meters below the earth's pole at which the atmosphere is at its densest. Physically, this is the point at which there is the most air molecules to interfere with light transmission. Defaults to 0.0. */
    minDensityHeightBelowEarth?: number;
    /** If defined, corresponds to the number of atmospheric density samples uses to compute the amount of light reflected toward the viewing eye. A higher value increases fidelity but greatly decreases performance. The range is 1 to 20. Defaults to 10. */
    numInScatteringPoints?: number;
    /** If defined, corresponds to the number of atmospheric density samples uses to compute the amount of light scattered away from the viewing eye. A higher value increases fidelity but greatly decreases performance. The range is 1 to 20. Defaults to 10. */
    numOpticalDepthPoints?: number;
    /** If defined, multiplies the amount of light scattered away from the viewing eye by this value. A higher value decreases perceived overall brightness of the elements in the atmosphere and thickness of the atmosphere. Defaults to 1.0. */
    outScatteringIntensity?: number;
    /** If defined, controls how strongly the atmosphere's air diverts light. Defaults to 5.0.  */
    scatteringStrength?: number;
    /** If defined, corresponds the wavelengths of the red, green and blue color components in nanometers used to simulate how the atmosphere's air molecules affects light transmission. (See Rayleigh Scattering) Thus, a value of 470 for the red wavelength will make the red light component scatter as if it physically were a cyan light ray. The default value is {r:700.0, g:530.0, b:440.0}. */
    wavelengths?: WavelengthsProps;
  }

  /** Describes the properties with which the atmospheric scattering effect should be drawn. Theses properties correspond to a physics-based approximation of atmospheric scattering phenomenons. */
  export class Settings implements Props {
    public static readonly defaults: Required<Props> = {
      atmosphereHeightAboveEarth: 100000.0,
      brightnessAdaptationStrength: 0.1,
      densityFalloff: 1.0,
      inScatteringIntensity: 6.0,
      minDensityHeightBelowEarth: 0.0,
      numInScatteringPoints: 10,
      numOpticalDepthPoints: 10,
      outScatteringIntensity: 1.0,
      scatteringStrength: 5,
      wavelengths: {r:700.0, g:530.0, b:440.0},
    };

    public readonly atmosphereHeightAboveEarth: number;
    public readonly brightnessAdaptationStrength: number;
    public readonly densityFalloff: number;
    public readonly inScatteringIntensity: number;
    public readonly minDensityHeightBelowEarth: number;
    public readonly numInScatteringPoints: number;
    public readonly numOpticalDepthPoints: number;
    public readonly outScatteringIntensity: number;
    public readonly scatteringStrength: number;
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

    private constructor(json?: Props) {
      if (json === undefined)
        json = {};

      this.atmosphereHeightAboveEarth = JsonUtils.asDouble(json.atmosphereHeightAboveEarth, Settings.defaults.atmosphereHeightAboveEarth);
      this.brightnessAdaptationStrength = JsonUtils.asDouble(json.brightnessAdaptationStrength, Settings.defaults.brightnessAdaptationStrength);
      this.densityFalloff = JsonUtils.asDouble(json.densityFalloff, Settings.defaults.densityFalloff);
      this.inScatteringIntensity = JsonUtils.asDouble(json.inScatteringIntensity, Settings.defaults.inScatteringIntensity);
      this.minDensityHeightBelowEarth = JsonUtils.asDouble(json.minDensityHeightBelowEarth, Settings.defaults.minDensityHeightBelowEarth);
      this.numInScatteringPoints = JsonUtils.asDouble(json.numInScatteringPoints, Settings.defaults.numInScatteringPoints);
      this.numOpticalDepthPoints = JsonUtils.asDouble(json.numOpticalDepthPoints, Settings.defaults.numOpticalDepthPoints);
      this.outScatteringIntensity = JsonUtils.asDouble(json.outScatteringIntensity, Settings.defaults.outScatteringIntensity);
      this.scatteringStrength = JsonUtils.asDouble(json.scatteringStrength, Settings.defaults.scatteringStrength);
      this.wavelengths = Wavelengths.fromJSON(JsonUtils.asObject(json.wavelengths) ?? Settings.defaults.wavelengths);
    }

    public static fromJSON(json?: Props) {
      return new Settings(json);
    }

    public toJSON(): Props {
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
      return json;
    }
  }
}
