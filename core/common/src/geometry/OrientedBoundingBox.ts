/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Matrix3d, Point3d, Transform } from "@itwin/core-geometry";

export class OrientedBoundingBox {
  public center: Point3d;
  public halfAxes: Matrix3d;

  public constructor(center: Point3d, halfAxes: Matrix3d) {
    this.center = center;
    this.halfAxes = halfAxes;
  }

  public clone(result?: OrientedBoundingBox): OrientedBoundingBox {
    const center = this.center.clone(result?.center);
    const halfAxes = this.halfAxes.clone(result?.halfAxes);
    return result ?? new OrientedBoundingBox(center, halfAxes);
  }

  public transform(transform: Transform, result?: OrientedBoundingBox): OrientedBoundingBox {
    result = this.clone(result);
    transform.multiplyPoint3d(result.center, result.center);
    transform.matrix.multiplyMatrixMatrix(result.halfAxes, result.halfAxes);
    return result;
  }
}
