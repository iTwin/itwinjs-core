/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Point3d, Transform } from "@itwin/core-geometry";

/** Represents a bounding sphere.  Optional optimization for FrustumPlane containment test.
 * @public
 */
export class BoundingSphere {
  public center: Point3d;
  public radius: number;
  constructor(center?: Point3d, radius?: number) { this.center = center ? center : Point3d.createZero(); this.radius = undefined === radius ? 0.0 : radius; }
  public init(center: Point3d, radius: number) { this.center = center; this.radius = radius; }
  public transformBy(transform: Transform, result: BoundingSphere) {
    transform.multiplyPoint3d(this.center, result.center);
    result.radius = this.radius * Math.max(transform.matrix.columnXMagnitude(), Math.max(transform.matrix.columnYMagnitude(), (transform.matrix.columnZMagnitude())));
    return result;
  }
}
