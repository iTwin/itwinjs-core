/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Point3d, XYZProps } from "@itwin/core-geometry";
import { ColorDef, ColorDefProps } from "./ColorDef";

export const defaultAtmosphericScatteringProps: Required<AtmosphericScatteringProps> =
  {
    earthCenter: { x: 0.0, y: 0.0, z: -6_190_000.0 },
    earthRadii: {x: 10.0, y: 5.0, z: 20.0},
    atmosphereHeightAboveEarth: 10.0,
    minDensityHeightBelowEarth: 10.0,
    densityFalloff: 5.0,
    scatteringStrength: 0.01,
    wavelengths: [700.0, 530.0, 440.0],
    numInScatteringPoints: 10,
    numOpticalDepthPoints: 10,
    isPlanar: false,
  };

/**
 * @public
 */
export interface AtmosphericScatteringProps {
  earthCenter?: XYZProps;
  earthRadii?: XYZProps;
  atmosphereHeightAboveEarth?: number;
  minDensityHeightBelowEarth?: number;
  densityFalloff?: number;
  scatteringStrength?: number;
  wavelengths?: number[];
  numInScatteringPoints?: number;
  numOpticalDepthPoints?: number;
  isPlanar?: boolean;
}

/**
 * @public
 */
export class AtmosphericScattering implements AtmosphericScatteringProps {
  public readonly earthCenter: Point3d;
  public readonly earthRadii: Point3d;
  public readonly atmosphereHeightAboveEarth: number; // At the poles
  public readonly minDensityHeightBelowEarth: number; // At the poles
  public readonly densityFalloff: number;
  public readonly scatteringStrength: number;
  public readonly wavelengths: number[];
  public readonly numInScatteringPoints: number;
  public readonly numOpticalDepthPoints: number;
  public readonly isPlanar: boolean;

  public equals(other: AtmosphericScattering): boolean {
    if (!this.earthCenter.isAlmostEqual(other.earthCenter)) return false;
    if (!this.earthRadii.isAlmostEqual(other.earthRadii)) return false;
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
    return true;
  }

  private constructor(json?: AtmosphericScatteringProps) {
    this.earthCenter = Point3d.fromJSON(json?.earthCenter ?? defaultAtmosphericScatteringProps.earthCenter);
    this.earthRadii = Point3d.fromJSON(json?.earthRadii ?? defaultAtmosphericScatteringProps.earthRadii);
    this.atmosphereHeightAboveEarth = json?.atmosphereHeightAboveEarth ?? defaultAtmosphericScatteringProps.atmosphereHeightAboveEarth;
    this.minDensityHeightBelowEarth = json?.minDensityHeightBelowEarth ?? defaultAtmosphericScatteringProps.minDensityHeightBelowEarth;
    this.densityFalloff = json?.densityFalloff ?? defaultAtmosphericScatteringProps.densityFalloff;
    this.scatteringStrength = json?.scatteringStrength ?? defaultAtmosphericScatteringProps.scatteringStrength;
    this.wavelengths = json?.wavelengths ?? defaultAtmosphericScatteringProps.wavelengths;
    this.numInScatteringPoints = json?.numInScatteringPoints ?? defaultAtmosphericScatteringProps.numInScatteringPoints;
    this.numOpticalDepthPoints = json?.numOpticalDepthPoints ?? defaultAtmosphericScatteringProps.numOpticalDepthPoints;
    this.isPlanar = json?.isPlanar ?? defaultAtmosphericScatteringProps.isPlanar;
  }

  public static fromJSON(json?: AtmosphericScatteringProps) {
    return new AtmosphericScattering(json);
  }

  public toJSON(): AtmosphericScatteringProps {
    const json: AtmosphericScatteringProps = {
      earthCenter: this.earthCenter.toJSON(),
      earthRadii: this.earthRadii.toJSON(),
      atmosphereHeightAboveEarth: this.atmosphereHeightAboveEarth,
      minDensityHeightBelowEarth: this.minDensityHeightBelowEarth,
      densityFalloff: this.densityFalloff,
      scatteringStrength: this.scatteringStrength,
      wavelengths: this.wavelengths,
      numInScatteringPoints: this.numInScatteringPoints,
      numOpticalDepthPoints: this.numOpticalDepthPoints,
      isPlanar: this.isPlanar,
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
