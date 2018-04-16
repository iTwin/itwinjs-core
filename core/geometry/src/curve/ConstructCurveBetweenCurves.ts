/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { GeometryQuery } from "./CurvePrimitive";
import { NullGeometryHandler } from "../GeometryHandler";

import { LineSegment3d } from "./LineSegment3d";
import { Arc3d } from "./Arc3d";
import { Point3d } from "../PointVector";
import { LineString3d } from "./LineString3d";

export class ConstructCurveBetweenCurves extends NullGeometryHandler {
  // private geometry0: GeometryQuery;  <-- Never used
  private geometry1: GeometryQuery;
  private fraction: number;
  private constructor(_geometry0: GeometryQuery, _fraction: number, _geometry1: GeometryQuery) {
    super();
    // this.geometry0 = _geometry0;   <-- Never used
    this.geometry1 = _geometry1;
    this.fraction = _fraction;
  }

  public handleLineSegment3d(segment0: LineSegment3d): any {
    if (this.geometry1 instanceof LineSegment3d) {
      const segment1 = this.geometry1 as LineSegment3d;
      return LineSegment3d.create(
        segment0.startPoint().interpolate(this.fraction, segment1.startPoint()),
        segment0.endPoint().interpolate(this.fraction, segment1.endPoint()));
    }
    return undefined;
  }

  public handleLineString3d(ls0: LineString3d): any {
    if (this.geometry1 instanceof LineString3d) {
      const ls1 = this.geometry1 as LineString3d;
      if (ls0.numPoints() === ls1.numPoints()) {
        const ls = LineString3d.create();
        const workPoint = Point3d.create();
        const workPoint0 = Point3d.create();
        const workPoint1 = Point3d.create();
        for (let i = 0; i < ls0.numPoints(); i++) {
          ls0.pointAt(i, workPoint0);
          ls1.pointAt(i, workPoint1);
          workPoint0.interpolate(this.fraction, workPoint1, workPoint);
          ls.addPoint(workPoint);
        }
        return ls;
      }
    }
    return undefined;
  }

  public handleArc3d(arc0: Arc3d): any {
    if (this.geometry1 instanceof Arc3d) {
      const arc1 = this.geometry1 as Arc3d;
      return Arc3d.create(
        arc0.center.interpolate(this.fraction, arc1.center),
        arc0.vector0.interpolate(this.fraction, arc1.vector0),
        arc0.vector90.interpolate(this.fraction, arc1.vector90),
        arc0.sweep.interpolate(this.fraction, arc1.sweep));
    }
    return undefined;
  }

  public static InterpolateBetween(geometry0: GeometryQuery, fraction: number, geometry1: GeometryQuery): GeometryQuery | undefined {
    const handler = new ConstructCurveBetweenCurves(geometry0, fraction, geometry1);
    return geometry0.dispatchToGeometryHandler(handler);
  }
}
