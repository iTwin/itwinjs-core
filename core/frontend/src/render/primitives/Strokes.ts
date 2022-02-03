/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { Point3d, Transform } from "@itwin/core-geometry";
import type { DisplayParams } from "./DisplayParams";

/** @internal */
export class StrokesPrimitivePointList {
  public points: Point3d[];
  constructor(points: Point3d[] = []) { this.points = [...points]; }
}

/** @internal */
export class StrokesPrimitivePointLists extends Array<StrokesPrimitivePointList> { constructor(...args: StrokesPrimitivePointList[]) { super(...args); } }

/** @internal */
export class StrokesPrimitive {
  public readonly displayParams: DisplayParams;
  public readonly isDisjoint: boolean;
  public readonly isPlanar: boolean;
  public strokes: StrokesPrimitivePointLists;

  public static create(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    return new StrokesPrimitive(params, isDisjoint, isPlanar);
  }

  private constructor(params: DisplayParams, isDisjoint: boolean, isPlanar: boolean) {
    this.displayParams = params;
    this.strokes = new StrokesPrimitivePointLists();
    this.isDisjoint = isDisjoint;
    this.isPlanar = isPlanar;
  }

  public transform(trans: Transform) {
    for (const strk of this.strokes) {
      trans.multiplyPoint3dArrayInPlace(strk.points);
    }
  }
}

/** @internal */
export class StrokesPrimitiveList extends Array<StrokesPrimitive> { constructor(...args: StrokesPrimitive[]) { super(...args); } }
