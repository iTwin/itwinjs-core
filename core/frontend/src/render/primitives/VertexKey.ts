/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, compareWithTolerance, IndexMap } from "@itwin/core-bentley";
import { Point2d } from "@itwin/core-geometry";
import { OctEncodedNormal, QPoint3d } from "@itwin/core-common";

/** @internal */
export interface VertexKeyProps {
  position: QPoint3d;
  fillColor: number;
  normal?: OctEncodedNormal;
  uvParam?: Point2d;
}

/** @internal */
export class VertexKey {
  public readonly position: QPoint3d;
  public readonly normal?: OctEncodedNormal;
  public readonly uvParam?: Point2d;
  public readonly fillColor: number;

  public constructor(position: QPoint3d, fillColor: number, normal?: OctEncodedNormal, uvParam?: Point2d) {
    this.position = position.clone();
    this.fillColor = fillColor;
    this.normal = normal;
    this.uvParam = uvParam?.clone();
  }

  public static create(props: VertexKeyProps): VertexKey { return new VertexKey(props.position, props.fillColor, props.normal, props.uvParam); }

  public equals(rhs: VertexKey): boolean {
    if (this.fillColor !== rhs.fillColor)
      return false;

    if (undefined !== this.normal) {
      assert(undefined !== rhs.normal);
      if (this.normal.value !== rhs.normal.value)
        return false;
    }

    if (!this.position.equals(rhs.position))
      return false;

    if (undefined !== this.uvParam) {
      assert(undefined !== rhs.uvParam);
      return this.uvParam.isAlmostEqual(rhs.uvParam, 0.1);
    }

    return true;
  }

  public compare(rhs: VertexKey): number {
    if (this === rhs)
      return 0;

    let diff = this.fillColor - rhs.fillColor;
    if (0 === diff) {
      diff = this.position.compare(rhs.position);
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
  public constructor() { super((lhs, rhs) => lhs.compare(rhs)); }

  public insertKey(props: VertexKeyProps, onInsert?: (vk: VertexKey) => any): number {
    return this.insert(VertexKey.create(props), onInsert);
  }
}
