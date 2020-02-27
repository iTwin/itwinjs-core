/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { Vector3d, Point3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";

import { CurveCollection } from "../curve/CurveCollection";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { Ray3d } from "../geometry3d/Ray3d";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { Triangulator, MultiLineStringDataVariant } from "../topology/Triangulation";
import { LineString3d } from "../curve/LineString3d";
import { AnyCurve } from "../curve/CurveChain";
import { ParityRegion } from "../curve/ParityRegion";
import { Loop } from "../curve/Loop";
import { StrokeOptions } from "../curve/StrokeOptions";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { HalfEdgeGraphSearch } from "../topology/HalfEdgeGraphSearch";
import { RegionOps } from "../curve/RegionOps";
import { UnionOfConvexClipPlaneSets } from "../clipping/UnionOfConvexClipPlaneSets";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { ClipPlane } from "../clipping/ClipPlane";

/**
 * Sweepable contour with Transform for local to world interaction.
 * * The surface/solid classes `LinearSweep`, `RotationalSweep`, `RuledSweep` use this for their swept contours.
 * @public
 */
export class SweepContour {
  /** The underlying curve collection, in its world coordinates position. */
  public curves: CurveCollection;
  /** coordinate frame that in which the curves are all in the xy plane. */
  public localToWorld: Transform;
  /** Axis used only in rotational case. */
  public axis: Ray3d | undefined;

  private constructor(contour: CurveCollection, map: Transform, axis: Ray3d | undefined) {
    this.curves = contour;
    this.localToWorld = map;
    this.axis = axis;
  }
  /** Create for linear sweep.
   * * The optional default normal may be useful for guiding coordinate frame setup.
   * * the contour is CAPTURED.
   */
  public static createForLinearSweep(contour: CurveCollection, defaultNormal?: Vector3d): SweepContour | undefined {
    const localToWorld = FrameBuilder.createRightHandedFrame(defaultNormal, contour);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld, undefined);
    }
    return undefined;
  }

  /** Create for linear sweep.
   * * The optional default normal may be useful for guiding coordinate frame setup.
   * * the points are captured into linestrings and Loops as needed.
   */
  public static createForPolygon(points: MultiLineStringDataVariant, defaultNormal?: Vector3d): SweepContour | undefined {
    const localToWorld = FrameBuilder.createRightHandedFrame(defaultNormal, points);
    if (localToWorld) {
      if (defaultNormal !== undefined) {
        if (localToWorld.matrix.dotColumnZ(defaultNormal))
          localToWorld.matrix.scaleColumnsInPlace(1.0, -1.0, -1.0);
      }
      const linestrings = LineString3d.createArrayOfLineString3d(points);
      const loops = [];
      for (const ls of linestrings) {
        ls.addClosurePoint();
        loops.push(Loop.create(ls));
      }
      if (loops.length === 1) {
        return new SweepContour(loops[0], localToWorld, undefined);
      } else if (loops.length > 1) {
        return new SweepContour(ParityRegion.createLoops(loops), localToWorld, undefined);
      }
    }
    return undefined;
  }

  /** Create for rotational sweep.
   * * The axis ray is retained.
   * * the contour is CAPTURED.
   */
  public static createForRotation(contour: CurveCollection, axis: Ray3d): SweepContour | undefined {
    // createRightHandedFrame -- the axis is a last-gasp resolver for in-plane vectors.
    const localToWorld = FrameBuilder.createRightHandedFrame(undefined, contour, axis);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld, axis.clone());
    }
    return undefined;
  }
  /** Return (Reference to) the curves */
  public getCurves(): CurveCollection { return this.curves; }
  /** Apply `transform` to the curves, axis.
   * * The local to world frame is reconstructed for the transformed curves.
   */
  public tryTransformInPlace(transform: Transform): boolean {
    if (this.curves.tryTransformInPlace(transform)) {
      if (this.axis)
        this.axis.transformInPlace(transform);

      const localToWorld = this.axis !== undefined
        ? FrameBuilder.createRightHandedFrame(undefined, this.curves, this.axis)
        : FrameBuilder.createRightHandedFrame(undefined, this.curves);
      if (localToWorld) {
        this.localToWorld.setFrom(localToWorld);
        return true;
      }
    }
    return false;
  }
  /** Return a deep clone. */
  public clone(): SweepContour {
    return new SweepContour(this.curves.clone() as CurveCollection, this.localToWorld.clone(), this.axis);
  }
  /** Return a transformed clone. */
  public cloneTransformed(transform: Transform): SweepContour | undefined {
    const newContour = this.clone();
    if (newContour.tryTransformInPlace(transform))
      return newContour;
    return undefined;
  }
  /** Test for near equality of cures and local frame. */
  public isAlmostEqual(other: any): boolean {
    if (other instanceof SweepContour) {
      return this.curves.isAlmostEqual(other.curves) && this.localToWorld.isAlmostEqual(other.localToWorld);
    }
    return false;
  }

  private _xyStrokes?: AnyCurve;
  private _facets?: IndexedPolyface;

  /**
   * build the (cached) internal facets.
   * @param options options for stroking the curves.
   */
  public buildFacets(options: StrokeOptions | undefined): void {
    if (!this._facets) {
      if (this.curves instanceof Loop) {
        this._xyStrokes = this.curves.cloneStroked(options);
        if (this._xyStrokes instanceof Loop && this._xyStrokes.children.length === 1) {
          const children = this._xyStrokes.children;
          const linestring = children[0] as LineString3d;
          const points = linestring.points;
          this.localToWorld.multiplyInversePoint3dArrayInPlace(points);
          if (PolygonOps.sumTriangleAreasXY(points) < 0)
            points.reverse();
          const graph = Triangulator.createTriangulatedGraphFromSingleLoop(points);
          if (graph) {
            Triangulator.flipTriangles(graph);
            const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
            this._facets = unflippedPoly;
            this._facets.tryTransformInPlace(this.localToWorld);
          }
        }
      } else if (this.curves instanceof ParityRegion) {
        this._xyStrokes = this.curves.cloneStroked(options);
        if (this._xyStrokes instanceof (ParityRegion)) {
          const worldToLocal = this.localToWorld.inverse()!;
          this._xyStrokes.tryTransformInPlace(worldToLocal);
          const strokes = [];
          for (const childLoop of this._xyStrokes.children) {
            const loopCurves = childLoop.children;
            if (loopCurves.length === 1) {
              const c = loopCurves[0];
              if (c instanceof LineString3d)
                strokes.push(c.packedPoints);
            }
          }
          const graph = Triangulator.createTriangulatedGraphFromLoops(strokes);
          if (graph && HalfEdgeGraphSearch.isTriangulatedCCW(graph)) {
            Triangulator.flipTriangles(graph);
            const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
            this._facets = unflippedPoly;
            this._facets.tryTransformInPlace(this.localToWorld);
          } else {
            // earcut failed. Restart with full merge and parity analysis.
            const polyface = RegionOps.polygonXYAreaUnionLoopsToPolyface(strokes, [], true);
            if (polyface) {
              this._facets = polyface as IndexedPolyface;
              this._facets.tryTransformInPlace(this.localToWorld);
            }
          }
        }
      }
    }
  }
  /** delete existing facets.
   * * This protects against PolyfaceBuilder reusing facets constructed with different options settings.
   */
  public purgeFacets() {
    this._facets = undefined;
  }

  /** Emit facets to a builder.
   * This method may cache and reuse facets over multiple calls.
   */
  public emitFacets(builder: PolyfaceBuilder, reverse: boolean, transform?: Transform) {
    this.buildFacets(builder.options);
    if (this._facets)
      builder.addIndexedPolyface(this._facets, reverse, transform);
  }

  /** Emit facets to a function
   * This method may cache and reuse facets over multiple calls.
   */
  public announceFacets(announce: (facets: IndexedPolyface) => void, options: StrokeOptions | undefined) {
    this.buildFacets(options);
    if (this._facets)
      announce(this._facets);
  }

  /**
   * Triangulate the region.
   * Create a UnionOfConvexClipPlaneSets that clips to the swept region.
   */
  public sweepToUnionOfConvexClipPlaneSets(): UnionOfConvexClipPlaneSets | undefined {
    const builder = PolyfaceBuilder.create();
    // It's a trip around the barn, but it's easy to make a polyface and scan it . . .
    this.buildFacets(builder.options);
    const vectorZ = this.localToWorld.matrix.columnZ();
    const facets = this._facets;
    const point0 = Point3d.create();
    const point1 = Point3d.create();
    if (facets) {
      const result = UnionOfConvexClipPlaneSets.createEmpty();
      const visitor = facets.createVisitor(1);
      for (visitor.reset(); visitor.moveToNextFacet();) {
        const numEdges = visitor.point.length - 1;
        const clipper = ConvexClipPlaneSet.createEmpty();
        for (let i = 0; i < numEdges; i++) {
          visitor.point.getPoint3dAtUncheckedPointIndex(i, point0);
          visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, point1);
          const plane = ClipPlane.createEdgeAndUpVector(point1, point0, vectorZ);
          const visible = visitor.edgeVisible[i];
          plane?.setFlags(!visible, !visible);
          clipper.addPlaneToConvexSet(plane);
        }
        result.addConvexSet(clipper);
      }
      return result;
    }
    return undefined;
  }
}
