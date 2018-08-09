/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { IndexMap, Comparable, compare, assert, compareWithTolerance } from "@bentley/bentleyjs-core";
import { Point2d } from "@bentley/geometry-core";
import { QPoint3d, OctEncodedNormal } from "@bentley/imodeljs-common";

export interface VertexKeyProps {
  position: QPoint3d;
  fillColor: number;
  normal?: OctEncodedNormal;
  uvParam?: Point2d;
}

export class VertexKey implements Comparable<VertexKey> {
  public readonly position: QPoint3d;
  public readonly octEncodedNormal: number = 0;
  public readonly uvParam?: Point2d;
  public readonly fillColor: number;
  public readonly normalValid: boolean = false;

  public constructor(position: QPoint3d, fillColor: number, normal?: OctEncodedNormal, uvParam?: Point2d) {
    this.position = position.clone();
    this.fillColor = fillColor;

    if (undefined !== normal) {
      this.normalValid = true;
      this.octEncodedNormal = normal.value;
    }

    if (undefined !== uvParam)
      this.uvParam = uvParam.clone();
  }

  public static create(props: VertexKeyProps): VertexKey { return new VertexKey(props.position, props.fillColor, props.normal, props.uvParam); }

  public equals(rhs: VertexKey): boolean {
    assert(this.normalValid === rhs.normalValid);

    if (!this.position.equals(rhs.position) || this.octEncodedNormal !== rhs.octEncodedNormal || this.fillColor !== rhs.fillColor)
      return false;

    if (undefined === this.uvParam) {
      assert(undefined === rhs.uvParam);
      return true;
    } else {
      assert(undefined !== rhs.uvParam);
      return this.uvParam.isAlmostEqual(rhs.uvParam!, 0.1);
    }
  }

  public compare(rhs: VertexKey): number {
    if (this === rhs)
      return 0;

    let diff = this.position.compare(rhs.position);
    if (0 === diff) {
      diff = this.octEncodedNormal - rhs.octEncodedNormal;
      if (0 === diff) {
        diff = this.fillColor - rhs.fillColor;
        if (0 === diff && undefined !== this.uvParam) {
          assert(undefined !== rhs.uvParam);
          diff = compareWithTolerance(this.uvParam.x, rhs.uvParam!.x);
          if (0 === diff) {
            diff = compareWithTolerance(this.uvParam.x, rhs.uvParam!.y);
          }
        }
      }
    }

    return diff;
  }
}

export class VertexMap extends IndexMap<VertexKey> {
  public constructor() { super(compare); }

  public insertKey(props: VertexKeyProps, onInsert?: (vk: VertexKey) => any): number {
    return this.insert(VertexKey.create(props), onInsert);
  }
}
