/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { RequireAtLeastOne } from "@itwin/core-bentley";
import { Point3d, XYAndZ } from "@itwin/core-geometry";
import { BoundingSphere } from "../geometry/BoundingSphere";
import { OrientedBoundingBox } from "../geometry/OrientedBoundingBox";

export type TileBoundingVolumeProps = RequireAtLeastOne<{
  box?: [centerX: number, centerY: number, centerZ: number,
    xVecX: number, xVecY: number, xVecZ: number,
    yVecX: number, yVecY: number, yVecZ: number,
    zVecX: number, zVecY: number, zVecZ: number,
  ];
  sphere?: [centerX: number, centerY: number, centerZ: number, radius: number];
  region?: [west: number, south: number, east: number, north: number, minHeight: number, maxHeight: number];
}>;

export interface TileBoundingVolume {
  readonly sphere: Readonly<BoundingSphere>;
  readonly obb: Readonly<OrientedBoundingBox>;

  distanceSquaredToPoint(point: XYAndZ): number;
  distanceToPoint(point: XYAndZ): number;
}

export namespace TileBoundingVolume {
  export function fromJSON(props: TileBoundingVolumeProps): TileBoundingVolume {
    if (props.box) {
    } else if (props.region) {
    } else if (props.sphere) {
    }

    throw new Error("Tile bounding volume must contain a sphere, region, or box");
  }
}
