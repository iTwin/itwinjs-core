/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Vector3d } from "../PointVector";
import { Transform } from "../Transform";

import { CurveCollection } from "../curve/CurveChain";
import { FrameBuilder } from "../FrameBuilder";
import { Ray3d } from "../AnalyticGeometry";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { Triangulator } from "../topology/Triangulation";
import { LineString3d } from "../curve/LineString3d";
import { AnyCurve, Loop, ParityRegion } from "../curve/CurveChain";
import { StrokeOptions } from "../curve/StrokeOptions";
import { PolygonOps } from "../PointHelpers";

/**
 * Sweepable contour with Transform for local to world interaction.
 */
export class SweepContour {
  public curves: CurveCollection;
  public localToWorld: Transform;

  private constructor(contour: CurveCollection, map: Transform) {
    this.curves = contour;
    this.localToWorld = map;
  }
  public static createForLinearSweep(contour: CurveCollection, defaultNormal?: Vector3d): SweepContour | undefined {
    const localToWorld = FrameBuilder.createRightHandedFrame(defaultNormal, contour);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld);
    }
    return undefined;
  }
  public static createForRotation(contour: CurveCollection, axis: Ray3d): SweepContour | undefined {
    // createRightHandedFrame -- the axis is a last-gasp resolver for in-plane vectors.
    const localToWorld = FrameBuilder.createRightHandedFrame(undefined, contour, axis);
    if (localToWorld) {
      return new SweepContour(contour, localToWorld);
    }
    return undefined;
  }
  public getCurves(): CurveCollection { return this.curves; }
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this.localToWorld, this.localToWorld);
    return true;
  }
  public clone(): SweepContour {
    return new SweepContour(this.curves.clone() as CurveCollection, this.localToWorld.clone());
  }
  public cloneTransformed(transform: Transform): SweepContour | undefined {
    const newContour = this.clone();
    if (newContour.tryTransformInPlace(transform))
      return newContour;
    return undefined;
  }
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
          const graph = Triangulator.earcutSingleLoop(points);
          const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
          this._facets = unflippedPoly;
          this._facets.tryTransformInPlace(this.localToWorld);
        }
      } else if (this.curves instanceof ParityRegion) {
        this._xyStrokes = this.curves.cloneStroked(options);
        if (this._xyStrokes instanceof (ParityRegion)) {
          this._xyStrokes.tryTransformInPlace(this.localToWorld);
          const strokes = [];
          for (const childLoop of this._xyStrokes.children) {
            const loopCurves = childLoop.children;
            if (loopCurves.length === 1) {
              const c = loopCurves[0];
              if (c instanceof LineString3d)
                strokes.push(c.packedPoints);
            }
          }
          const graph = Triangulator.triangulateStrokedLoops(strokes);
          if (graph) {
            const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph, options);
            this._facets = unflippedPoly;
            this._facets.tryTransformInPlace(this.localToWorld);
          }
        }
      }
    }
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
