/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";

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
}
