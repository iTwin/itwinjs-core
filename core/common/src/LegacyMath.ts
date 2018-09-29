/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import { Point3d, Vector3d } from "@bentley/geometry-core";

export class LegacyMath {

  public static linePlaneIntersect(outP: Point3d, linePt: Point3d, lineNormal: Vector3d | undefined, planePt: Point3d, planeNormal: Vector3d, perpendicular: boolean): void {
    let dot = 0;
    if (lineNormal)
      dot = lineNormal.dotProduct(planeNormal);
    else
      perpendicular = true;

    let temp: Vector3d;
    if (perpendicular || Math.abs(dot) < .001) {
      const t = linePt.vectorTo(planePt).dotProduct(planeNormal);
      temp = planeNormal.scale(t);
    } else {
      const t = (planeNormal.dotProduct(planePt) - planeNormal.dotProduct(linePt)) / dot;
      temp = lineNormal!.scale(t);
    }
    outP.setFrom(temp.plus(linePt));
  }

  public static normalizedDifference(point1: Point3d, point2: Point3d, out: Vector3d): number { return point2.vectorTo(point1).normalizeWithLength(out).mag; }
  public static normalizedCrossProduct(vec1: Vector3d, vec2: Vector3d, out: Vector3d): number { return vec1.crossProduct(vec2, out).normalizeWithLength(out).mag; }
}
