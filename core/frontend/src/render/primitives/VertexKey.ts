/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, compareWithTolerance, IndexMap } from "@itwin/core-bentley";
import { Point2d, Point3d, XYAndZ } from "@itwin/core-geometry";
import { OctEncodedNormal } from "@itwin/core-common";

/** @internal */
export interface VertexKeyProps {
  position: Point3d;
  fillColor: number;
  normal?: OctEncodedNormal;
  uvParam?: Point2d;
}

function comparePositions(p0: Point3d, p1: Point3d, tolerance: XYAndZ): number {
  let diff = compareWithTolerance(p0.x, p1.x, tolerance.x);
  if (0 === diff) {
    diff = compareWithTolerance(p0.y, p1.y, tolerance.y);
    if (0 === diff)
      diff = compareWithTolerance(p0.z, p1.z, tolerance.z);
  }

  return diff;
}

/** @internal */
export class VertexKey {
  public readonly position: Point3d;
  public readonly normal?: OctEncodedNormal;
  public readonly uvParam?: Point2d;
  public readonly fillColor: number;

  public constructor(position: Point3d, fillColor: number, normal?: OctEncodedNormal, uvParam?: Point2d) {
    this.position = position.clone();
    this.fillColor = fillColor;
    this.normal = normal;
    this.uvParam = uvParam?.clone();
  }

  public static create(props: VertexKeyProps): VertexKey { return new VertexKey(props.position, props.fillColor, props.normal, props.uvParam); }

  public equals(rhs: VertexKey, tolerance: XYAndZ): boolean {
    if (this.fillColor !== rhs.fillColor)
      return false;

    if (undefined !== this.normal) {
      assert(undefined !== rhs.normal);
      if (this.normal.value !== rhs.normal.value)
        return false;
    }

    if (0 !== comparePositions(this.position, rhs.position, tolerance))
      return false;

    if (undefined !== this.uvParam) {
      assert(undefined !== rhs.uvParam);
      return this.uvParam.isAlmostEqual(rhs.uvParam, 0.1); // ###TODO surely this is a typo?
    }

    return true;
  }

  public compare(rhs: VertexKey, tolerance: XYAndZ): number {
    if (this === rhs)
      return 0;

    let diff = this.fillColor - rhs.fillColor;
    if (0 === diff) {
      diff = comparePositions(this.position, rhs.position, tolerance);
      if (0 === diff) {
        if (undefined !== this.normal) {
          assert(undefined !== rhs.normal);
          diff = this.normal.value - rhs.normal.value;
        }

        if (0 === diff && undefined !== this.uvParam) {
          assert(undefined !== rhs.uvParam);
          diff = compareWithTolerance(this.uvParam.x, rhs.uvParam.x);
          if (0 === diff)
            diff = compareWithTolerance(this.uvParam.x, rhs.uvParam.y);
        }
      }
    }

    return diff;
  }
}

/** @internal */
export class VertexMap extends IndexMap<VertexKey> {
  private readonly _tolerance: XYAndZ;

  public constructor(tolerance: XYAndZ) {
    super((lhs, rhs) => lhs.compare(rhs, tolerance));
    this._tolerance = tolerance;
  }

  public insertKey(props: VertexKeyProps, onInsert?: (vk: VertexKey) => any): number {
    return this.insert(VertexKey.create(props), onInsert);
  }

  public arePositionsAlmostEqual(p0: VertexKeyProps, p1: VertexKeyProps): boolean {
    return 0 === this.comparePositions(p0, p1);
  }

  public comparePositions(p0: VertexKeyProps, p1: VertexKeyProps): number {
    return comparePositions(p0.position, p1.position, this._tolerance);
  }
}
