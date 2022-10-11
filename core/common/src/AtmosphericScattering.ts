/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */
import { JsonUtils } from "@itwin/core-bentley";
import { ColorDef, ColorDefProps } from "./ColorDef";

/**
 * @public
 */
export namespace AtmosphericScattering {

  /** JSON representation of a [[Wavelengths]] object, with each wavelength value a positive number.
  * @public
  */
  export interface WavelengthsProps {
    r: number;
    g: number;
    b: number;
  }

  /** An immutable container of wavelength values for the red, green and blue pixel components. Values are in nanometers.
  * @public
  */
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

  export interface Props {
    /** If defined,  */
    atmosphereHeightAboveEarth?: number;
    /** If defined,  */
    brightnessAdaptationStrength?: number;
    /** If defined,  */
    densityFalloff?: number;
    /** If defined,  */
    inScatteringIntensity?: number;
    /** If defined,  */
    minDensityHeightBelowEarth?: number;
    /** If defined,  */
    numInScatteringPoints?: number;
    /** If defined,  */
    numOpticalDepthPoints?: number;
    /** If defined,  */
    outScatteringIntensity?: number;
    /** If defined,  */
    scatteringStrength?: number;
    /** If defined, corresponds the wavelengths of the red, green and blue color components in nanometers used to simulate how the atmosphere's air molecules affects light transmission. (See Rayleigh Scattering) Thus, a value of 470 for the red wavelength will make the red component scatter as if it were a cyan light ray. Default value is [., ., .]. */
    wavelengths?: WavelengthsProps;
  }

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

    public readonly atmosphereHeightAboveEarth: number; // At the poles
    public readonly brightnessAdaptationStrength: number;
    public readonly densityFalloff: number;
    public readonly inScatteringIntensity: number;
    public readonly minDensityHeightBelowEarth: number; // At the poles
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

/**
 * @public
 * Describes the properties with which ambient occlusion should be drawn.
 * These properties correspond to a horizon-based ambient occlusion approach.
 */

export interface AtmosphericSkyProps {
  display?: boolean;
  color?: ColorDefProps;
}
export class AtmosphericSky {
  public readonly color: ColorDef;
  protected constructor(color: ColorDef) {
    this.color = color;
  }
  public static readonly defaults = new AtmosphericSky(ColorDef.black);
  public toJSON(display?: boolean): AtmosphericSkyProps {
    const props = { color: this.color.toJSON(), display };
    return props;
  }
  public static fromJSON(props?: AtmosphericSkyProps): AtmosphericSky {
    if (!props)
      return this.defaults;
    return new AtmosphericSky(ColorDef.fromJSON(props?.color));
  }
}
