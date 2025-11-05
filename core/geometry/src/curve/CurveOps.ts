/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { AxisIndex, Geometry } from "../Geometry";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { MultiLineStringDataVariant } from "../geometry3d/IndexedXYZCollection";
import { Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { BagOfCurves, CurveCollection } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyChain, AnyCurve } from "./CurveTypes";
import { GeometryQuery } from "./GeometryQuery";
import { MultiChainCollector } from "./internalContexts/MultiChainCollector";
import { CurveChainWireOffsetContext } from "./internalContexts/PolygonOffsetContext";
import { LineString3d } from "./LineString3d";
import { Loop } from "./Loop";
import { OffsetOptions } from "./OffsetOptions";
import { Path } from "./Path";
import { StrokeOptions } from "./StrokeOptions";

  /**
   * Options bundle for use in [[CurveOps.isPlanar]] and [[CurveOps.isColinear]].
   * @public
   */
  export interface PlanarColinearOptions {
    /** Maximum allowable distance that geometry can deviate from planarity/colinearity. Default is [[Geometry.smallMetricDistance]]. */
    maxDeviation?: number;
    /** Whether colinearity test ignores z-coordinates. Default is `false`. */
    xyColinear?: boolean;
    /** Radian tolerance for xy-colinearity, measuring maximum angular deviation from a vertical plane. Default is [[Geometry.smallAngleRadians]]. */
    radianTolerance?: number;
    /** Pre-allocated object to populate with the computed plane-to-world transformation and return when planarity test succeeds. */
    localToWorld?: Transform;
    /** Pre-allocated object to populate with the computed line and return when colinear test succeeds. */
    colinearRay?: Ray3d;
  }

/**
 * Static methods for miscellaneous curve operations.
 * @public
 */
export class CurveOps {
  /** Recursively sum curve lengths, allowing CurvePrimitive, CurveCollection, or array of such at any level. */
  public static sumLengths(curves: AnyCurve | AnyCurve[]): number {
    let mySum = 0;
    if (curves instanceof CurvePrimitive) {
      mySum += curves.curveLength();
    } else if (curves instanceof CurveCollection) {
      mySum += curves.sumLengths();
    } else if (Array.isArray(curves)) {
      for (const data1 of curves)
        mySum += this.sumLengths(data1);
    }
    return mySum;
  }
  /** Recursively extend the range by each curve's range, allowing CurvePrimitive, CurveCollection, or array of such at any level. */
  public static extendRange(range: Range3d, curves: AnyCurve | AnyCurve[], transform?: Transform): Range3d {
    if (Array.isArray(curves)) {
      for (const data1 of curves)
        this.extendRange(range, data1, transform);
    } else {
      curves.extendRange(range, transform);
    }
    return range;
  }
  /**
   * Construct a separate xy-offset for each input curve.
   * * For best offset results, the inputs should be parallel to the xy-plane.
   * @param curves input curve(s), z-coordinates ignored. Only curves of type [[AnyChain]] are handled.
   * @param offset offset distance (positive to left of curve, negative to right)
   * @param result array to collect offset curves
   * @returns summed length of offset curves
   */
  public static appendXYOffsets(curves: AnyCurve | AnyCurve[] | undefined, offset: number, result: AnyCurve[]): number {
    let summedLengths = 0;
    if (curves instanceof CurvePrimitive) {
      const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(Path.create(curves), offset);
      if (resultA) {
        summedLengths += this.sumLengths(resultA);
        result.push(resultA);
      }
    } else if (curves instanceof Loop || curves instanceof Path) {
      const resultA = CurveChainWireOffsetContext.constructCurveXYOffset(curves, offset);
      if (resultA) {
        summedLengths += this.sumLengths(resultA);
        result.push(resultA);
      }
    } else if (curves instanceof BagOfCurves) {
      for (const q of curves.children)
        summedLengths += this.appendXYOffsets(q, offset, result);
    } else if (Array.isArray(curves)) {
      for (const q of curves)
        summedLengths += this.appendXYOffsets(q, offset, result);
    }
    return summedLengths;
  }
  /**
   * Restructure curve fragments as Paths and Loops, and construct xy-offsets of the chains.
   * * If the inputs do not form Loop(s), the classification of offsets is suspect.
   * * For best offset results, the inputs should be parallel to the xy-plane.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained and offset
   * @param offsetDistance offset distance, applied to both sides of each fragment to produce inside and outside xy-offset curves.
   * @param gapTolerance distance to be treated as "effectively zero" when joining head-to-tail
   * @returns object with named chains, insideOffsets, outsideOffsets
   */
  public static collectInsideAndOutsideXYOffsets(fragments: AnyCurve[], offsetDistance: number, gapTolerance: number): { insideOffsets: AnyCurve[], outsideOffsets: AnyCurve[], chains?: AnyChain } {
    const collector = new MultiChainCollector(gapTolerance, gapTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    const chains = collector.grabResult(true);
    const myOffsetA: CurveCollection[] = [];
    const myOffsetB: CurveCollection[] = [];
    const offsetLengthA = CurveOps.appendXYOffsets(chains, offsetDistance, myOffsetA);
    const offsetLengthB = CurveOps.appendXYOffsets(chains, -offsetDistance, myOffsetB);
    if (offsetLengthA > offsetLengthB) {
      return { outsideOffsets: myOffsetA, insideOffsets: myOffsetB, chains };
    } else {
      return { insideOffsets: myOffsetA, outsideOffsets: myOffsetB, chains };
    }
  }
  /**
   * Construct curves that are offset from a Path or Loop as viewed in xy-plane (ignoring z).
   * * The construction will remove "some" local effects of features smaller than the offset distance, but will not detect self intersection among widely separated edges.
   * @param curves base curves.
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object.
   */
  public static constructCurveXYOffset(curves: Path | Loop, offsetDistanceOrOptions: number | OffsetOptions): CurveCollection | undefined {
    return CurveChainWireOffsetContext.constructCurveXYOffset(curves, offsetDistanceOrOptions);
  }
  /**
   * Create the offset of a single curve primitive as viewed in the xy-plane (ignoring z).
   * @param curve primitive to offset
   * @param offsetDistanceOrOptions offset distance (positive to left of curve, negative to right) or options object
   */
  public static createSingleOffsetPrimitiveXY(curve: CurvePrimitive, offsetDistanceOrOptions: number | OffsetOptions): CurvePrimitive | CurvePrimitive[] | undefined {
    return CurveChainWireOffsetContext.createSingleOffsetPrimitiveXY(curve, offsetDistanceOrOptions);
  }
  /**
   * Restructure curve fragments as Paths and Loops.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail
   * @param planeTolerance tolerance for considering a closed chain to be planar. If undefined, only create Path. If defined, create Loops for closed chains within tolerance of a plane.
   * @returns chains, possibly wrapped in a [[BagOfCurves]].
   */
  public static collectChains(fragments: AnyCurve[], gapTolerance: number = Geometry.smallMetricDistance, planeTolerance?: number): AnyChain | undefined {
    const collector = new MultiChainCollector(gapTolerance, planeTolerance);
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    return collector.grabResult(true);
  }
  /**
   * Restructure curve fragments, to be stroked and passed into the callback.
   * * Chain formation is dependent upon input fragment order, as a greedy algorithm is employed.
   * @param fragments fragments to be chained and stroked
   * @param announceChain callback to process each stroked Path and Loop
   * @param strokeOptions options for stroking the chains
   * @param gapTolerance distance to be treated as "effectively zero" when assembling fragments head-to-tail. Also used for removing duplicate points in the stroked chains.
   * @param _planeTolerance unused, pass undefined
   */
  public static collectChainsAsLineString3d(fragments: AnyCurve[], announceChain: (chainPoints: LineString3d) => void, strokeOptions?: StrokeOptions, gapTolerance: number = Geometry.smallMetricDistance, _planeTolerance?: number) {
    const collector = new MultiChainCollector(gapTolerance); // no planarity tolerance needed
    for (const s of fragments) {
      collector.captureCurve(s);
    }
    collector.announceChainsAsLineString3d(announceChain, strokeOptions);
  }
  /**
   * Compute the range of the curves in the local coordinates of a constructed localToWorld frame.
   * @param curves input geometry: curves or points.
   * @param localRange pre-allocated object to populate with the computed local range.
   * @param localToWorld optional pre-allocated object to populate with the computed frame.
   * @returns whether the frame was successfully computed.
   */
  public static computeLocalRange(curves: AnyCurve | MultiLineStringDataVariant, localRange: Range3d, localToWorld?: Transform): boolean {
    const builderData: any[] = [curves];
    if (localToWorld)
      builderData.push(localToWorld);
    localToWorld = FrameBuilder.createRightHandedFrame(Vector3d.unitZ(), ...builderData);
    if (!localToWorld)
      return false;
    const worldToLocal = localToWorld.inverse();
    localRange.setNull();
    if (Array.isArray(curves) || !(curves instanceof GeometryQuery))
      Range3d.createFromVariantData(curves, worldToLocal, localRange);
    else
      this.extendRange(localRange, curves, worldToLocal);
    return true;
  }
  /**
   * Check whether or not the curves are planar, and if so, return a localToWorld frame.
   * @param curves input geometry: curves or points.
   * @param options bundle of options.
   * @returns localToWorld frame `T` for coplanar curves, or undefined if they are not coplanar.
   * `T` satisfies:
   * * `T.origin` is in the plane.
   * * `T.matrix.columnZ()` is the plane unit normal (or its negative).
   * * `T.matrix.isRigid()` returns true.
   * * `T.inverse()` is worldToLocal; apply to input geometry to rotate it into the xy-plane.
   */
  public static isPlanar(curves: AnyCurve | MultiLineStringDataVariant, options?: PlanarColinearOptions): Transform | undefined {
    const localRange = Range3d.create();
    const localToWorld = options?.localToWorld ?? Transform.createIdentity();
    if (!this.computeLocalRange(curves, localRange, localToWorld))
      return undefined;
    const maxAltitude = options?.maxDeviation ?? Geometry.smallMetricDistance;
    return (localRange.zLength() <= Math.abs(maxAltitude)) ? localToWorld : undefined;
  }
  /**
   * Check whether or not the curves lie in a straight line, and if so, return a colinear ray.
   * * This test does not take curve traversal or point order into account.
   * @param curves input geometry: curves or points.
   * @param options bundle of options.
   * @returns ray colinear with input, or undefined if input is not colinear.
   */
  public static isColinear(curves: AnyCurve | MultiLineStringDataVariant, options?: PlanarColinearOptions): Ray3d | undefined {
    const localRange = Range3d.create();
    const localToWorld = options?.localToWorld ?? Transform.createIdentity();
    if (!this.computeLocalRange(curves, localRange, localToWorld))
      return undefined;
    const maxAltitude = Math.abs(options?.maxDeviation ?? Geometry.smallMetricDistance);
    if (localRange.zLength() > maxAltitude)
      return undefined; // non-planar

    const ray = options?.colinearRay ?? Ray3d.createZero();
    ray.origin.setFrom(localToWorld.origin);

    const xLength = localRange.xLength();
    const yLength = localRange.yLength();
    if (xLength <= maxAltitude && yLength <= maxAltitude) {
      ray.direction.setZero();
      return ray; // the input is essentially a point
    }
    if (yLength <= maxAltitude) {
      localToWorld.matrix.columnX(ray.direction);
      return ray; // the input lies along local x-axis
    }
    if (xLength <= maxAltitude) {
      localToWorld.matrix.columnY(ray.direction);
      return ray; // the input lies along local y-axis
    }
    if (!options?.xyColinear)
      return undefined; // non-colinear

    const angleTolerance = Math.abs(options?.radianTolerance ?? Geometry.smallAngleRadians);
    const verticalPlaneDeviation = Math.abs(localToWorld.matrix.columnDotXYZ(AxisIndex.Z, 0, 0, 1));
    if (verticalPlaneDeviation > angleTolerance) // cos(t + pi/2) = -sin(t) ~ -t for small t
      return undefined; // non-xy-colinear

    if (xLength > yLength)
      localToWorld.matrix.columnX(ray.direction);
    else
      localToWorld.matrix.columnY(ray.direction);
    ray.direction.z = 0.0;
    return ray; // xy-colinear (plane is vertical)
  }
}
