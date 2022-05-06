/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Point3d, Vector3d, XYZProps } from "@itwin/core-geometry";

export const defaultAtmosphericScatteringProps: Required<AtmosphericScatteringProps> = {
  sunDirection: {x: 0.0, y: -1.0, z: 0.0},
  earthCenter: {x: 0.0, y: 0.0, z: -6_371_000.0},
  atmosphereRadius: 6_371_100.0,
  earthRadius: 6_371_000.0,
  densityFalloff: 4.0,
  scatteringStrength: 1.0,
  wavelenghts: [700.0, 530.0, 440.0],
};

/**
 * @public
 */
export interface AtmosphericScatteringProps {
  sunDirection?: XYZProps;
  earthCenter?: XYZProps;
  atmosphereRadius?: number;
  earthRadius?: number;
  densityFalloff?: number;
  scatteringStrength?: number;
  wavelenghts?: number[];
}

/**
 * @public
 */
export class AtmosphericScattering {
  public readonly sunDirection: Vector3d;
  public readonly earthCenter: Point3d;
  public readonly atmosphereRadius: number;
  public readonly earthRadius: number;
  public readonly densityFalloff: number;
  public readonly scatteringStrength: number;
  public readonly wavelenghts: number[];

  public equals(other: AtmosphericScattering): boolean {
    if (this.sunDirection !== other.sunDirection)
      return false;
    if (this.earthCenter !== other.earthCenter)
      return false;
    if (this.atmosphereRadius !== other.atmosphereRadius)
      return false;
    if (this.earthCenter !== other.earthCenter)
      return false;
    if (this.densityFalloff !== other.densityFalloff)
      return false;
    if (this.scatteringStrength !== other.scatteringStrength)
      return false;
    if (this.wavelenghts !== other.wavelenghts)
      return false;
    return true;
  }

  private constructor(json?: AtmosphericScatteringProps) {
    if (json === undefined) {
      this.sunDirection = Vector3d.fromJSON(defaultAtmosphericScatteringProps.sunDirection);
      this.earthCenter = Point3d.fromJSON(defaultAtmosphericScatteringProps.earthCenter);
      this.atmosphereRadius = defaultAtmosphericScatteringProps.atmosphereRadius;
      this.earthRadius = defaultAtmosphericScatteringProps.earthRadius;
      this.densityFalloff = defaultAtmosphericScatteringProps.densityFalloff;
      this.scatteringStrength = defaultAtmosphericScatteringProps.scatteringStrength;
      this.wavelenghts = defaultAtmosphericScatteringProps.wavelenghts;
    } else {
      this.sunDirection = json.sunDirection === undefined ? Vector3d.fromJSON(defaultAtmosphericScatteringProps.sunDirection) : Vector3d.fromJSON(json.sunDirection);
      this.earthCenter = json.earthCenter === undefined ? Point3d.fromJSON(defaultAtmosphericScatteringProps.earthCenter) : Point3d.fromJSON(json.earthCenter);
      this.atmosphereRadius = json.atmosphereRadius === undefined ? defaultAtmosphericScatteringProps.atmosphereRadius : json.atmosphereRadius;
      this.earthRadius = json.earthRadius === undefined ? defaultAtmosphericScatteringProps.earthRadius : json.earthRadius;
      this.densityFalloff = json.densityFalloff === undefined ? defaultAtmosphericScatteringProps.densityFalloff : json.densityFalloff;
      this.scatteringStrength = json.scatteringStrength === undefined ? defaultAtmosphericScatteringProps.scatteringStrength : json.scatteringStrength;
      this.wavelenghts = json.wavelenghts === undefined ? defaultAtmosphericScatteringProps.wavelenghts : json.wavelenghts;
    }
  }

  public static fromJSON(json?: AtmosphericScatteringProps) {
    return new AtmosphericScattering(json);
  }

  public toJSON(): AtmosphericScatteringProps {
    const json: AtmosphericScatteringProps = {
      sunDirection: this.sunDirection.toJSON(),
      earthCenter: this.earthCenter.toJSON(),
      atmosphereRadius: this.atmosphereRadius,
      earthRadius: this.earthRadius,
      densityFalloff: this.densityFalloff,
      scatteringStrength: this.scatteringStrength,
      wavelenghts: this.wavelenghts,
    };
    return json;
  }
}
