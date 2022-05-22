/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Transform } from "../../geometry3d/Transform";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { AnnounceDrapePanel } from "../PolyfaceQuery";
import { Range3d } from "../../geometry3d/Range";
import { Geometry } from "../../Geometry";
import { Polyface } from "../Polyface";

export class SweepLineStringToFacetContext {
  private _spacePoints: GrowableXYZArray;
  private _spacePointsRange: Range3d;
  private _numSpacePoints: number;
  private constructor(spacePoints: GrowableXYZArray) {
    this._spacePoints = spacePoints;
    this._spacePointsRange = new Range3d();
    spacePoints.setRange(this._spacePointsRange);
    this._numSpacePoints = this._spacePoints.length;
  }
  public static create(xyz: GrowableXYZArray): SweepLineStringToFacetContext | undefined {
    if (xyz.length > 1) {
      return new SweepLineStringToFacetContext(xyz.clone());
    }
    return undefined;
  }

  // temporaries reused over multiple calls to process a single facet . ..
  private _segmentPoint0 = Point3d.create();
  private _segmentPoint1 = Point3d.create();
  private _localSegmentPoint0 = Point3d.create();
  private _localSegmentPoint1 = Point3d.create();
  private _clipFractions = Segment1d.create(0, 1);
  private _localFrame = Transform.createIdentity();
  private _polygonRange = Range3d.create();

  /** process a single polygon.
   * @returns number crudely indicating how much work was done.
   */
  public projectToPolygon(polygon: GrowableXYZArray, announce: AnnounceDrapePanel, polyface: Polyface, readIndex: number): number {
    polygon.setRange(this._polygonRange);
    let workCounter = 0;
    if (!this._polygonRange.intersectsRangeXY(this._spacePointsRange))
      return workCounter;
    // numTest++;
    // For each triangle within the facet ...
    // remark: this loop only runs once in triangle mesh, twice in quads ...
    for (let k1 = 1; k1 + 1 < polygon.length; k1++) {
      workCounter++;
      const frame = polygon.fillLocalXYTriangleFrame(0, k1, k1 + 1, this._localFrame);
      if (frame) {
        // For each stroke of the linestring ...
        for (let i1 = 1; i1 < this._numSpacePoints; i1++) {
          workCounter++;
          this._spacePoints.getPoint3dAtCheckedPointIndex(i1 - 1, this._segmentPoint0);
          this._spacePoints.getPoint3dAtCheckedPointIndex(i1, this._segmentPoint1);
          frame.multiplyInversePoint3d(this._segmentPoint0, this._localSegmentPoint0);
          frame.multiplyInversePoint3d(this._segmentPoint1, this._localSegmentPoint1);
          this._clipFractions.set(0, 1);
          /** (x,y,1-x-y) are barycentric coordinates in the triangle !!! */
          if (this._clipFractions.clipBy01FunctionValuesPositive(this._localSegmentPoint0.x, this._localSegmentPoint1.x)
            && this._clipFractions.clipBy01FunctionValuesPositive(this._localSegmentPoint0.y, this._localSegmentPoint1.y)
            && this._clipFractions.clipBy01FunctionValuesPositive(
              1 - this._localSegmentPoint0.x - this._localSegmentPoint0.y,
              1 - this._localSegmentPoint1.x - this._localSegmentPoint1.y)) {
            /* project the local segment point to the plane. */
            workCounter++;
            const localClippedPointA = this._localSegmentPoint0.interpolate(this._clipFractions.x0, this._localSegmentPoint1);
            const localClippedPointB = this._localSegmentPoint0.interpolate(this._clipFractions.x1, this._localSegmentPoint1);
            const worldClippedPointA = this._localFrame.multiplyPoint3d(localClippedPointA)!;
            const worldClippedPointB = this._localFrame.multiplyPoint3d(localClippedPointB)!;
            const planePointA = this._localFrame.multiplyXYZ(localClippedPointA.x, localClippedPointA.y, 0.0)!;
            const planePointB = this._localFrame.multiplyXYZ(localClippedPointB.x, localClippedPointB.y, 0.0)!;
            const splitParameter = Geometry.inverseInterpolate01(this._localSegmentPoint0.z, this._localSegmentPoint1.z);
            // emit 1 or 2 panels, oriented so panel normal is always to the left of the line.
            if (splitParameter !== undefined && splitParameter > this._clipFractions.x0 && splitParameter < this._clipFractions.x1) {
              workCounter++;
              const piercePointX = this._segmentPoint0.interpolate(splitParameter, this._segmentPoint1);
              const piercePointY = piercePointX.clone();   // so points are distinct for the two triangle announcements.
              announce(this._spacePoints, i1 - 1, polyface, readIndex, [worldClippedPointA, piercePointX, planePointA], 2, 1);
              announce(this._spacePoints, i1 - 1, polyface, readIndex, [worldClippedPointB, piercePointY, planePointB], 1, 2);
            } else if (this._localSegmentPoint0.z > 0) {  // segment is entirely above
              announce(this._spacePoints, i1 - 1, polyface, readIndex, [worldClippedPointA, worldClippedPointB, planePointB, planePointA], 3, 2);
            } else // segment is entirely under
              announce(this._spacePoints, i1 - 1, polyface, readIndex, [worldClippedPointB, worldClippedPointA, planePointA, planePointB], 2, 3);
          }
        }
      }
    }
    return workCounter;
  }
}
