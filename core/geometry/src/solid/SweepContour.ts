/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Vector3d } from "../geometry3d/Point3dVector3d";
import { Transform } from "../geometry3d/Transform";

import { CurveCollection } from "../curve/CurveCollection";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { Ray3d } from "../geometry3d/Ray3d";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { Triangulator } from "../topology/Triangulation";
import { LineString3d } from "../curve/LineString3d";
import { AnyCurve } from "../curve/CurveChain";
import { ParityRegion } from "../curve/ParityRegion";
import { Loop } from "../curve/Loop";
import { StrokeOptions } from "../curve/StrokeOptions";
import { PolygonOps } from "../geometry3d/PolygonOps";

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
  /** Apply `tansform` to the curves, axis.
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
   * @param _builder (NOT USED -- an internal builder is constructed for the triangulation)
   * @param options options for stroking the curves.
   */
  public buildFacets(_builder: PolyfaceBuilder, options: StrokeOptions | undefined): void {
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
          const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
          this._facets = unflippedPoly;
          this._facets.tryTransformInPlace(this.localToWorld);
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
          if (graph) {
            const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
            this._facets = unflippedPoly;
            this._facets.tryTransformInPlace(this.localToWorld);
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
    this.buildFacets(builder, builder.options);
    if (this._facets)
      builder.addIndexedPolyface(this._facets, reverse, transform);
  }
}
