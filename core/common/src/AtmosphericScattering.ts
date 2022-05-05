/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { Vector3d, XYZProps } from "@itwin/core-geometry";

/**
 * @public
 */
export interface AtmosphericScatteringProps {
  sunDirection?: XYZProps;
  earthCenter?: XYZProps;
  atmosphereRadius?: number;
}

/**
 * @public
 */
export class AtmosphericScattering {
  public readonly sunDirection: Vector3d;
  public readonly earthCenter: Vector3d;
  public readonly atmosphereRadius: number;

  public equals(other: AtmosphericScattering): boolean {
    if (this.sunDirection !== other.sunDirection)
      return false;
    if (this.earthCenter !== other.earthCenter)
      return false;
    if (this.atmosphereRadius !== other.atmosphereRadius)
      return false;
    return true;
  }

  private constructor(json?: AtmosphericScatteringProps) {
    if (json === undefined) {
      this.sunDirection = Vector3d.fromJSON();
      this.earthCenter = Vector3d.fromJSON();
      this.atmosphereRadius = 6371100.0;
    } else {
      this.sunDirection = Vector3d.fromJSON(json.sunDirection);
      this.earthCenter = Vector3d.fromJSON(json.earthCenter);
      this.atmosphereRadius = json.atmosphereRadius === undefined ? 0.0 : json.atmosphereRadius;

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
    };
    return json;
  }
}
