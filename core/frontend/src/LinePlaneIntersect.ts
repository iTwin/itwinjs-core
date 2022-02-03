/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import type { Point3d, Vector3d } from "@itwin/core-geometry";

/** @internal */
export function linePlaneIntersect(outP: Point3d, linePt: Point3d, lineNormal: Vector3d | undefined, planePt: Point3d, planeNormal: Vector3d, perpendicular: boolean): void {
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
