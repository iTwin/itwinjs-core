/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { AnyRegion } from "../CurveChain";
import { CurveIntervalRole, CurveLocationDetail } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { Loop } from "../Loop";
import { ParityRegion } from "../ParityRegion";
import { UnionRegion } from "../UnionRegion";

/**
 * Context for testing containment in Loop, ParityRegion and UnionRegion.
 * @internal
 */
export class PointInOnOutContext {
  /**
   * In-out test for a single loop.
   * * Test by finding intersections with an xy line (xyz plane) in "some" direction.
   * * Test logic gets complicated if the plane has a vertex hit.
   * * If that happens, don't try to figure out the cases.   Just move on to another plane.
   * * Any "on" point triggers immediate 0 return.
   *   * (Hence if there are overlapping lines their self-canceling effect might be wrong.)
   * @param loop
   * @param x tested x coordinate
   * @param y tested y coordinate
   */
  public static testPointInOnOutLoopXY(loop: Loop, x: number, y: number): number {
    let plane: Plane3dByOriginAndUnitNormal;
    const xy = Point3d.create(x, y);
    for (let radians = 0.0; Math.abs(radians) < 6.0; radians = -1.2313 * (radians + 0.3212897)) {
      plane = Plane3dByOriginAndUnitNormal.createXYAngle(x, y, Angle.createRadians(radians))!;
      const normal = plane.getNormalRef();
      const intersections: CurveLocationDetail[] = [];
      for (const cp of loop.children) {
        if (cp instanceof CurvePrimitive)
          cp.appendPlaneIntersectionPoints(plane, intersections);
      }
      CurvePrimitive.snapAndRestrictDetails(intersections, false, true);
      let numLeft = 0;
      let numRight = 0;
      let numTricky = 0;
      let wx, wy;
      // Count simple crossings to left and right.
      // Also count tricky crossings (vertex hits, onEdge)
      // If there are any tricky ones, go around with a different plane.
      // A intently devious tester could make every plane hit tricky things.
      for (const intersection of intersections) {
        if (intersection.intervalRole !== CurveIntervalRole.isolated
          && intersection.intervalRole !== undefined) {
          numTricky++;
        }
        wx = intersection.point.x - x;
        wy = intersection.point.y - y;
        if (Geometry.isSameCoordinateXY(wx, wy, 0, 0))
          return 0;
        const cross = Geometry.crossProductXYXY(normal.x, normal.y, wx, wy);
        if (xy.isAlmostEqualXY(intersection.point))
          return 0;
        if (cross < 0.0)
          numLeft++;
        else if (cross > 0.0)
          numRight++;
      }
      if (numTricky !== 0) // try another angle !!
        continue;
      const leftParity = numLeft & (0x01);
      const rightParity = numRight & (0x01);
      if (leftParity === rightParity)
        return leftParity === 1 ? 1 : -1;
    }
    return -1;
  }
  /**
   * strongly-typed parity region handling: XOR of all loops. (But any ON is returned as edge hit.)
   * @param parent
   * @param x
   * @param y
   */
  public static testPointInOnOutParityRegionXY(parent: ParityRegion, x: number, y: number): number {
    let result = -1;
    for (const loop of parent.children) {
      if (loop instanceof Loop) {
        const q = this.testPointInOnOutLoopXY(loop, x, y);
        if (q === 0)
          return 0;
        if (q > 0)
          result = - result;
      }
    }
    return result;
  }
  public static testPointInOnOutUnionRegionXY(parent: UnionRegion, x: number, y: number): number {
    for (const loop of parent.children) {
      const classify = this.testPointInOnOutRegionXY(loop, x, y);
      if (classify >= 0)
        return classify;
    }
    return -1;
  }
  public static testPointInOnOutRegionXY(parent: AnyRegion, x: number, y: number): number {
    if (parent instanceof Loop)
      return this.testPointInOnOutLoopXY(parent, x, y);
    else if (parent instanceof ParityRegion)
      return this.testPointInOnOutParityRegionXY(parent, x, y);
    else if (parent instanceof UnionRegion)
      return this.testPointInOnOutUnionRegionXY(parent, x, y);
    return -1;
  }

}
