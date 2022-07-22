/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */
import { ColorDef, ColorDefProps } from "./ColorDef";

export const defaultAtmosphericScatteringProps: Required<AtmosphericScatteringProps> =
  {
    atmosphereHeightAboveEarth: 100000.0,
    minDensityHeightBelowEarth: 0.0,
    densityFalloff: 1.0,
    scatteringStrength: 5,
    wavelengths: [700.0, 530.0, 440.0],
    numInScatteringPoints: 10,
    numOpticalDepthPoints: 10,
    isPlanar: false,
    inScatteringIntensity: 6.0,
    outScatteringIntensity: 1.0,
  };

/**
 * @public
 */
export interface AtmosphericScatteringProps {
  atmosphereHeightAboveEarth?: number;
  minDensityHeightBelowEarth?: number;
  densityFalloff?: number;
  scatteringStrength?: number;
  wavelengths?: number[];
  numInScatteringPoints?: number;
  numOpticalDepthPoints?: number;
  isPlanar?: boolean;
  inScatteringIntensity?: number;
  outScatteringIntensity?: number;
}

/**
 * @public
 */
export class AtmosphericScattering implements AtmosphericScatteringProps {
  public readonly atmosphereHeightAboveEarth: number; // At the poles
  public readonly minDensityHeightBelowEarth: number; // At the poles
  public readonly densityFalloff: number;
  public readonly scatteringStrength: number;
  public readonly wavelengths: number[];
  public readonly numInScatteringPoints: number;
  public readonly numOpticalDepthPoints: number;
  public readonly isPlanar: boolean;
  public readonly inScatteringIntensity: number;
  public readonly outScatteringIntensity: number;

  public equals(other: AtmosphericScattering): boolean {
    if (this.atmosphereHeightAboveEarth !== other.atmosphereHeightAboveEarth) return false;
    if (this.minDensityHeightBelowEarth !== other.minDensityHeightBelowEarth) return false;
    if (this.densityFalloff !== other.densityFalloff) return false;
    if (this.scatteringStrength !== other.scatteringStrength) return false;
    if (this.wavelengths[0] !== other.wavelengths[0]) return false;
    if (this.wavelengths[1] !== other.wavelengths[1]) return false;
    if (this.wavelengths[2] !== other.wavelengths[2]) return false;
    if (this.numInScatteringPoints !== other.numInScatteringPoints) return false;
    if (this.numOpticalDepthPoints !== other.numOpticalDepthPoints) return false;
    if (this.isPlanar !== other.isPlanar) return false;
    if (this.inScatteringIntensity !== other.inScatteringIntensity) return false;
    if (this.outScatteringIntensity !== other.outScatteringIntensity) return false;
    return true;
  }

  private constructor(json?: AtmosphericScatteringProps) {
    this.atmosphereHeightAboveEarth = json?.atmosphereHeightAboveEarth ?? defaultAtmosphericScatteringProps.atmosphereHeightAboveEarth;
    this.minDensityHeightBelowEarth = json?.minDensityHeightBelowEarth ?? defaultAtmosphericScatteringProps.minDensityHeightBelowEarth;
    this.densityFalloff = json?.densityFalloff ?? defaultAtmosphericScatteringProps.densityFalloff;
    this.scatteringStrength = json?.scatteringStrength ?? defaultAtmosphericScatteringProps.scatteringStrength;
    this.wavelengths = json?.wavelengths ?? defaultAtmosphericScatteringProps.wavelengths;
    this.numInScatteringPoints = json?.numInScatteringPoints ?? defaultAtmosphericScatteringProps.numInScatteringPoints;
    this.numOpticalDepthPoints = json?.numOpticalDepthPoints ?? defaultAtmosphericScatteringProps.numOpticalDepthPoints;
    this.isPlanar = json?.isPlanar ?? defaultAtmosphericScatteringProps.isPlanar;
    this.inScatteringIntensity = json?.inScatteringIntensity ?? defaultAtmosphericScatteringProps.inScatteringIntensity;
    this.outScatteringIntensity = json?.outScatteringIntensity ?? defaultAtmosphericScatteringProps.outScatteringIntensity;
  }

  public static fromJSON(json?: AtmosphericScatteringProps) {
    return new AtmosphericScattering(json);
  }

  public toJSON(): AtmosphericScatteringProps {
    const json: AtmosphericScatteringProps = {
      atmosphereHeightAboveEarth: this.atmosphereHeightAboveEarth,
      minDensityHeightBelowEarth: this.minDensityHeightBelowEarth,
      densityFalloff: this.densityFalloff,
      scatteringStrength: this.scatteringStrength,
      wavelengths: this.wavelengths,
      numInScatteringPoints: this.numInScatteringPoints,
      numOpticalDepthPoints: this.numOpticalDepthPoints,
      isPlanar: this.isPlanar,
      inScatteringIntensity: this.inScatteringIntensity,
      outScatteringIntensity: this.outScatteringIntensity,
    };
    return json;
  }
}

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
    if (!props) return this.defaults;
    return new AtmosphericSky(ColorDef.fromJSON(props?.color));
  }
}
