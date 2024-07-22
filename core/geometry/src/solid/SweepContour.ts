/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Solid
 */

import { ClipPlane } from "../clipping/ClipPlane";
import { ConvexClipPlaneSet } from "../clipping/ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "../clipping/UnionOfConvexClipPlaneSets";
import { CurveCollection } from "../curve/CurveCollection";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { AnyCurve, AnyRegion } from "../curve/CurveTypes";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { ParityRegion } from "../curve/ParityRegion";
import { Path } from "../curve/Path";
import { RegionOps } from "../curve/RegionOps";
import { StrokeOptions } from "../curve/StrokeOptions";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { MultiLineStringDataVariant } from "../geometry3d/IndexedXYZCollection";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";

/**
 * Sweepable planar contour with Transform for local to world interaction.
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

  /** caches */
  private _xyStrokes?: CurveCollection;
  private _facets?: IndexedPolyface;

  private constructor(contour: AnyCurve, map: Transform, axis: Ray3d | undefined) {
    if (contour instanceof CurvePrimitive) {
      // this.curves is a CurveCollection (not AnyCurve) so that contour type determines closure.
      // This is the only time we detect CurvePrimitive closure and wrap as a relevant CurveChain.
      // Note that we are ASSUMING closure means planar here. This is potentially problematic.
      const primitive = contour;
      contour = contour.startPoint().isAlmostEqual(contour.endPoint()) ? new Loop() : new Path();
      contour.tryAddChild(primitive);
    }
    this.curves = contour;
    this.localToWorld = map;
    this.axis = axis;
  }
  /** Create for linear sweep.
   * @param contour curve to sweep, CAPTURED. For best results, contour should be planar.
   * @param defaultNormal optional default normal for guiding coordinate frame setup.
   */
  public static createForLinearSweep(contour: AnyCurve, defaultNormal?: Vector3d): SweepContour | undefined {
    const localToWorld = FrameBuilder.createRightHandedFrame(defaultNormal, contour);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld, undefined);
    }
    return undefined;
  }
  /** Create for linear sweep.
   * @param points polygon to sweep, CAPTURED as a Loop. Closure point is optional. If multiple polygons are passed in, parity logic is employed.
   * For best results, all points should be coplanar.
   * @param defaultNormal optional default normal for guiding coordinate frame setup.
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
   * @param contour curve to sweep, CAPTURED. For best results, contour should be planar.
   * @param axis rotation axis
   */
  public static createForRotation(contour: AnyCurve, axis: Ray3d): SweepContour | undefined {
    // createRightHandedFrame -- the axis is a last-gasp resolver for in-plane vectors.
    const localToWorld = FrameBuilder.createRightHandedFrame(undefined, contour, axis);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld, axis.clone());
    }
    return undefined;
  }
  /** Return (Reference to) the curves */
  public getCurves(): CurveCollection { return this.curves; }
  /**
   * Apply `transform` to the curves, axis.
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
        this._xyStrokes = undefined;
        return true;
      }
    }
    return false;
  }
  /** Return a deep clone. */
  public clone(): SweepContour {
    return new SweepContour(this.curves.clone(), this.localToWorld.clone(), this.axis);
  }
  /** Return a transformed clone. */
  public cloneTransformed(transform: Transform): SweepContour | undefined {
    const newContour = this.clone();
    if (newContour.tryTransformInPlace(transform))
      return newContour;
    return undefined;
  }
  /** Test for near equality of curves, frame, and axis. */
  public isAlmostEqual(other: any): boolean {
    if (! (other instanceof SweepContour))
      return false;
    if (!this.curves.isAlmostEqual(other.curves))
      return false;
    if (!this.localToWorld.isAlmostEqual(other.localToWorld))
      return false;
    if (this.axis && other.axis) {
      if (!this.axis.isAlmostEqual(other.axis))
        return false;
    } else if (this.axis || other.axis)
      return false;
    return true;
  }

  /** Recompute the local strokes cache for this contour */
  public computeXYStrokes(options?: StrokeOptions): void {
    this._xyStrokes = undefined;
    const worldToLocal = this.localToWorld.inverse();
    if (worldToLocal) {
      const strokes = this.curves.cloneStroked(options);
      if (strokes.tryTransformInPlace(worldToLocal))
        this._xyStrokes = strokes;
    }
  }
  /** Return cached contour strokes */
  public get xyStrokes(): CurveCollection | undefined {
    return this._xyStrokes;
  }

  /**
   * Build the (cached) internal facets for the contour.
   * @param options primarily how to stroke the contour, but also how to facet it.
   * * By default, a triangulation is computed, but if `options.maximizeConvexFacets === true`, edges between coplanar triangles are removed to return maximally convex facets.
   */
  public buildFacets(options?: StrokeOptions): void {
    if (this._facets)
      return;
    if (!this.curves.isAnyRegion())
      return;
    const worldToLocal = this.localToWorld.inverse();
    if (!worldToLocal)
      return;
    const localRegion = this.curves.cloneTransformed(worldToLocal) as AnyRegion | undefined;
    if (!localRegion)
      return;
    if (this._facets = RegionOps.facetRegionXY(localRegion, options))
      this._facets.tryTransformInPlace(this.localToWorld);
  }
  /**
   * Delete facet cache.
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
   * @param announce callback to receive the facet set
   * @param options how to stroke the contour
   */
  public announceFacets(announce: (facets: IndexedPolyface) => void, options?: StrokeOptions): void {
    this.buildFacets(options);
    if (this._facets)
      announce(this._facets);
  }
  /**
   * Create a UnionOfConvexClipPlaneSets that clips to the swept faceted contour region.
   * @param sweepVector the sweep direction and distance:
   * * If undefined, the sweep direction is along the contour normal and no caps are constructed (the sweep is infinite in both directions).
   * * If defined, the returned clipper is inverted if and only if sweepVector is in the opposite half-space as the computed contour normal.
   * @param cap0 construct a clip plane equal to the contour plane. Note that `sweepVector` must be defined.
   * @param cap1 construct a clip plane parallel to the contour plane at the end of `sweepVector`.
   * @param options how to stroke the contour
   * @returns clipper defined by faceting then sweeping the contour region
   */
  public sweepToUnionOfConvexClipPlaneSets(sweepVector?: Vector3d, cap0: boolean = false, cap1: boolean = false, options?: StrokeOptions): UnionOfConvexClipPlaneSets | undefined {
    if (!options)
      options = StrokeOptions.createForFacets();
    if (!sweepVector) {
      cap0 = cap1 = false;
      sweepVector = this.localToWorld.matrix.columnZ();
    }
    options.maximizeConvexFacets = true;  // produce fewer ConvexClipPlaneSets
    // It's a trip around the barn, but it's easy to make a polyface and scan it . . .
    this.buildFacets(options);
    const facets = this._facets;
    if (facets) {
      const point0 = Point3d.create();
      const point1 = Point3d.create();
      const result = UnionOfConvexClipPlaneSets.createEmpty();
      const visitor = facets.createVisitor(1);
      for (visitor.reset(); visitor.moveToNextFacet();) {
        const numEdges = visitor.point.length - 1;
        const clipper = ConvexClipPlaneSet.createEmpty();
        for (let i = 0; i < numEdges; i++) {
          visitor.point.getPoint3dAtUncheckedPointIndex(i, point0);
          visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, point1);
          const plane = ClipPlane.createEdgeAndUpVector(point1, point0, sweepVector);
          const visible = visitor.edgeVisible[i];
          plane?.setFlags(!visible, !visible);
          clipper.addPlaneToConvexSet(plane);
        }
        result.addConvexSet(clipper);
      }
      if (cap0 || cap1) {
        const zVector = this.localToWorld.matrix.columnZ();
        const plane0Origin = this.localToWorld.getOrigin();
        const plane1Origin = plane0Origin.plus(sweepVector);
        const inwardNormal0 = zVector.clone();
        const inwardNormal1 = zVector.negate();
        const clipper = ConvexClipPlaneSet.createEmpty();
        if (cap0)
          clipper.addPlaneToConvexSet(ClipPlane.createNormalAndPoint(inwardNormal0, plane0Origin));
        if (cap1)
          clipper.addPlaneToConvexSet(ClipPlane.createNormalAndPoint(inwardNormal1, plane1Origin));
        result.addConvexSet(clipper);
      }
      return result;
    }
    return undefined;
  }
}
