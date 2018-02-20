/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d } from "@bentley/geometry-core/lib/PointVector";

export abstract class Iterable<T> {
  constructor(protected list: T[]) {}
  public [Symbol.iterator]() {
    let key = 0;
    return { next: (): IteratorResult<T> => { const result = key < this.list.length ? { value: this.list[key], done: false } : { value: this.list[key - 1], done: true }; key++; return result; } };
  }
}

export class GraphicBuilderTileCorners extends Iterable<Point3d> {
  constructor(public pts: [ Point3d, Point3d, Point3d, Point3d ] ) { super(pts); }
}
