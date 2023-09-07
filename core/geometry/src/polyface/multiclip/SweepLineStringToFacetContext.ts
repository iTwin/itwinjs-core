/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Transform } from "../../geometry3d/Transform";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { AnnounceDrapePanel } from "../PolyfaceQuery";
import { Range3d } from "../../geometry3d/Range";
import { Geometry } from "../../Geometry";
import { Polyface } from "../Polyface";
import { ClipPlane } from "../../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../../clipping/ConvexClipPlaneSet";
import { IndexedXYZCollectionPolygonOps, Point3dArrayPolygonOps } from "../../geometry3d/PolygonOps";
import { Matrix3d } from "../../geometry3d/Matrix3d";

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

/**
 * Context for sweeping a line segment onto a convex polygon.
 * @internal
 */
export class EdgeClipData {
  /** Plane containing the edge and sweep vector */
  public edgePlane: ClipPlane;
  /** Two clip planes facing each other at each end of the edge */
  public clip: ConvexClipPlaneSet;
  /** work array for clipper method */
  private _crossingPoints: Point3d[];

  /** CAPTURE the planes */
  public constructor(edgePlane: ClipPlane, clip: ConvexClipPlaneSet) {
    this.edgePlane = edgePlane;
    this.clip = clip;
    this._crossingPoints = [];
  }
  /** create object from segment and sweep. Inputs are not captured. */
  public static createPointPointSweep(pointA: Point3d, pointB: Point3d, sweep: Vector3d): EdgeClipData | undefined {
    const edgeVector = Vector3d.createStartEnd(pointA, pointB);
    const fraction = edgeVector.fractionOfProjectionToVector(sweep);
    // The unbounded plane of the swept edge will intersect facets in lines that may extend beyond the swept bounded line.
    // That linework will be clipped between two facing planes with normal along the perpendicular dropped from the edge vector to the sweep vector.
    const clipNormal = edgeVector.plusScaled(sweep, -fraction);
    const planeA = ClipPlane.createNormalAndPoint(clipNormal, pointA);
    const planeB = ClipPlane.createNormalAndPoint(clipNormal, pointB);
    const edgePlane = ClipPlane.createOriginAndVectors(pointA, edgeVector, sweep);
    if (planeA !== undefined && planeB !== undefined && edgePlane !== undefined) {
      planeB.negateInPlace();
      const clipper = ConvexClipPlaneSet.createPlanes([planeA, planeB]);
      return new EdgeClipData(edgePlane, clipper);
    }
    return undefined;
  }

  /** Intersect this edge plane with the given convex polygon and announce the intersection segment to the callback. */
  public processPolygon(polygon: Point3d[] | GrowableXYZArray, announceEdge: (pointA: Point3d, pointB: Point3d) => void) {
    this._crossingPoints.length = 0;
    if (Array.isArray(polygon))
      Point3dArrayPolygonOps.polygonPlaneCrossings(this.edgePlane, polygon, this._crossingPoints);
    else
      IndexedXYZCollectionPolygonOps.polygonPlaneCrossings(this.edgePlane, polygon, this._crossingPoints);
    if (this._crossingPoints.length === 2) {
      // use the end planes to clip the [0,1] swept edge to [f0,f1]
      this.clip.announceClippedSegmentIntervals(0, 1, this._crossingPoints[0], this._crossingPoints[1],
        (f0: number, f1: number) => {
          announceEdge(this._crossingPoints[0].interpolate(f0, this._crossingPoints[1]),
            this._crossingPoints[0].interpolate(f1, this._crossingPoints[1]));
        },
      );
    }
  }
}
/**
 * Context for sweeping a line string onto a convex polygon.
 * @internal
 */
export class ClipSweptLineStringContext {
  private _edgeClippers: EdgeClipData[];
  private _localToWorld?: Transform;
  private _worldToLocal?: Transform;
  private _localRange?: Range3d;
  private constructor(edgeData: EdgeClipData[], localData: undefined | { localToWorld: Transform, worldToLocal: Transform, localRange: Range3d }) {
    this._edgeClippers = edgeData;
    if (localData !== undefined) {
      this._localToWorld = localData.localToWorld;
      this._worldToLocal = localData.worldToLocal;
      this._localRange = localData.localRange;
    }
  }
  public static create(xyz: GrowableXYZArray, sweepVector: Vector3d | undefined): ClipSweptLineStringContext | undefined {
    if (sweepVector === undefined)
      sweepVector = Vector3d.create(0, 0, 1);
    if (xyz.length > 1) {
      const point = Point3d.createZero();
      const newPoint = Point3d.createZero();
      const edgeData: EdgeClipData[] = [];
      xyz.getPoint3dAtUncheckedPointIndex(0, point);

      let localToWorldMatrix = Matrix3d.createRigidHeadsUp(sweepVector);
      if (localToWorldMatrix === undefined)
        localToWorldMatrix = Matrix3d.createIdentity();
      const localToWorld = Transform.createOriginAndMatrix(point, localToWorldMatrix);
      const worldToLocal = localToWorld.inverse()!;
      const localRange = xyz.getRange(worldToLocal);
      for (let i = 1; i < xyz.length; i++) {
        xyz.getPoint3dAtUncheckedPointIndex(i, newPoint);
        const clipper = EdgeClipData.createPointPointSweep(point, newPoint, sweepVector);
        if (clipper !== undefined) {
          point.setFrom(newPoint);
          edgeData.push(clipper);
        }
      }
      return new ClipSweptLineStringContext(edgeData, { localToWorld, worldToLocal, localRange });
    }
    return undefined;
  }
  /**
   * Intersect a polygon with each of the edgeClippers.
   * * If transforms and local range are defined, test the polygon's local range to see if it offers a quick exit.
   */
  public processPolygon(polygon: Point3d[], announceEdge: (pointA: Point3d, pointB: Point3d) => void) {
    if (this._worldToLocal !== undefined && this._localRange !== undefined) {
      const polygonRange = Range3d.createTransformedArray(this._worldToLocal, polygon);
      if (!polygonRange.intersectsRangeXY(this._localRange))
        return;
    }
    for (const clipper of this._edgeClippers) {
      clipper.processPolygon(polygon, announceEdge);
    }
  }
}
