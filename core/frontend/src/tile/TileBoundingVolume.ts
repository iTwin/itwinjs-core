/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { RequireAtLeastOne } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Transform, Vector3d, XYAndZ } from "@itwin/core-geometry";
import { BoundingSphere, OrientedBoundingBox, TileBoundingVolumeProps } from "@itwin/core-common";

export interface TileBoundingVolume {
  readonly sphere: Readonly<BoundingSphere>;

  distanceSquaredToPoint(point: XYAndZ): number;
  distanceToPoint(point: XYAndZ): number;
  transformInPlace(transform: Transform): void;
}

export namespace TileBoundingVolume {
  export function fromJSON(props: TileBoundingVolumeProps): TileBoundingVolume {
    if (props.box) {
      const box = new OrientedBoundingBox(
        Point3d.create(props.box[0], props.box[1], props.box[2]),
        Matrix3d.createColumns(
          Vector3d.create(props.box[3], props.box[4], props.box[5]),
          Vector3d.create(props.box[6], props.box[7], props.box[8]),
          Vector3d.create(props.box[9], props.box[10], props.box[11])
        )
      );

      return new TileOBB(box);
    } else if (props.region) {
    } else if (props.sphere) {
      const sphere = new BoundingSphere(Point3d.create(props.sphere[0], props.sphere[1], props.sphere[2]), props.sphere[3]);
      return new TileBoundingSphere(sphere);
    }

    throw new Error("Tile bounding volume must contain a sphere, region, or box");
  }
}

class TileBoundingSphere implements TileBoundingVolume {
  public readonly sphere: Readonly<BoundingSphere>;

  public constructor(sphere: BoundingSphere) {
    this.sphere = sphere;
  }

  public distanceSquaredToPoint(point: XYAndZ): number {
    return this.sphere.distanceSquaredToPoint(point);
  }

  public distanceToPoint(point: XYAndZ): number {
    return this.sphere.distanceToPoint(point);
  }

  public transformInPlace(transform: Transform): void {
    this.sphere.transformInPlace(transform);
  }
}

class TileOBB implements TileBoundingVolume {
  private _sphere: BoundingSphere;
  private readonly _obb: OrientedBoundingBox;

  public constructor(obb: OrientedBoundingBox) {
    this._obb = obb;
    this._sphere = obb.computeBoundingSphere();
  }

  public get sphere(): BoundingSphere {
    return this._sphere;
  }

  public distanceSquaredToPoint(point: XYAndZ): number {
    return this._obb.distanceSquaredToPoint(point);
  }

  public distanceToPoint(point: XYAndZ): number {
    return this._obb.distanceToPoint(point);
  }

  public transformInPlace(transform: Transform): void {
    this._obb.transformInPlace(transform);
    this._sphere = this._obb.computeBoundingSphere();
  }
}
