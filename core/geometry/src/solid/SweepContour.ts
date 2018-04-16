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
import { Loop } from "../curve/CurveChain";
import { StrokeOptions } from "../curve/StrokeOptions";
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

  private facets?: IndexedPolyface;

  /**
   * build the (cached) internal facets.
   * @param _builder (NOT USED -- an internal builder is constructed for the triangulation)
   * @param options options for stroking the curves.
   */
  public buildFacets(_builder: PolyfaceBuilder, options: StrokeOptions | undefined): void {
    if (!this.facets) {
      if (this.curves instanceof Loop) {
        const linestring = this.curves.cloneStroked(options);
        if (linestring instanceof LineString3d) {
          const points = linestring.points;
          this.localToWorld.multiplyInversePoint3dArrayInPlace(points);
          const graph = Triangulator.earcutFromPoints(points);
          const unflippedPoly = PolyfaceBuilder.graphToPolyface(graph);
          this.facets = unflippedPoly;
          this.facets.tryTransformInPlace(this.localToWorld);
        }
      }
    }
  }
  /** Emit facets to a builder.
   * This method may cache and reuse facets over multiple calls.
   */
  public emitFacets(builder: PolyfaceBuilder, strokeOptions: StrokeOptions | undefined, reverse: boolean, transform?: Transform) {
    this.buildFacets(builder, strokeOptions);
    if (this.facets)
      builder.addIndexedPolyface(this.facets, reverse, transform);
  }
}
