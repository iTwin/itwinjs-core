/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../../Geometry";
import { NullGeometryHandler } from "../../geometry3d/GeometryHandler";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolylineCompressionContext } from "../../geometry3d/PolylineCompressionByEdgeOffset";
import { PolylineOps } from "../../geometry3d/PolylineOps";
import { Arc3d } from "../Arc3d";
import { CurveChain } from "../CurveCollection";
import { CurveFactory } from "../CurveFactory";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { Loop } from "../Loop";
import { ParityRegion } from "../ParityRegion";
import { Path } from "../Path";
import { ConsolidateAdjacentCurvePrimitivesOptions } from "../RegionOps";
import { UnionRegion } from "../UnionRegion";

/**
 * * Implementation class for ConsolidateAdjacentCurvePrimitives.
 *
 * @internal
 */
export class ConsolidateAdjacentCurvePrimitivesContext extends NullGeometryHandler {
  private _options: ConsolidateAdjacentCurvePrimitivesOptions;
  public constructor(options?: ConsolidateAdjacentCurvePrimitivesOptions) {
    super();
    this._options = options ? options : new ConsolidateAdjacentCurvePrimitivesOptions();
  }
  /** look for adjacent compatible primitives in a path or loop. */
  public handleCurveChain(g: CurveChain): void {
    const children = g.children;
    const numOriginal = children.length;
    const points: Point3d[] = [];
    let numAccept = 0;
    // i0 <= i < i1 is a range of child indices.
    // numAccept is the number of children accepted (contiguously at front of children)
    for (let i0 = 0; i0 < numOriginal;) {
      const basePrimitive = g.children[i0];
      if (this._options.consolidateLinearGeometry && (basePrimitive instanceof LineSegment3d || basePrimitive instanceof LineString3d)) {
        points.length = 0;
        let i1 = i0;
        // on exit, i1 is beyond the block of linear primitives  . ..
        for (; i1 < g.children.length; i1++) {
          const nextPrimitive = g.children[i1];
          if (nextPrimitive instanceof LineSegment3d) {
            points.push(nextPrimitive.startPoint());
            points.push(nextPrimitive.endPoint());
          } else if (nextPrimitive instanceof LineString3d) {
            const source = nextPrimitive.packedPoints;
            for (let k = 0; k < source.length; k++) {
              points.push(source.getPoint3dAtUncheckedPointIndex(k));
            }
          } else {
            break;
          }
        }
        if (points.length <= 1) {
          g.children[numAccept++] = basePrimitive;
        } else if (this._options.disableLinearCompression) {
          const pointsDeduped = PolylineOps.compressShortEdges(points, Geometry.smallFloatingPoint); // remove only exact duplicate interior points
          g.children[numAccept++] = LineString3d.createPoints(pointsDeduped);
        } else { // compress points
          const compressedPointsA = PolylineOps.compressShortEdges(points, this._options.duplicatePointTolerance);
          const compressedPointsB = PolylineOps.compressByChordError(compressedPointsA, this._options.colinearPointTolerance, true);
          if (i0 === 0 && i1 === numOriginal && this._options.consolidateLoopSeam) {
            // points is the entire curve: if the curve is physically closed and end segments are colinear, re/move the seam
            PolylineCompressionContext.compressColinearWrapInPlace(compressedPointsB, this._options.duplicatePointTolerance, this._options.colinearPointTolerance);
          }
          if (compressedPointsB.length < 2) {
            // Collapsed to a point?  Make a single point linestring
            g.children[numAccept++] = LineString3d.create(compressedPointsB[0]);
          } else if (compressedPointsB.length === 2) {
            g.children[numAccept++] = LineSegment3d.create(compressedPointsB[0], compressedPointsB[1]);
          } else {
            g.children[numAccept++] = LineString3d.createPoints(compressedPointsB);
          }
        }
        i0 = i1;
      } else if (this._options.consolidateCompatibleArcs && basePrimitive instanceof Arc3d) {
        // subsume subsequent arcs into basePrimitive.
        // always accept base primitive.
        for (; ++i0 < g.children.length;) {
          const nextPrimitive = g.children[i0];
          if (!(nextPrimitive instanceof Arc3d))
            break;
          if (!CurveFactory.appendToArcInPlace(basePrimitive, nextPrimitive, false, this._options.duplicatePointTolerance))
            break;
        }
        // i0 has already advanced
        g.children[numAccept++] = basePrimitive; // which has been extended 0 or more times.
      } else {
        g.children[numAccept++] = basePrimitive;
        i0++;
      }
    }
    g.children.length = numAccept;
  }

  public override handlePath(g: Path): any {
    return this.handleCurveChain(g);
  }
  public override handleLoop(g: Loop): any {
    this.handleCurveChain(g);
    if (g.children.length > 1 && this._options.consolidateLoopSeam) {
      const lastChild = g.children[g.children.length - 1];
      const firstChild = g.children[0];
      if ((lastChild instanceof LineSegment3d || lastChild instanceof LineString3d) && (firstChild instanceof LineSegment3d || firstChild instanceof LineString3d)) {
        if (this._options.consolidateLinearGeometry && !this._options.disableLinearCompression) {
          const lastPoints = lastChild.points;
          lastPoints.pop(); // the original start point survives as an interior point in the new first primitive
          g.children[0] = LineString3d.createPoints([...lastPoints, ...firstChild.points]);
          g.children.pop();
        }
      } else if (lastChild instanceof Arc3d && firstChild instanceof Arc3d) {
        if (this._options.consolidateCompatibleArcs) {
          if (CurveFactory.appendToArcInPlace(lastChild, firstChild, false, this._options.duplicatePointTolerance)) {
            g.children[0] = lastChild;
            g.children.pop();
          }
        }
      }
    }
  }
  public override handleParityRegion(g: ParityRegion): any {
    for (const child of g.children)
      child.dispatchToGeometryHandler(this);
  }
  public override handleUnionRegion(g: UnionRegion): any {
    for (const child of g.children)
      child.dispatchToGeometryHandler(this);
  }
}
