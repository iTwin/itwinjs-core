/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

// import { Geometry, Angle, AngleSweep } from "../Geometry";

import { AxisIndex, AxisOrder, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Ellipsoid, GeodesicPathPoint } from "../geometry3d/Ellipsoid";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolylineOps } from "../geometry3d/PolylineOps";
import { Ray3d } from "../geometry3d/Ray3d";
import { Segment1d } from "../geometry3d/Segment1d";
import { Transform } from "../geometry3d/Transform";
import { XAndY } from "../geometry3d/XYZProps";
import { SmallSystem } from "../numerics/SmallSystem";
import { IndexedPolyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { Cone } from "../solid/Cone";
import { RuledSweep } from "../solid/RuledSweep";
import { TorusPipe } from "../solid/TorusPipe";
import { Arc3d, ArcBlendData } from "./Arc3d";
import { CurveChain } from "./CurveCollection";
import { CurvePrimitive } from "./CurvePrimitive";
import { AnyCurve } from "./CurveTypes";
import { GeometryQuery } from "./GeometryQuery";
import { LineSegment3d } from "./LineSegment3d";
import { LineString3d } from "./LineString3d";
import { Loop } from "./Loop";
import { Path } from "./Path";
import { IntegratedSpiral3d } from "./spiral/IntegratedSpiral3d";
import { IntegratedSpiralTypeName } from "./spiral/TransitionSpiral3d";
import { StrokeOptions } from "./StrokeOptions";

// cspell:word CCWXY

/**
 * Interface to carry parallel arrays of planes and sections, and optional geometry assembled from them, as returned by [CurveFactory.createMiteredSweepSections].
 * @public
 */
export interface SectionSequenceWithPlanes {
  /** the plane of each section */
  planes: Plane3dByOriginAndUnitNormal[];
  /** section curve projected onto the corresponding plane */
  sections: AnyCurve[];
  /**
   * Optional `RuledSweep` generated from the sections.
   * * The `RuledSweep` and sections array refer to the same section objects.
   */
  ruledSweep?: RuledSweep;
  /** Optional mesh generated from the `RuledSweep` generated from the sections. */
  mesh?: IndexedPolyface;
}

/**
 * Enumeration of geometric output for [CurveFactory.createMiteredSweepSections].
 * @public
 */
export enum MiteredSweepOutputSelect {
  /** Output only the parallel arrays of planes and sections. */
  Sections = 0,
  /** Output planes and sections, as well as the assembled ruled sweep. */
  AlsoRuledSweep = 1,
  /** Output planes and sections, as well as the assembled ruled sweep and its stroked mesh. */
  AlsoMesh = 2,
}

/**
 * Interface bundling options for [CurveFactory.createMiteredSweepSections].
 * @public
 */
export interface MiteredSweepOptions {
  /** Whether first and last planes are averaged and equated when the centerline is physically closed. Default value is `false`. */
  wrapIfPhysicallyClosed?: boolean;
  /** Whether to output sections only, or sections plus optional geometry constructed from them. Default value is `MiteredSweepOutputSelect.Sections`. */
  outputSelect?: MiteredSweepOutputSelect;
  /** How to stroke the ruled sweep if outputting a mesh. If undefined, default stroke options are used. */
  strokeOptions?: StrokeOptions;
  /** Whether to cap the ruled sweep if outputting a ruled sweep or mesh. Default value is `false`. */
  capped?: boolean;
}

/**
 * The `CurveFactory` class contains methods for specialized curve constructions.
 * @public
 */
export class CurveFactory {
  /** (cautiously) construct and save a line segment between fractional positions. */
  private static addPartialSegment(path: Path, allowBackup: boolean, pointA: Point3d | undefined, pointB: Point3d | undefined, fraction0: number, fraction1: number) {
    if (allowBackup || (fraction1 > fraction0)) {
      if (pointA !== undefined && pointB !== undefined && !Geometry.isAlmostEqualNumber(fraction0, fraction1))
        path.tryAddChild(LineSegment3d.create(pointA.interpolate(fraction0, pointB), pointA.interpolate(fraction1, pointB)));
    }
  }
  /**
   * Create a circular arc defined by start point, tangent at start point, and end point.
   * * The circular arc is swept from start to end toward direction of the `tangentAtStart`.
   * * If tangent is parallel to line segment from start to end, return `undefined`.
   */
  public static createArcPointTangentPoint(start: Point3d, tangentAtStart: Vector3d, end: Point3d): Arc3d | undefined {
    const ret = Arc3d.createCircularStartTangentEnd(start, tangentAtStart, end);
    if (ret instanceof Arc3d)
      return ret;
    else
      return undefined;
  }
  /**
   * Construct a sequence of alternating lines and arcs with the arcs creating tangent transition between consecutive edges.
   *  * If the radius parameter is a number, that radius is used throughout.
   *  * If the radius parameter is an array of numbers, `radius[i]` is applied at `point[i]`.
   *    * Note that since no fillet is constructed at the initial or final point, those entries in `radius[]` are never referenced.
   *    * A zero radius for any point indicates to leave the as a simple corner.
   * @param points point source
   * @param radius fillet radius or array of radii indexed to correspond to the points.
   * @param allowBackupAlongEdge true to allow edges to be created going "backwards" along edges if needed to create the blend.
   */
  public static createFilletsInLineString(points: LineString3d | IndexedXYZCollection | Point3d[], radius: number | number[], allowBackupAlongEdge: boolean = true): Path | undefined {
    if (Array.isArray(points))
      return this.createFilletsInLineString(new Point3dArrayCarrier(points), radius, allowBackupAlongEdge);
    if (points instanceof LineString3d)
      return this.createFilletsInLineString(points.packedPoints, radius, allowBackupAlongEdge);

    const n = points.length;
    if (n <= 1)
      return undefined;
    const pointA = points.getPoint3dAtCheckedPointIndex(0)!;
    const pointB = points.getPoint3dAtCheckedPointIndex(1)!;
    // remark: n=2 and n=3 cases should fall out from loop logic
    const blendArray: ArcBlendData[] = [];
    // build one-sided blends at each end . .
    blendArray.push({ fraction10: 0.0, fraction12: 0.0, point: pointA.clone() });

    for (let i = 1; i + 1 < n; i++) {
      const pointC = points.getPoint3dAtCheckedPointIndex(i + 1)!;
      let thisRadius = 0;
      if (Array.isArray(radius)) {
        if (i < radius.length)
          thisRadius = radius[i];
      } else if (Number.isFinite(radius))
        thisRadius = radius;

      if (thisRadius !== 0.0)
        blendArray.push(Arc3d.createFilletArc(pointA, pointB, pointC, thisRadius));
      else
        blendArray.push({ fraction10: 0.0, fraction12: 0.0, point: pointB.clone() });
      pointA.setFromPoint3d(pointB);
      pointB.setFromPoint3d(pointC);
    }
    blendArray.push({ fraction10: 0.0, fraction12: 0.0, point: pointB.clone() });
    if (!allowBackupAlongEdge) {
      // suppress arcs that have overlap with both neighbors or flood either neighbor ..
      for (let i = 1; i + 1 < n; i++) {
        const b = blendArray[i];
        if (b.fraction10 > 1.0
          || b.fraction12 > 1.0
          || 1.0 - b.fraction10 < blendArray[i - 1].fraction12
          || b.fraction12 > 1.0 - blendArray[i + 1].fraction10) {
          b.fraction10 = 0.0;
          b.fraction12 = 0.0;
          blendArray[i].arc = undefined;
        }
      }
      /* The "1-b" logic above prevents this loop from ever doing anything.
      // on edge with conflict, suppress the arc with larger fraction
      for (let i = 1; i < n; i++) {
        const b0 = blendArray[i - 1];
        const b1 = blendArray[i];
        if (b0.fraction12 > 1 - b1.fraction10) {
          const b = b0.fraction12 > b1.fraction12 ? b1 : b0;
          b.fraction10 = 0.0;
          b.fraction12 = 0.0;
          blendArray[i].arc = undefined;
        }
      } */
    }
    const path = Path.create();
    this.addPartialSegment(path, allowBackupAlongEdge, blendArray[0].point, blendArray[1].point, blendArray[0].fraction12, 1.0 - blendArray[1].fraction10);
    // add each path and successor edge ...
    for (let i = 1; i + 1 < points.length; i++) {
      const b0 = blendArray[i];
      const b1 = blendArray[i + 1];
      path.tryAddChild(b0.arc);
      this.addPartialSegment(path, allowBackupAlongEdge, b0.point, b1.point, b0.fraction12, 1.0 - b1.fraction10);
    }
    return path;
  }

  /** Create a `Loop` with given xy corners and fixed z.
   * * The corners always proceed counter clockwise from lower left.
   * * If the radius is too large for the outer rectangle size, it is reduced to half of the the smaller x or y size.
  */
  public static createRectangleXY(x0: number, y0: number, x1: number, y1: number, z: number = 0, filletRadius?: number): Loop {
    let radius = Geometry.correctSmallMetricDistance(filletRadius);
    const xMin = Math.min(x0, x1);
    const xMax = Math.max(x0, x1);
    const yMin = Math.min(y0, y1);
    const yMax = Math.max(y0, y1);
    radius = Math.min(Math.abs(radius), 0.5 * (xMax - xMin), 0.5 * (yMax - yMin));
    if (radius === 0.0)
      return Loop.createPolygon([Point3d.create(xMin, yMin, z), Point3d.create(xMax, yMin, z), Point3d.create(xMax, yMax, z), Point3d.create(xMin, yMax, z), Point3d.create(xMin, yMin, z)]);
    else {
      const vectorU = Vector3d.create(radius, 0, 0);
      const vectorV = Vector3d.create(0, radius, 0);
      const x0A = xMin + radius;
      const y0A = yMin + radius;
      const x1A = xMax - radius;
      const y1A = yMax - radius;
      const centers = [Point3d.create(x1A, y1A, z), Point3d.create(x0A, y1A, z), Point3d.create(x0A, y0A, z), Point3d.create(x1A, y0A, z)];
      const loop = Loop.create();
      for (let i = 0; i < 4; i++) {
        const center = centers[i];
        const nextCenter = centers[(i + 1) % 4];
        const edgeVector = Vector3d.createStartEnd(center, nextCenter);
        const arc = Arc3d.create(center, vectorU, vectorV, AngleSweep.createStartEndDegrees(0, 90));
        loop.tryAddChild(arc);
        const arcEnd = arc.endPoint();
        if (!edgeVector.isAlmostZero)
          loop.tryAddChild(LineSegment3d.create(arcEnd, arcEnd.plus(edgeVector)));
        vectorU.rotate90CCWXY(vectorU);
        vectorV.rotate90CCWXY(vectorV);
      }
      return loop;
    }
  }

  /**
   * If `arcB` is a continuation of `arcA`, extend `arcA` (in place) to include the range of `arcB`
   * * This only succeeds if the two arcs are part of identical complete arcs and end of `arcA` matches the beginning of `arcB`.
   * @param arcA first arc, modified in place
   * @param arcB second arc, unmodified
   * @param allowReversed whether to consolidate even when second arc is reversed
   * @returns whether `arcA` was modified
   */
  public static appendToArcInPlace(arcA: Arc3d, arcB: Arc3d, allowReverse: boolean = false): boolean {
    if (arcA.center.isAlmostEqual(arcB.center)) {
      const sweepSign = Geometry.split3WaySign(arcA.sweep.sweepRadians * arcB.sweep.sweepRadians, -1, 0, 1);
      // evaluate derivatives wrt radians (not fraction!), but adjust direction for sweep signs
      const endA = arcA.angleToPointAndDerivative(arcA.sweep.fractionToAngle(1.0));
      if (arcA.sweep.sweepRadians < 0)
        endA.direction.scaleInPlace(-1.0);
      const startB = arcB.angleToPointAndDerivative(arcB.sweep.fractionToAngle(0.0));
      if (arcB.sweep.sweepRadians < 0)
        startB.direction.scaleInPlace(-1.0);

      if (endA.isAlmostEqual(startB)) {
        arcA.sweep.setStartEndRadians(arcA.sweep.startRadians, arcA.sweep.startRadians + arcA.sweep.sweepRadians + sweepSign * arcB.sweep.sweepRadians);
        return true;
      }
      // Also ok if negated tangent . ..
      if (allowReverse) {
        startB.direction.scaleInPlace(-1.0);
        if (endA.isAlmostEqual(startB)) {
          arcA.sweep.setStartEndRadians(arcA.sweep.startRadians, arcA.sweep.startRadians + arcA.sweep.sweepRadians - sweepSign * arcB.sweep.sweepRadians);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Return a `Path` containing arcs are on the surface of an ellipsoid and pass through a sequence of points.
   * * Each arc passes through the two given endpoints and in the plane containing the true surface normal at given `fractionForIntermediateNormal`
   * @param ellipsoid
   * @param pathPoints
   * @param fractionForIntermediateNormal fractional position for surface normal used to create the section plane.
   */
  public static assembleArcChainOnEllipsoid(ellipsoid: Ellipsoid, pathPoints: GeodesicPathPoint[], fractionForIntermediateNormal: number = 0.5): Path {
    const arcPath = Path.create();
    for (let i = 0; i + 1 < pathPoints.length; i++) {
      const arc = ellipsoid.sectionArcWithIntermediateNormal(
        pathPoints[i].toAngles(),
        fractionForIntermediateNormal,
        pathPoints[i + 1].toAngles());
      arcPath.tryAddChild(arc);
    }
    return arcPath;
  }

  private static appendGeometryQueryArray(candidate: GeometryQuery | GeometryQuery[] | undefined, result: GeometryQuery[]) {
    if (candidate instanceof GeometryQuery)
      result.push(candidate);
    else if (Array.isArray(candidate)) {
      for (const p of candidate)
        this.appendGeometryQueryArray(p, result);
    }

  }

  /**
   * Create solid primitives for pipe segments (e.g. Cone or TorusPipe) around line and arc primitives.
   * @param centerline centerline geometry/
   * @param pipeRadius radius of pipe.
   */
  public static createPipeSegments(centerline: CurvePrimitive | CurveChain, pipeRadius: number): GeometryQuery | GeometryQuery[] | undefined {
    if (centerline instanceof LineSegment3d) {
      return Cone.createAxisPoints(centerline.startPoint(), centerline.endPoint(), pipeRadius, pipeRadius, false);
    } else if (centerline instanceof Arc3d) {
      return TorusPipe.createAlongArc(centerline, pipeRadius, false);
    } else if (centerline instanceof CurvePrimitive) {
      const builder = PolyfaceBuilder.create();
      builder.addMiteredPipes(centerline, pipeRadius);
      return builder.claimPolyface();
    } else if (centerline instanceof CurveChain) {
      const result: GeometryQuery[] = [];
      for (const p of centerline.children) {
        const pipe = this.createPipeSegments(p, pipeRadius);
        this.appendGeometryQueryArray(pipe, result);
      }
      return result;
    }
    return undefined;
  }

  /**
   * * Create section arcs for mitered pipe.
   * * At each end of each pipe, the pipe is cut by the plane that bisects the angle between successive pipe centerlines.
   * * The arc definitions are constructed so that lines between corresponding fractional positions on the arcs are
   *     axial lines on the pipes.
   * * This means that each arc definition axes (aka vector0 and vector90) are _not_ perpendicular to each other.
   * * Circular or elliptical pipe cross sections can be specified by supplying either a radius, a pair of semi-axis lengths, or a full Arc3d.
   *    * For semi-axis length input, x corresponds to an ellipse local axis nominally situated parallel to the xy-plane.
   *    * The center of Arc3d input is translated to the centerline start point to act as initial cross section.
   * @param centerline centerline of pipe
   * @param sectionData circle radius, ellipse semi-axis lengths, or full Arc3d
   */
  public static createMiteredPipeSections(centerline: IndexedXYZCollection, sectionData: number | XAndY | Arc3d): Arc3d[] {
    const arcs: Arc3d[] = [];
    if (centerline.length < 2)
      return [];

    const vector0 = Vector3d.create();
    const vector90 = Vector3d.create();
    const vectorBC = Vector3d.create();
    const currentCenter = Point3d.create();
    centerline.vectorIndexIndex(0, 1, vectorBC)!;
    centerline.getPoint3dAtUncheckedPointIndex(0, currentCenter);

    let initialSection: Arc3d;
    if (sectionData instanceof Arc3d) {
      initialSection = sectionData.clone();
      initialSection.center.setFrom(currentCenter);
      vector0.setFrom(sectionData.vector0);
      vector90.setFrom(sectionData.vector90);
    } else if (typeof sectionData === "number" || Point3d.isXAndY(sectionData)) {
      const length0 = (typeof sectionData === "number") ? sectionData : sectionData.x;
      const length90 = (typeof sectionData === "number") ? sectionData : sectionData.y;
      const baseFrame = Matrix3d.createRigidHeadsUp(vectorBC, AxisOrder.ZXY);
      baseFrame.columnX(vector0).scaleInPlace(length0);
      baseFrame.columnY(vector90).scaleInPlace(length90);
      initialSection = Arc3d.create(currentCenter, vector0, vector90, AngleSweep.create360());
    } else {
      return [];
    }
    arcs.push(initialSection);

    const vectorAB = Vector3d.create();
    const bisector = Vector3d.create();
    for (let i = 1; i < centerline.length; i++) {
      vectorAB.setFromVector3d(vectorBC);
      centerline.getPoint3dAtUncheckedPointIndex(i, currentCenter);
      if (i + 1 < centerline.length) {
        centerline.vectorIndexIndex(i, i + 1, vectorBC)!;
      } else {
        vectorBC.setFromVector3d(vectorAB);
      }
      if (vectorAB.normalizeInPlace() && vectorBC.normalizeInPlace()) {
        vectorAB.interpolate(0.5, vectorBC, bisector);
        // On the end ellipse for this pipe section. ..
        // center comes directly from centerline[i]
        // vector0 and vector90 are obtained by sweeping the corresponding vectors of the start ellipse to the split plane.
        moveVectorToPlane(vector0, vectorAB, bisector, vector0);
        moveVectorToPlane(vector90, vectorAB, bisector, vector90);
        arcs.push(Arc3d.create(currentCenter, vector0, vector90, AngleSweep.create360()));
      }
    }
    return arcs;
  }

  /**
   * Sweep the initialSection along each segment of the centerLine until it hits the bisector plane at the next vertex.
   * * The caller should place the initialSection on a plane perpendicular to the first edge.
   *   * This plane is commonly (but not necessarily) through the start point itself.
   *   * If the geometry is not "on a perpendicular plane", the output geometry will still be flattened onto the various planes.
   * * In the "open path" case (i.e when wrapIfPhysicallyClosed is false or the path does not have matched first and last points)
   *       the first/last output plane will be at the start/end of the first/last edge and on a perpendicular plane.
   * * In the "closed path" case, the output plane for the first and last point is the bisector of the start and end planes from the "open path" case,
   *    and the first/last section geometry may be different from `initialSection`.
   * * The centerline path does NOT have to be planar, however twisting effects effects will appear in the various bisector planes.
   * @param centerline sweep path, e.g., as stroked from a smooth centerline curve
   * @param initialSection profile curve to be swept. As noted above, this should be on a plane perpendicular to the first segment of the centerline.
   * @param options options for computation and output
   * @return array of sections, starting with `initialSection` projected along the first edge to the first plane.
   */
  public static createMiteredSweepSections(centerline: IndexedXYZCollection | Point3d[], initialSection: AnyCurve, options: MiteredSweepOptions): SectionSequenceWithPlanes | undefined {
    const sectionData: SectionSequenceWithPlanes = { sections: [], planes: [] };
    const planes = PolylineOps.createBisectorPlanesForDistinctPoints(centerline, options.wrapIfPhysicallyClosed);
    if (planes !== undefined && planes.length > 1) {
      // Projection to target plane, constructing sweep direction from two given planes.
      // If successful, push the target plane and swept section to the output arrays and return the swept section.
      // If unsuccessful, leave the output arrays alone and return the input section.
      const doSweepToPlane = function (edgePlane0: Plane3dByOriginAndUnitNormal, edgePlane1: Plane3dByOriginAndUnitNormal,
        targetPlane: Plane3dByOriginAndUnitNormal,
        section: AnyCurve) {
        const sweepVector = Vector3d.createStartEnd(edgePlane0.getOriginRef(), edgePlane1.getOriginRef());
        const transform = Transform.createFlattenAlongVectorToPlane(sweepVector, targetPlane.getOriginRef(), targetPlane.getNormalRef());
        if (transform === undefined)
          return section;
        const section1 = section.cloneTransformed(transform);
        if (section1 === undefined)
          return section;
        sectionData.planes.push(targetPlane);
        sectionData.sections.push(section1);
        return section1;
      };

      let currentSection = doSweepToPlane(planes[0], planes[1], planes[0], initialSection);
      for (let i = 1; i < planes.length; i++) {
        currentSection = doSweepToPlane(planes[i - 1], planes[i], planes[i], currentSection);
      }

      if (options.outputSelect) {
        const ruledSweep = RuledSweep.create(sectionData.sections, options.capped ?? false);
        if (ruledSweep) {
          sectionData.ruledSweep = ruledSweep;
          if (MiteredSweepOutputSelect.AlsoMesh === options.outputSelect) {
            const builder = PolyfaceBuilder.create(options.strokeOptions);
            builder.addRuledSweep(ruledSweep);
            sectionData.mesh = builder.claimPolyface();
          }
        }
      }
      return sectionData;
    }
    return undefined;
  }

  /**
   * Create a circular arc from start point, tangent at start, radius, optional plane normal, arc sweep.
   * * The vector from start point to center is in the direction of upVector crossed with tangentA.
   * @param start start point.
   * @param tangentAtStart vector in tangent direction at the start.
   * @param radius signed radius.
   * @param upVector optional out-of-plane vector. Defaults to positive Z.
   * @param sweep angular range. If single `Angle` is given, start angle is at 0 degrees (the start point).
   */
  public static createArcPointTangentRadius(
    start: Point3d, tangentAtStart: Vector3d, radius: number, upVector?: Vector3d, sweep?: Angle | AngleSweep,
  ): Arc3d | undefined {
    return Arc3d.createCircularStartTangentRadius(start, tangentAtStart, radius, upVector, sweep);
  }

  /**
   * Compute 2 spirals (all in XY) for a symmetric line-to-line transition.
   * * First spiral begins at given start point.
   * * first tangent aims at shoulder
   * * outbound spiral joins line from shoulder to target.
   * @param spiralType name of spiral type.  THIS MUST BE AN "Integrated" SPIRAL TYPE
   * @param startPoint inbound start point.
   * @param shoulder point target point for (both) spiral-to-line tangencies
   * @return array with the computed spirals, or undefined if failure.
   */
  public static createLineSpiralSpiralLine(
    spiralType: IntegratedSpiralTypeName,
    startPoint: Point3d,
    shoulderPoint: Point3d,
    targetPoint: Point3d,
  ): GeometryQuery[] | undefined {
    const vectorAB = Vector3d.createStartEnd(startPoint, shoulderPoint);
    const vectorBC0 = Vector3d.createStartEnd(shoulderPoint, targetPoint);
    const referenceLength = vectorAB.magnitude();
    const radiansAB = Math.atan2(vectorAB.y, vectorAB.x);
    const lineTurnRadians = vectorAB.angleToXY(vectorBC0);
    const spiralTurnRadians = 0.5 * lineTurnRadians.radians;
    const radiansBC = radiansAB + lineTurnRadians.radians;
    const axesA = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(radiansAB));
    const frameA = Transform.createRefs(startPoint.clone(), axesA);
    // We know how much it has to turn, and but not the length or end radius.
    // make a spiral of referenceLength and scale it back to the junction line
    const spiralARefLength = IntegratedSpiral3d.createFrom4OutOf5(spiralType, 0.0, undefined,
      Angle.createRadians(0), Angle.createRadians(spiralTurnRadians), referenceLength, undefined, frameA);
    if (spiralARefLength) {
      const midPlanePerpendicularRadians = radiansAB + spiralTurnRadians;
      const midPlanePerpendicularVector = Vector3d.createPolar(1.0, Angle.createRadians(midPlanePerpendicularRadians));
      const altitudeB = midPlanePerpendicularVector.dotProductStartEnd(startPoint, shoulderPoint);
      const altitudeSpiralEnd = midPlanePerpendicularVector.dotProductStartEnd(startPoint, spiralARefLength.endPoint());
      const scaleFactor = altitudeB / altitudeSpiralEnd;
      const spiralA = IntegratedSpiral3d.createFrom4OutOf5(spiralType, 0.0, undefined,
        Angle.createRadians(0), Angle.createRadians(spiralTurnRadians), referenceLength * scaleFactor, undefined, frameA)!;
      const distanceAB = vectorAB.magnitude();
      const vectorBC = Vector3d.createStartEnd(shoulderPoint, targetPoint);
      vectorBC.scaleToLength(distanceAB, vectorBC);
      const pointC = shoulderPoint.plus(vectorBC);
      const axesC = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(radiansBC + Math.PI));
      const frameC = Transform.createRefs(pointC, axesC);
      const spiralC = IntegratedSpiral3d.createFrom4OutOf5(spiralType,
        0, -spiralA.radius01.x1, Angle.zero(), undefined, spiralA.curveLength(), Segment1d.create(1, 0), frameC)!;
      return [spiralA, spiralC];
    }
    return undefined;
  }

  /**
   * Compute 2 spirals (all in XY) for a symmetric line-to-line transition.
   * * Spiral length is given.
   * * tangency points float on both lines.
   * @param spiralType name of spiral type.  THIS MUST BE AN "Integrated" SPIRAL TYPE
   * @param pointA inbound start point.
   * @param shoulder point target point for (both) spiral-to-line tangencies
   * @param spiralLength for each part of the spiral pair.
   * @return array with the computed spirals, or undefined if failure.
   */
  public static createLineSpiralSpiralLineWithSpiralLength(
    spiralType: IntegratedSpiralTypeName,
    pointA: Point3d,
    pointB: Point3d,
    pointC: Point3d,
    spiralLength: number,
  ): GeometryQuery[] | undefined {
    const vectorAB = Vector3d.createStartEnd(pointA, pointB);
    const vectorBC = Vector3d.createStartEnd(pointB, pointC);
    const radiansAB = Math.atan2(vectorAB.y, vectorAB.x);
    const lineTurnAngle = vectorAB.angleToXY(vectorBC);
    const spiralTurnRadians = 0.5 * lineTurnAngle.radians;
    const bisectorRadians = 0.5 * (Math.PI - lineTurnAngle.radians);
    const radiansCB = Math.atan2(-vectorBC.y, -vectorBC.x);
    const spiralAB0 = IntegratedSpiral3d.createFrom4OutOf5(spiralType, 0, undefined, Angle.zero(), Angle.createRadians(spiralTurnRadians),
      spiralLength, undefined, Transform.createIdentity());
    if (spiralAB0) {
      const localEndPoint = spiralAB0.fractionToPoint(1);
      const distanceAB = pointA.distance(pointB);
      const distanceCB = pointC.distance(pointB);
      // The spiral eventually has to end on the bisector, at localEndPoint.y height from the inbound line
      // distance from shoulder to projection of that point to point E on the inbound line is
      const distanceBE = localEndPoint.y / Math.tan(bisectorRadians);
      const xFractionAB = Geometry.conditionalDivideFraction(distanceAB - distanceBE - localEndPoint.x, distanceAB);
      const xFractionCB = Geometry.conditionalDivideFraction(distanceCB - distanceBE - localEndPoint.x, distanceCB);
      if (xFractionAB !== undefined && xFractionCB !== undefined) {
        const axesA = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(radiansAB));
        const frameAOrigin = pointA.interpolate(xFractionAB, pointB);
        const frameA = Transform.createRefs(frameAOrigin, axesA);
        const spiralAB = IntegratedSpiral3d.createFrom4OutOf5(spiralType, 0, undefined, Angle.zero(), Angle.createRadians(spiralTurnRadians),
          spiralLength, undefined, frameA)!;
        const axesB = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createRadians(radiansCB));
        const frameBOrigin = pointC.interpolate(xFractionCB, pointB);
        const frameB = Transform.createRefs(frameBOrigin, axesB);
        const spiralBC = IntegratedSpiral3d.createFrom4OutOf5(spiralType, 0, undefined, Angle.zero(), Angle.createRadians(-spiralTurnRadians),
          spiralLength, undefined, frameB)!;
        return [spiralAB, spiralBC];
      }
    }
    return undefined;
  }

  /**
   * Compute 2 spirals and an arc (all in XY) for a symmetric line-to-line transition.
   * Spiral lengths and arc radius are given.   (e.g. from design speed standards.)
   * @param spiralType name of spiral type.  THIS MUST BE AN "Integrated" SPIRAL TYPE
   * @param pointA inbound start point.
   * @param pointB shoulder (target)  point for (both) spiral-to-line tangencies
   * @param lengthA inbound spiral length
   * @param lengthB outbound spiral length
   * @return array with the computed spirals, or undefined if failure.
   */
  public static createLineSpiralArcSpiralLine(
    spiralType: IntegratedSpiralTypeName,
    pointA: Point3d,
    pointB: Point3d,
    pointC: Point3d,
    lengthA: number,
    lengthB: number,
    arcRadius: number,
  ): GeometryQuery[] | undefined {
    const vectorAB = Vector3d.createStartEnd(pointA, pointB); vectorAB.z = 0;
    const vectorCB = Vector3d.createStartEnd(pointC, pointB); vectorCB.z = 0;
    const unitAB = vectorAB.normalize();
    const unitCB = vectorCB.normalize();
    if (unitAB === undefined || unitCB === undefined)
      return undefined;
    const unitPerpAB = unitAB.unitPerpendicularXY();
    const unitPerpCB = unitCB.unitPerpendicularXY();
    const thetaABC = vectorAB.angleToXY(vectorCB);
    const sideA = Geometry.split3WaySign(thetaABC.radians, 1, -1, -1);
    const sideB = - sideA;
    const radiusA = sideA * Math.abs(arcRadius);
    const radiusB = sideB * Math.abs(arcRadius);
    const spiralA = IntegratedSpiral3d.createFrom4OutOf5(spiralType,
      0, radiusA, Angle.zero(), undefined, lengthA, undefined, Transform.createIdentity())!;
    const spiralB = IntegratedSpiral3d.createFrom4OutOf5(spiralType,
      0, radiusB, Angle.zero(), undefined, lengthB, undefined, Transform.createIdentity())!;
    const spiralEndA = spiralA.fractionToPointAndUnitTangent(1.0);
    const spiralEndB = spiralB.fractionToPointAndUnitTangent(1.0);
    // From the end of spiral, step away to arc center (and this is in local coordinates of each spiral)
    const sA = spiralEndA.origin.x - radiusA * spiralEndA.direction.y;
    const tA = spiralEndA.origin.y + radiusA * spiralEndA.direction.x;

    const sB = spiralEndB.origin.x - radiusB * spiralEndB.direction.y;
    const tB = spiralEndB.origin.y + radiusB * spiralEndB.direction.x;

    // Those local coordinates are rotated to unitAB and unitBC ...
    const vectorA = Vector3d.createAdd2Scaled(unitAB, sA, unitPerpAB, tA);
    const vectorB = Vector3d.createAdd2Scaled(unitCB, sB, unitPerpCB, tB);
    const uv = Vector2d.create();
    if (SmallSystem.linearSystem2d(
      unitAB.x, -unitCB.x,
      unitAB.y, -unitCB.y,
      vectorB.x - vectorA.x, vectorB.y - vectorA.y, uv)) {
      const tangencyAB = pointB.plusScaled(unitAB, uv.x);
      const tangencyCB = pointB.plusScaled(unitCB, uv.y);
      const frameA = Transform.createOriginAndMatrixColumns(tangencyAB, unitAB, unitPerpAB, Vector3d.unitZ());
      const frameB = Transform.createOriginAndMatrixColumns(tangencyCB, unitCB, unitPerpCB, Vector3d.unitZ());
      spiralA.tryTransformInPlace(frameA);
      spiralB.tryTransformInPlace(frameB);
      const rayA1 = spiralA.fractionToPointAndUnitTangent(1.0);
      const rayB0 = spiralB.fractionToPointAndUnitTangent(1.0);
      rayB0.direction.scaleInPlace(-1.0);
      const sweep = rayA1.direction.angleToXY(rayB0.direction);
      if (radiusA < 0)
        sweep.setRadians(- sweep.radians);
      const arc = CurveFactory.createArcPointTangentRadius(rayA1.origin, rayA1.direction, radiusA, undefined, sweep)!;
      return [spiralA, arc, spiralB];
    }
    return undefined;
  }
  /**
   * Return the intersection point of 3 planes.
   * @param planeA
   * @param planeB
   * @param planeC
   */
  public static planePlaneIntersectionRay(
    planeA: PlaneAltitudeEvaluator, planeB: PlaneAltitudeEvaluator): Ray3d | undefined {
    const altitudeA = planeA.altitudeXYZ(0, 0, 0);
    const altitudeB = planeB.altitudeXYZ(0, 0, 0);
    const normalAx = planeA.normalX();
    const normalAy = planeA.normalY();
    const normalAz = planeA.normalZ();
    const normalBx = planeB.normalX();
    const normalBy = planeB.normalY();
    const normalBz = planeB.normalZ();
    const normalCx = Geometry.crossProductXYXY(normalAy, normalAz, normalBy, normalBz);
    const normalCy = Geometry.crossProductXYXY(normalAz, normalAx, normalBz, normalBx);
    const normalCz = Geometry.crossProductXYXY(normalAx, normalAy, normalBx, normalBy);
    const rayOrigin = SmallSystem.linearSystem3d(
      normalAx, normalAy, normalAz,
      normalBx, normalBy, normalBz,
      normalCx, normalCy, normalCz,
      -altitudeA, -altitudeB, 0.0);
    if (rayOrigin !== undefined) {
      return Ray3d.createXYZUVW(rayOrigin.x, rayOrigin.y, rayOrigin.z, normalCx, normalCy, normalCz);
    }
    return undefined;
  }

}

/**
 * Starting at vectorR, move parallel to vectorV until perpendicular to planeNormal
 */
function moveVectorToPlane(vectorR: Vector3d, vectorV: Vector3d, planeNormal: Vector3d, result?: Vector3d): Vector3d {
  // find s such that (vectorR + s * vectorV) DOT planeNormal = 0.
  const dotRN = vectorR.dotProduct(planeNormal);
  const dotVN = vectorV.dotProduct(planeNormal);
  const s = Geometry.safeDivideFraction(dotRN, dotVN, 0.0);
  return vectorR.plusScaled(vectorV, -s, result);
}
