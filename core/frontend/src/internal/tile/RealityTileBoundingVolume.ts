/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { expectDefined } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";

/** A reality tile's bounding volume as its 3D Tiles tileset declares it: an oriented box (from a box or region) or a sphere.
 * Screen-space error is measured from it, as CesiumJS measures it from TileOrientedBoundingBox and TileBoundingSphere.
 * @internal
 */
export interface RealityTileBoundingVolume {
  /** Euclidean distance from `point` to the volume; zero inside it. */
  distanceTo(point: Point3d): number;
  transformBy(transform: Transform): RealityTileBoundingVolume;
}

/** An oriented box: a center and three half axes. A half axis may have zero length, as that of a flat box does.
 * @internal
 */
export class RealityTileOrientedBox implements RealityTileBoundingVolume {
  /** Unit directions of [[halfAxes]]. A zero-length half axis is given a direction perpendicular to the others, as CesiumJS's
   * OrientedBoundingBox.distanceSquaredTo does, so that the distance to a flat box includes the distance off its plane.
   */
  private readonly _directions: Vector3d[];
  private readonly _halfLengths: number[];

  public constructor(public readonly center: Point3d, public readonly halfAxes: Vector3d[]) {
    this._halfLengths = halfAxes.map((axis) => axis.magnitude());
    this._directions = directionsOf(halfAxes);
  }

  /** The box of a 3D Tiles `box`, from its 8 corners in RealityModelTileUtils order: the edges from corner 0 to corners 4, 2
   * and 1 are the box's (possibly transformed) full axes.
   */
  public static fromBoxCorners(corners: Point3d[]): RealityTileOrientedBox {
    const origin = corners[0];
    const halfAxes = [4, 2, 1].map((index) => Vector3d.createStartEnd(origin, corners[index]).scale(0.5));
    return new RealityTileOrientedBox(origin.interpolate(0.5, corners[7]), halfAxes);
  }

  /** The box enclosing 8 corners whose edges from corner 0 lead to corners 1, 2 and 4, aligned with the edges to corners 1
   * and 2. A region's corners are not a parallelepiped, so the box is fitted around them instead of built from them.
   */
  public static enclosingCorners(corners: Point3d[]): RealityTileOrientedBox {
    const origin = corners[0];
    const firstAxis = Vector3d.createStartEnd(origin, corners[1]).normalize() ?? Vector3d.unitZ();
    const secondEdge = Vector3d.createStartEnd(origin, corners[2]);
    const secondAxis = secondEdge.minus(firstAxis.scale(firstAxis.dotProduct(secondEdge))).normalize() ?? firstAxis.unitPerpendicularXY();
    const axes = [firstAxis, secondAxis, firstAxis.unitCrossProduct(secondAxis) ?? Vector3d.unitZ()];

    const extents = axes.map((axis) => {
      const projections = corners.map((corner) => axis.dotProduct(corner));
      return { axis, min: Math.min(...projections), max: Math.max(...projections) };
    });

    const center = Point3d.createZero();
    for (const { axis, min, max } of extents)
      center.addScaledInPlace(axis, (min + max) / 2);

    return new RealityTileOrientedBox(center, extents.map(({ axis, min, max }) => axis.scale((max - min) / 2)));
  }

  public static fromRange(range: Range3d): RealityTileOrientedBox {
    const halfDiagonal = range.diagonal().scale(0.5);
    const halfAxes = [Vector3d.create(halfDiagonal.x, 0, 0), Vector3d.create(0, halfDiagonal.y, 0), Vector3d.create(0, 0, halfDiagonal.z)];
    return new RealityTileOrientedBox(range.center, halfAxes);
  }

  public transformBy(transform: Transform): RealityTileOrientedBox {
    return new RealityTileOrientedBox(transform.multiplyPoint3d(this.center), this.halfAxes.map((axis) => transform.multiplyVector(axis)));
  }

  public distanceTo(point: Point3d): number {
    const fromCenter = Vector3d.createStartEnd(this.center, point);
    let squaredDistance = 0;
    for (const [index, direction] of this._directions.entries()) {
      const excess = Math.abs(fromCenter.dotProduct(direction)) - this._halfLengths[index];
      if (excess > 0)
        squaredDistance += excess * excess;
    }

    return Math.sqrt(squaredDistance);
  }
}

/** The unit directions of `halfAxes`, with directions for zero-length axes completing an orthonormal basis. */
function directionsOf(halfAxes: Vector3d[]): Vector3d[] {
  const directions = halfAxes.map((axis) => axis.normalize());
  const known = directions.filter((direction): direction is Vector3d => undefined !== direction);
  const perpendiculars = perpendicularDirections(known);
  return directions.map((direction) => direction ?? expectDefined(perpendiculars.pop()));
}

/** Unit directions perpendicular to each other and to every direction in `known`, completing a basis of three. */
function perpendicularDirections(known: Vector3d[]): Vector3d[] {
  if (known.length === 3)
    return [];

  const [first, second] = known;
  if (!first)
    return [Vector3d.unitX(), Vector3d.unitY(), Vector3d.unitZ()];

  const normal = second && first.unitCrossProduct(second);
  if (normal)
    return [normal];

  // A single direction (or two parallel ones): any two perpendiculars complete it.
  const helper = Math.abs(first.y) < 0.9 ? Vector3d.unitY() : Vector3d.unitX();
  const perpendicular = expectDefined(first.unitCrossProduct(helper));
  return [perpendicular, expectDefined(first.unitCrossProduct(perpendicular))];
}

/** A bounding sphere.
 * @internal
 */
export class RealityTileBoundingSphere implements RealityTileBoundingVolume {
  public constructor(public readonly center: Point3d, public readonly radius: number) { }

  public transformBy(transform: Transform): RealityTileBoundingSphere {
    const matrix = transform.matrix;
    const maxScale = Math.max(matrix.columnXMagnitude(), matrix.columnYMagnitude(), matrix.columnZMagnitude());
    return new RealityTileBoundingSphere(transform.multiplyPoint3d(this.center), this.radius * maxScale);
  }

  public distanceTo(point: Point3d): number {
    return Math.max(0, this.center.distance(point) - this.radius);
  }
}
