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
    atmosphereRadius: 6_290_100.0,
    earthRadius: 6_190_000.0,
    densityFalloff: 5.0,
    scatteringStrength: 0.01,
    wavelenghts: [700.0, 530.0, 440.0],
    numInScatteringPoints: 10,
    numOpticalDepthPoints: 10,
    isPlanar: false,
    // earthCenter: {x: 1000.0, y: -10000.0, z: -105000.0},
    // atmosphereRadius: 110000.0,
    // earthRadius: 9000.0,
    // densityFalloff: 5.0,
    // scatteringStrength: 1.0,
    // wavelenghts: [700.0, 530.0, 440.0],
    // numInScatteringPoints: 10,
    // numOpticalDepthPoints: 10,
    // isPlanar: false,
  };

/**
 * @public
 */
export interface AtmosphericScatteringProps {
  earthCenter?: XYZProps;
  atmosphereRadius?: number;
  earthRadius?: number;
  densityFalloff?: number;
  scatteringStrength?: number;
  wavelenghts?: number[];
  numInScatteringPoints?: number;
  numOpticalDepthPoints?: number;
  isPlanar?: boolean;
}

/**
 * @public
 */
export class AtmosphericScattering {
  public readonly earthCenter: Point3d;
  public readonly atmosphereRadius: number;
  public readonly earthRadius: number;
  public readonly densityFalloff: number;
  public readonly scatteringStrength: number;
  public readonly wavelenghts: number[];
  public readonly numInScatteringPoints: number;
  public readonly numOpticalDepthPoints: number;
  public readonly isPlanar: boolean;

  public equals(other: AtmosphericScattering): boolean {
    if (this.earthCenter !== other.earthCenter) return false;
    if (this.atmosphereRadius !== other.atmosphereRadius) return false;
    if (this.earthCenter !== other.earthCenter) return false;
    if (this.densityFalloff !== other.densityFalloff) return false;
    if (this.scatteringStrength !== other.scatteringStrength) return false;
    if (this.wavelenghts !== other.wavelenghts) return false;
    if (this.numInScatteringPoints !== other.numInScatteringPoints)
      return false;
    if (this.numOpticalDepthPoints !== other.numOpticalDepthPoints)
      return false;
    if (this.isPlanar !== other.isPlanar) return false;
    return true;
  }

  private constructor(json?: AtmosphericScatteringProps) {
    if (json === undefined) {
      this.earthCenter = Point3d.fromJSON(
        defaultAtmosphericScatteringProps.earthCenter
      );
      this.atmosphereRadius =
        defaultAtmosphericScatteringProps.atmosphereRadius;
      this.earthRadius = defaultAtmosphericScatteringProps.earthRadius;
      this.densityFalloff = defaultAtmosphericScatteringProps.densityFalloff;
      this.scatteringStrength =
        defaultAtmosphericScatteringProps.scatteringStrength;
      this.wavelenghts = defaultAtmosphericScatteringProps.wavelenghts;
      this.numInScatteringPoints =
        defaultAtmosphericScatteringProps.numInScatteringPoints;
      this.numOpticalDepthPoints =
        defaultAtmosphericScatteringProps.numOpticalDepthPoints;
      this.isPlanar = defaultAtmosphericScatteringProps.isPlanar;
    } else {
      this.earthCenter =
        json.earthCenter === undefined
          ? Point3d.fromJSON(defaultAtmosphericScatteringProps.earthCenter)
          : Point3d.fromJSON(json.earthCenter);
      this.atmosphereRadius =
        json.atmosphereRadius === undefined
          ? defaultAtmosphericScatteringProps.atmosphereRadius
          : json.atmosphereRadius;
      this.earthRadius =
        json.earthRadius === undefined
          ? defaultAtmosphericScatteringProps.earthRadius
          : json.earthRadius;
      this.densityFalloff =
        json.densityFalloff === undefined
          ? defaultAtmosphericScatteringProps.densityFalloff
          : json.densityFalloff;
      this.scatteringStrength =
        json.scatteringStrength === undefined
          ? defaultAtmosphericScatteringProps.scatteringStrength
          : json.scatteringStrength;
      this.wavelenghts =
        json.wavelenghts === undefined
          ? defaultAtmosphericScatteringProps.wavelenghts
          : json.wavelenghts;
      this.numInScatteringPoints =
        json.numInScatteringPoints === undefined
          ? defaultAtmosphericScatteringProps.numInScatteringPoints
          : json.numInScatteringPoints;
      this.numOpticalDepthPoints =
        json.numOpticalDepthPoints === undefined
          ? defaultAtmosphericScatteringProps.numOpticalDepthPoints
          : json.numOpticalDepthPoints;
      this.isPlanar =
        json.isPlanar === undefined
          ? defaultAtmosphericScatteringProps.isPlanar
          : json.isPlanar;
    }
  }

  public static fromJSON(json?: AtmosphericScatteringProps) {
    return new AtmosphericScattering(json);
  }

  public toJSON(): AtmosphericScatteringProps {
    const json: AtmosphericScatteringProps = {
      earthCenter: this.earthCenter.toJSON(),
      atmosphereRadius: this.atmosphereRadius,
      earthRadius: this.earthRadius,
      densityFalloff: this.densityFalloff,
      scatteringStrength: this.scatteringStrength,
      wavelenghts: this.wavelenghts,
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
