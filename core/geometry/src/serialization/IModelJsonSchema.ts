/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Serialization */

// import { Geometry, Angle, AxisOrder, BSIJSONValues } from "../Geometry";
import { Geometry, AngleProps, AngleSweepProps, AxisOrder } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Angle } from "../geometry3d/Angle";
import { Point2d, Point3d, XYZ, Vector3d, XYProps, XYZProps, YawPitchRollProps, YawPitchRollAngles, Segment1d } from "../geometry3d/PointVector";
import { Matrix3d } from "../geometry3d/Transform";
import { GeometryQuery } from "../curve/GeometryQuery";
import { CoordinateXYZ } from "../curve/CoordinateXYZ";
import { TransitionSpiral3d } from "../curve/TransitionSpiral";
import { Transform } from "../geometry3d/Transform";
import { UnionRegion } from "../curve/UnionRegion";
import { BagOfCurves } from "../curve/CurveCollection";
import { ParityRegion } from "../curve/ParityRegion";
import { Loop } from "../curve/Loop";
import { Path } from "../curve/Path";
import { IndexedPolyface, PolyfaceAuxData, AuxChannel, AuxChannelData, AuxChannelDataType } from "../polyface/Polyface";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { BSplineSurface3d, BSplineSurface3dH, WeightStyle } from "../bspline/BSplineSurface";
import { Sphere } from "../solid/Sphere";
import { Cone } from "../solid/Cone";
import { Box } from "../solid/Box";
import { TorusPipe } from "../solid/TorusPipe";
import { LinearSweep } from "../solid/LinearSweep";
import { RotationalSweep } from "../solid/RotationalSweep";
import { RuledSweep } from "../solid/RuledSweep";
import { Ray3d } from "../geometry3d/Ray3d";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { LineString3d } from "../curve/LineString3d";
import { PointString3d } from "../curve/PointString3d";
import { Arc3d } from "../curve/Arc3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { Point4d } from "../geometry4d/Point4d";
import { CurveCollection } from "../curve/CurveCollection";
/* tslint:disable: object-literal-key-quotes no-console*/

export namespace IModelJson {

  export interface GeometryProps extends CurvePrimitiveProps, SolidPrimitiveProps {
    indexedMesh?: IndexedMeshProps;
    point?: XYZProps;
    bsurf?: BSplineSurfaceProps;
  }

  export interface CurvePrimitiveProps {
    lineSegment?: [XYZProps, XYZProps];
    lineString?: XYZProps[];
    bcurve?: BcurveProps;
    transitionSpiral?: TransitionSpiralProps;
    arc?: ArcByVectorProps | [XYZProps, XYZProps, XYZProps];
  }

  export interface PointProps {
    point?: XYZProps;
  }

  /**
   * Right side (content) properties for {bsurf: BSplineSurfaceProps}
   *
   */
  export interface BSplineSurfaceProps {
    orderU: number;
    orderV: number;
    points: [[[number]]];   // each inner array is xyz or xyzw for a single control point. each middle array is a row of control points.
    uKnots: [number];
    vKnots: [number];
  }

  /**
   * Interface for a collection of curves, eg. as used as a swept contour.
   *
   */
  export interface CurveCollectionProps extends PlanarRegionProps {
    /** A sequence of curves joined head to tail: */
    path?: [CurvePrimitiveProps];
    /** A collection of curves with no required structure or connections: */
    bagofCurves?: [CurveCollectionProps];
  }

  /**
   * Interface for a collection of curves that bound a planar region
   *
   */
  export interface PlanarRegionProps {
    /** A sequence of curves which connect head to tail, with the final connecting back to the first */
    loop?: [CurvePrimitiveProps];
    /** A collection of loops, with composite inside/outside determined by parity rules.
     * (The single outer boundary with one or more holes is a parityRegion)
     */
    parityRegion?: [{ loop: [CurvePrimitiveProps] }];
    unionRegion?: [PlanarRegionProps];
  }
  /**
   * Interface for solid primitives: box, sphere, cylinder, cone, torusPipe, linear sweep, rotational sweep, ruled sweep.
   */
  export interface SolidPrimitiveProps {
    cylinder?: CylinderProps;
    box?: BoxProps;
    sphere?: SphereProps;
    cone?: ConeProps;
    torusPipe?: TorusPipeProps;
    linearSweep?: LinearSweepProps;
    rotationalSweep?: RotationalSweepProps;
    ruledSweep?: RuledSweepProps;
  }
  /**
   * * There are multiple ways to specify an orientation
   * * A "Best" among these is application specific.
   * * An object with AxesProps should only specify one of the variants.
   * * YawPitchRollAngles uses 3 angles.
   * * * Cases where only one of the 3 is nonzero are intuitive
   * * * Cases where more than one is nonzero have difficult interactions and order issues.
   * * xyVectors uses a vector along the x direction and a vector into positive xy plane
   *    along any direction not parallel to x.
   * * * In most cases, users supply a normalized x and the actual normalized y vector.
   * * zxVectors uses a z vector and another vector into the positive zx plane.
   * * * In most cases, users supply a normalized z and the actual normalized x vector.
   */
  export interface AxesProps {
    /**
     * See YawPitchAngles class for further information about using 3 rotations to specify orientation.
     */
    yawPitchRollAngles?: YawPitchRollProps;
    /**
     * Cartesian coordinate directions defined by X direction then Y direction.
     * * The right side contains two vectors in an array.
     * * The first vector gives the x axis direction
     * * * This is normalized to unit length.
     * * The second vector gives the positive y direction inthe xy plane.
     * * * This vector is adjusted to be unit length and perpendicular to the x direction.
     */
    xyVectors?: [XYZProps, XYZProps];
    /**
     * Cartesian coordinate directions defined by X direction then Y direction.
     * * The right side contains two vectors in an array.
     * * The first vector gives the z axis direction
     * * * This is normalized to unit length.
     * * The second vector gives the positive x direction inthe zx plane.
     * * * This vector is adjusted to be unit length and perpendicular to the z direction.
     */
    zxVectors?: [XYZProps, XYZProps];
  }

  /**
   * Interface for Arc3d value defined by center, vectorX, vectorY and sweepStartEnd.
   */
  export interface ArcByVectorProps {
    center: XYZProps;
    vectorX: XYZProps;
    vectorY: XYZProps;
    sweepStartEnd: AngleSweepProps;
  }

  /**
   * Interface for Cone value defined by centers, radii, and (optional) vectors for circular section planes.
   */
  export interface ConeProps extends AxesProps {
    start: XYZProps;
    end: XYZProps;

    /** radius at `start` */
    startRadius: number;
    /** radius at `end` */
    endRadius?: number;

    /**
     * * VectorX and vectorY are optional.
     * * If either one is missing, both vectors are constructed perpendicular to the vector from start to end.
     */
    vectorX?: XYZProps;
    vectorY?: XYZProps;
    /** flag for circular end caps. */
    capped?: boolean;
  }

  /**
   * Interface for cylinder defined by a radius and axis start and end centers.
   */
  export interface CylinderProps {
    /** axis point at start */
    start: XYZProps;
    /** axis point at end */
    end: XYZProps;
    radius: number;
    /** flag for circular end caps. */
    capped?: boolean;
  }

  /**
   * Interface for a linear sweep of a base curve or region.
   */
  export interface LinearSweepProps {
    /** The swept curve or region.  Any curve collection */
    contour: CurveCollectionProps;
    /** The sweep vector  */
    vector: XYZProps;
    /** flag for circular end caps. */
    capped?: boolean;
  }

  /**
   * Interface for a rotational sweep of a base curve or region around an axis.
   */
  export interface RotationalSweepProps {
    /** The swept curve or region.  Any curve collection */
    contour: CurveCollectionProps;
    /** any point on the axis of rotation. */
    center: XYZProps;
    /** The axis of rotation  */
    axis: XYZProps;
    /** sweep angle */
    sweepAngle: AngleProps;
    /** flag for circular end caps. */
    capped?: boolean;
  }

  /**
   * Interface for a surface with ruled sweeps between corresponding curves on successvie contours
   */
  export interface RuledSweepProps {
    /** The swept curve or region.  An array of curve collections.  */
    contour: [CurveCollectionProps];
    /** flag for circular end caps. */
    capped?: boolean;
  }

  /**
   * Interface for spiral
   * * Any 4 (but not 5) of the 5 values `[startBearing, endBearing, startRadius, endRadius, length]`
   *       may be defined.
   * * In radius data, zero radius indicates straight line (infinite radius)
   * * Note that the inherited AxesProps allows multiple ways to specify orientation of the placement..
   */
  export interface TransitionSpiralProps extends AxesProps {

    /** origin of the coordinate system. */
    origin: XYZProps;
    /** angle at departure from origin. */
    startBearing?: AngleProps;
    endBearing?: AngleProps;
    startRadius?: number;
    endRadius?: number;
    curveLength?: number;
    /** TransitionSpiral type.   Default is `"clothoid"` */
    type?: string; //   one of:   "clothoid" | "biquadratic" | "bloss" | "cosine" | "sine";
    /** A fractional portion of the spiral may be selected.
     * * If this is missing, fraction range is `[0,1]`
     */
    intervalFractions?: [number, number];
  }

  /**
   * Interface for bspline curve (aka bcurve)
   */
  export interface BcurveProps {
    /** control points */
    point: [XYZProps];
    /** knots. */
    knot: [number];
    /** order of polynomial
     * * The order is the number of basis functions that are in effect at any knot value.
     * * The order is the number of points that affect the curve at any knot value,
     *     i.e. the size of the "local support" set
     * * `order=2` is lines (degree 1)
     * * `order=3` is quadratic (degree 2)
     * * `order=4` is cubic (degree 3)
     * * The number of knots follows the convention "poles+order= knots".
     * * In this convention (for example), a clamped cubic with knots `[0,0,0,0, 1,2,3,4,4,4,4]`
     * has:
     * * * 4 (`order`) copies of the start and end knot (0 and 4) and
     * * * 3 interior knots
     * * Hence expect 7 poles.
     */
    order: number;
  }

  /**
   * Interface for Box (or frustum with all rectangular sections parallel to primary xy section)
   * * Orientation may be given in any `AxesProp`s way (yawPitchRoll, xyVectors, zxVectors)
   * * if topX or topY are omitted, each defaults to its baseX or baseY peer.
   * * `topOrigin` is determined with this priority order:
   * * * `topOrigin` overrides given `height`
   * * * on the z axis at distance `height`
   * * * If both `topOrigin` and `height` are omitted, `height` defaults to `baseX`
   */
  export interface BoxProps extends AxesProps {
    /** Origin of the box coordinate system  (required) */
    origin: XYZProps;
    /** base x size (required) */
    baseX: number;
    /** base size
     * * if omitted, defaults to baseX.
     */
    baseY: number;
    /** top origin.
     * * This is NOT required to be on the z axis.
     * * If omitted, a `heigh` must be present to given topOrigin on z axis.
     */
    topOrigin?: XYZProps;
    /** optional height.  This is only used if `topOrigin` is omitted. */
    height?: number;
    /** x size on top section.
     * * If omitted, `baseX` is used
     */
    topX?: number;
    /** y size on top section.
     * * If omitted, `baseY` is used
     */
    topY?: number;
    /** optional capping flag. */
    capped?: boolean;

  }

  /**
   * Interface for Sphere (with optionally different radius to pole versus equator)
   * * Orientation may be given in any `AxesProp`s way (yawPitchRoll, xyVectors, zxVectors)
   */
  export interface SphereProps extends AxesProps {
    /** Center of the sphere coordinate system */
    center: XYZProps;

    /** primary radius */
    radius?: number;
    /** optional x radius */
    radiusX?: number;
    /** optional y radius */
    radiusY?: number;

    /** optonal radius at poles.  */
    radiusZ?: number;

    /** optional sweep range for latitude.  Default latitude limits are [-90,90 ] degrees. */
    latitudeStartEnd?: AngleSweepProps;
    /** optional capping flag. If missing, implied false */
    capped?: boolean;
  }

  /**
   * Interface for TorusPipe data
   * * Orientation may be given in any `AxesProp`s way (yawPitchRoll, xyVectors, zxVectors)
   * * Both radii are required.
   * * axes are required
   * * Axis definintion is
   * * xy plane contains the major circle
   * * x axis points from donut hole center to flow center at start of pipe.
   * * z axis points through the hole.
   */
  export interface TorusPipeProps extends AxesProps {
    /** Center of the full torus coordinate system. (donut hole center) */
    center: XYZProps;

    /** primary radius  (elbow radius) */
    majorRadius: number;
    /** pipe radius */
    minorRadius?: number;
    /** sweep angle.
     * * if omitted, full 360 degree sweep.
     */
    sweepAngle?: AngleProps;
    /** optional capping flag. If missing, implied false */
    capped?: boolean;
  }

  /**
   * Interface for a ruleds sweep.
   *
   */
  export interface RuledSweepProps {
    countour: [CurveCollectionProps];
    /** optional capping flag. */
    capped?: boolean;
  }

  /**
   * Interface for an indexed mesh.
   * * IMPORTANT: All indices are one-based.
   * * i.e. vertex index given as 11 appears at index 10 in the data array.
   * * This is to allow a negated index to mean "don't draw the followinge edge"
   * * Although negative indices are not allowed for normalIndex, colorIndex, or paramIndex, the "one based" style
   *     is used for them so that all indices within the indexedMesh json object are handled similarly.
   * * In all index arrays, a ZERO indicates "end of facet".
   * *
   */
  export interface IndexedMeshProps {
    /** vertex coordinates */
    point: [XYZProps];
    /** surface normals */
    normal?: [XYZProps];
    /** texture space (uv parameter) coordinates */
    param?: [XYProps];
    /** 32 bit color values */
    color?: [number];

    /** SIGNED ONE BASED ZERO TERMINATED array of point indices. */
    pointIndex: [number];
    /** ONE BASED ZERO TERMINATED array of param indices.  ZERO is terminator for single facet. */
    paramIndex?: [number];
    /** ONE BASED ZERO TERMINATED array of normal indices. ZERO is terminator for single facet. */
    normalIndex?: [number];
    /** ONE BASED ZERO TERMINATED array of color indices. ZERO is terminator for single facet. */
    colorIndex?: [number];
  }
  /** parser servoces for "iModelJson" schema
   * * 1: create a reader with `new ImodelJsonReader`
   * * 2: parse json fragment to strongly typed geometry: `const g = reader.parse (fragment)`
   */
  export class Reader {

    public constructor() { // empty ctor
    }

    private static parseVector3dProperty(json: any, propertyName: string, defaultValue?: Vector3d | undefined): Vector3d | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (Geometry.isNumberArray(value, 3))
          return Vector3d.create(value[0], value[1], value[2]);
        if (XYZ.isXAndY(value))
          return Vector3d.fromJSON(value);
      }
      return defaultValue;
    }

    private static parsePoint3dProperty(json: any, propertyName: string, defaultValue?: Point3d | undefined): Point3d | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (Geometry.isNumberArray(value, 3))
          return Point3d.create(value[0], value[1], value[2]);
        if (XYZ.isXAndY(value))
          return Point3d.fromJSON(value);
      }
      return defaultValue;
    }

    private static parseSegment1dProperty(json: any, propertyName: string, defaultValue?: Segment1d | undefined): Segment1d | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (Geometry.isNumberArray(value, 2))
          return Segment1d.create(value[0], value[1]);
      }
      return defaultValue;
    }

    private static parseNumberProperty(json: any, propertyName: string, defaultValue?: number | undefined): number | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (Number.isFinite(value))
          return value as number;
      }
      return defaultValue;
    }
    /* ==============
        private static parseNumberArrayProperty(json: any, propertyName: string, minValues: number, maxValues: number, defaultValue?: number[] | undefined): number[] | undefined {
          if (json.hasOwnProperty(propertyName)) {
            const value = json[propertyName];
            if (Array.isArray(value)
              && value.length >= minValues && value.length <= maxValues) {
              const result = [];
              for (const a of value) {
                result.push(a);
              }
              return result;
            }
          }
          return defaultValue;
        }
    */
    private static parseAngleProperty(json: any, propertyName: string, defaultValue?: Angle | undefined): Angle | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        return Angle.fromJSON(value);
      }
      return defaultValue;
    }
    /**
     * @param defaultFunction function to call if needed to produce a default value
     */
    private static parseAngleSweepProps(json: any, propertyName: string, defaultFunction?: () => AngleSweep): AngleSweep | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        return AngleSweep.fromJSON(value);
      }
      if (defaultFunction === undefined)
        return undefined;
      return defaultFunction();
    }

    private static parseBooleanProperty(json: any, propertyName: string, defaultValue?: boolean | undefined): boolean | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (value === true) return true;
        if (value === false) return false;
      }
      return defaultValue;
    }

    private static loadContourArray(json: any, propertyName: string): CurveCollection[] | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (Array.isArray(value)) {
          const result = [];
          for (const contourData of value) {
            const contour = Reader.parse(contourData);
            if (contour instanceof CurveCollection) {
              result.push(contour);
            }
          }
          if (result.length > 0)
            return result;
        }
      }
      return undefined;
    }

    private static parseYawPitchRollAngles(json: any): Matrix3d | undefined {
      const ypr = YawPitchRollAngles.fromJSON(json);
      return ypr.toMatrix3d();
    }

    private static parseStringProperty(json: any, propertyName: string, defaultValue?: string | undefined): string | undefined {
      if (json.hasOwnProperty(propertyName)) {
        const value = json[propertyName];
        if (value.type === "string")
          return value;
      }
      return defaultValue;
    }

    private static parseAxesFromVectors(json: any, axisOrder: AxisOrder, createDefaultIdentity: boolean): Matrix3d | undefined {
      if (Array.isArray(json) && json.length === 2) {
        const xVector = Vector3d.fromJSON(json[0]);
        const yVector = Vector3d.fromJSON(json[1]);
        const matrix = Matrix3d.createRigidFromColumns(xVector, yVector, axisOrder);
        if (matrix) return matrix;
      }
      if (createDefaultIdentity)
        return Matrix3d.createIdentity();
      return undefined;
    }
    /**
     * Look for orientation data and convert to Matrix3d.
     * * Search order is:
     * * * yawPitchRollAngles
     * * * xyVectors
     * * * zxVectors
     * @param json [in] json source data
     * @param createDefaultIdentity [in] If true and no orientation is present, return an identity matrix.  If false and no orientation is present, return undefined.
     */
    private static parseOrientation(json: any, createDefaultIdentity: boolean): Matrix3d | undefined {
      if (json.yawPitchRollAngles) {
        return Reader.parseYawPitchRollAngles(json.yawPitchRollAngles);
      } else if (json.xyVectors) {
        return Reader.parseAxesFromVectors(json.xyVectors, AxisOrder.XYZ, createDefaultIdentity);
      } else if (json.zxVectors) {
        return Reader.parseAxesFromVectors(json.zxVectors, AxisOrder.ZXY, createDefaultIdentity);
      }
      if (createDefaultIdentity)
        return Matrix3d.createIdentity();
      return undefined;
    }

    private static parseArcByVectorProps(data?: ArcByVectorProps): Arc3d | undefined {
      if (data
        && data.center !== undefined
        && data.vectorX !== undefined
        && data.vectorY !== undefined
        && data.sweepStartEnd !== undefined
      ) {
        return Arc3d.create(
          Point3d.fromJSON(data.center),
          Vector3d.fromJSON(data.vectorX),
          Vector3d.fromJSON(data.vectorY),
          AngleSweep.fromJSON(data.sweepStartEnd));
      }
      return undefined;
    }
    // remark: Returns LineString3d as last default when give points are colinear.
    private static parseArcBy3Points(data?: ArcByVectorProps): Arc3d | LineString3d | undefined {
      if (Array.isArray(data) && data.length > 2) {
        const pointA = Point3d.fromJSON(data[0]);
        const pointB = Point3d.fromJSON(data[1]);
        const pointC = Point3d.fromJSON(data[2]);
        return Arc3d.createCircularStartMiddleEnd(pointA, pointB, pointC);
      }
      return undefined;
    }

    private static parseArcObject(data?: ArcByVectorProps): Arc3d | LineString3d | undefined {
      let arc: Arc3d | LineString3d | undefined = Reader.parseArcByVectorProps(data);
      if (arc)
        return arc;
      arc = Reader.parseArcBy3Points(data);
      return arc; // possibly undefined.
    }

    public static parseCoordinate(data?: any): CoordinateXYZ | undefined {
      const point = Point3d.fromJSON(data);
      if (point)
        return CoordinateXYZ.create(point);
      return undefined;
    }

    public static parseTransitionSpiral(data?: any): TransitionSpiral3d | undefined {
      const axes = Reader.parseOrientation(data, true)!;
      const origin = Reader.parsePoint3dProperty(data, "origin");
      // the create method will juggle any 4 out of these 5 inputs to define the other ..
      const startBearing = Reader.parseAngleProperty(data, "startBearing");
      const endBearing = Reader.parseAngleProperty(data, "endBearing");
      const startRadius = Reader.parseNumberProperty(data, "startRadius");
      const endRadius = Reader.parseNumberProperty(data, "endRadius");
      const length = Reader.parseNumberProperty(data, "curveLength", undefined);

      const interval = Reader.parseSegment1dProperty(data, "fractionInterval", undefined);

      const spiralType = Reader.parseStringProperty(data, "spiralType", "clothoid");
      if (origin)
        return TransitionSpiral3d.create(
          spiralType,
          startRadius, endRadius,
          startBearing, endBearing,
          length,
          interval,
          Transform.createOriginAndMatrix(origin, axes));
      return undefined;
    }

    public static parseBcurve(data?: any): BSplineCurve3d | BSplineCurve3dH | undefined {
      if (Array.isArray(data.points) && Array.isArray(data.knots) && Number.isFinite(data.order) && data.closed !== undefined) {
        if (data.points[0].length === 4) {
          const hPoles: Point4d[] = [];
          for (const p of data.points) hPoles.push(Point4d.fromJSON(p));
          const knots: number[] = [];
          for (const knot of data.knots) knots.push(knot);
          // TODO -- wrap poles and knots for closed case !!
          if (data.closed) {
            for (let i = 0; i + 1 < data.order; i++) {
              hPoles.push(hPoles[i].clone());
            }
          }
          const newCurve = BSplineCurve3dH.create(hPoles, knots, data.order);
          if (newCurve) {
            if (data.closed === true)
              newCurve.setWrappable(true);
            return newCurve;
          }
        } else if (data.points[0].length === 3 || data.points[0].length === 2) {

          const poles: Point3d[] = [];
          for (const p of data.points) poles.push(Point3d.fromJSON(p));
          const knots: number[] = [];
          for (const knot of data.knots) knots.push(knot);
          // TODO -- wrap poles and knots for closed case !!
          if (data.closed) {
            for (let i = 0; i + 1 < data.order; i++) {
              poles.push(poles[i].clone());
            }
          }
          const newCurve = BSplineCurve3d.create(poles, knots, data.order);
          if (newCurve) {
            if (data.closed === true)
              newCurve.setWrappable(true);
            return newCurve;
          }
        }

      }
      return undefined;
    }

    public static parseArray(data?: any): any[] | undefined {
      if (Array.isArray(data)) {
        const myArray = [];
        let c;
        for (c of data) {
          const g = Reader.parse(c);
          if (g !== undefined)
            myArray.push(g);
        }
        return myArray;
      }
      return undefined;
    }

    // For each nonzero index, Announce Math.abs (value) -1
    private static addZeroBasedIndicesFromSignedOneBased(data: any, f: (x: number) => any): void {
      if (data && Geometry.isNumberArray(data)) {
        for (const value of data) {
          if (value !== 0)
            f(Math.abs(value) - 1);
        }
      }
    }
    public static parsePolyfaceAuxData(data?: any): PolyfaceAuxData | undefined {

      if (!Array.isArray(data.channels) || !Array.isArray(data.indices))
        return undefined;

      const outChannels: AuxChannel[] = [];
      for (const inChannel of data.channels) {
        if (Array.isArray(inChannel.data) && inChannel.hasOwnProperty("dataType")) {
          const outChannelData: AuxChannelData[] = [];
          for (const inChannelData of inChannel.data) {
            if (inChannelData.hasOwnProperty("input") && Array.isArray(inChannelData.values))
              outChannelData.push(new AuxChannelData(inChannelData.input, inChannelData.values));
          }
          outChannels.push(new AuxChannel(outChannelData, inChannel.dataType as AuxChannelDataType, inChannel.name, inChannel.inputName));
        }
      }
      return new PolyfaceAuxData(outChannels, data.indices);
    }

    public static parseIndexedMesh(data?: any): any | undefined {
      // {Coord:[[x,y,z],. . . ],   -- simple xyz for each ponit
      // CoordIndex[1,2,3,0]    -- zero-terminated, one based !!!
      if (data.hasOwnProperty("point") && Array.isArray(data.point)
        && data.hasOwnProperty("pointIndex") && Array.isArray(data.pointIndex)) {
        const polyface = IndexedPolyface.create();
        if (data.hasOwnProperty("normal") && Array.isArray(data.normal)) {
          for (const uvw of data.normal) {
            if (Geometry.isNumberArray(uvw, 3))
              polyface.addNormal(Vector3d.create(uvw[0], uvw[1], uvw[2]));
          }
        }
        if (data.hasOwnProperty("param") && Array.isArray(data.param)) {
          for (const uv of data.param) {
            if (Geometry.isNumberArray(uv, 2))
              polyface.addParam(Point2d.create(uv[0], uv[1]));
          }
        }
        if (data.hasOwnProperty("color") && Array.isArray(data.color)) {
          for (const c of data.color) {
            polyface.addColor(c);
          }
        }

        for (const p of data.point) polyface.addPoint(Point3d.fromJSON(p));

        for (const p of data.pointIndex) {
          if (p === 0)
            polyface.terminateFacet(false); // we are responsible for index checking !!!
          else {
            const p0 = Math.abs(p) - 1;
            polyface.addPointIndex(p0, p > 0);
          }
        }

        if (data.hasOwnProperty("normalIndex")) {
          Reader.addZeroBasedIndicesFromSignedOneBased(data.normalIndex,
            (x: number) => { polyface.addNormalIndex(x); });
        }
        if (data.hasOwnProperty("paramIndex")) {
          Reader.addZeroBasedIndicesFromSignedOneBased(data.paramIndex,
            (x: number) => { polyface.addParamIndex(x); });
        }

        if (data.hasOwnProperty("colorIndex")) {
          Reader.addZeroBasedIndicesFromSignedOneBased(data.colorIndex,
            (x: number) => { polyface.addColorIndex(x); });
        }
        if (data.hasOwnProperty("auxData"))
          polyface.data.auxData = Reader.parsePolyfaceAuxData(data.auxData);

        return polyface;
      }
      return undefined;
    }

    public static parseCurveCollectionMembers(result: CurveCollection, data?: any): CurveCollection | undefined {
      if (data && Array.isArray(data)) {
        for (const c of data) {
          const g = Reader.parse(c);
          if (g !== undefined)
            result.tryAddChild(g);
        }
        return result;
      }
      return undefined;
    }

    public static parseBsurf(data?: any) {
      if (data.hasOwnProperty("uKnots") && Array.isArray(data.uKnots)
        && data.hasOwnProperty("vKnots") && Array.isArray(data.vKnots)
        && data.hasOwnProperty("orderU") && Number.isFinite(data.orderU)
        && data.hasOwnProperty("orderV") && Number.isFinite(data.orderV)
        && data.hasOwnProperty("points") && Array.isArray(data.points)
      ) {
        const orderU = data.orderU;
        const orderV = data.orderV;
        if (Array.isArray(data.points[0]) && Array.isArray(data.points[0][0])) {
          const d = data.points[0][0].length;
          /** xyz surface (no weights) */
          if (d === 3) {
            return BSplineSurface3d.createGrid(data.points,
              orderU, data.uKnots,
              orderV, data.vKnots);
          }
          /** xyzw surface (weights already applied) */
          if (d === 4) {
            return BSplineSurface3dH.createGrid(data.points,
              WeightStyle.WeightsAlreadyAppliedToCoordinates,
              orderU, data.uKnots,
              orderV, data.vKnots);
          }
        }
      }
      return undefined;
    }
    /**
     * Create a cone with data from a `ConeByCCRRV`.
     */
    public static parseConeProps(json?: ConeProps): any {
      const axes = Reader.parseOrientation(json, false);
      const start = Reader.parsePoint3dProperty(json, "start");
      const end = Reader.parsePoint3dProperty(json, "end");

      const startRadius = Reader.parseNumberProperty(json, "startRadius");
      const endRadius = Reader.parseNumberProperty(json, "endRadius", startRadius);

      const capped = Reader.parseBooleanProperty(json, "capped", false) as boolean;

      if (start
        && end
        && startRadius !== undefined
        && endRadius !== undefined) {
        if (axes === undefined) {
          const axisVector = Vector3d.createStartEnd(start, end);
          const frame = Matrix3d.createRigidHeadsUp(axisVector, AxisOrder.ZXY);
          const vectorX = frame.columnX();
          const vectorY = frame.columnY();
          return Cone.createBaseAndTarget(start, end, vectorX, vectorY, startRadius, endRadius, capped);
        } else {
          return Cone.createBaseAndTarget(start, end, axes.columnX(), axes.columnY(), startRadius, endRadius, capped);
        }
      }
      return undefined;
    }

    /**
     * Create a cylinder.
     */
    public static parseCylinderProps(json?: CylinderProps): any {
      const start = Reader.parsePoint3dProperty(json, "start");
      const end = Reader.parsePoint3dProperty(json, "end");
      const radius = Reader.parseNumberProperty(json, "radius");

      const capped = Reader.parseBooleanProperty(json, "capped", false) as boolean;

      if (start
        && end
        && radius !== undefined) {
        return Cone.createAxisPoints(start, end, radius, radius, capped);
      }
      return undefined;
    }

    private static parseLineSegmentProps(value: any[]): any {
      if (Array.isArray(value) && value.length > 1)
        return LineSegment3d.create(Point3d.fromJSON(value[0]), Point3d.fromJSON(value[1]));
    }

    public static parseLinearSweep(json?: any): any {
      const contour = Reader.parse(json.contour);
      const capped = Reader.parseBooleanProperty(json, "capped");
      const extrusionVector = Reader.parseVector3dProperty(json, "vector");
      if (contour
        && capped !== undefined
        && extrusionVector
      ) {
        return LinearSweep.create(contour, extrusionVector, capped);
      }
      return undefined;
    }

    public static parseRotationalSweep(json?: any): any {
      const contour = Reader.parse(json.contour);
      const capped = Reader.parseBooleanProperty(json, "capped");
      const axisVector = Reader.parseVector3dProperty(json, "axis");
      const center = Reader.parsePoint3dProperty(json, "center");
      const sweepDegrees = Reader.parseNumberProperty(json, "sweepAngle");
      if (contour
        && sweepDegrees !== undefined
        && capped !== undefined
        && axisVector
        && center
      ) {
        return RotationalSweep.create(
          contour,
          Ray3d.createCapture(center, axisVector),
          Angle.createDegrees(sweepDegrees),
          capped);
      }
      return undefined;
    }
    public static parseBox(json?: any): any {
      const capped = Reader.parseBooleanProperty(json, "capped", false);
      const baseOrigin = Reader.parsePoint3dProperty(json, "baseOrigin");
      const baseX = Reader.parseNumberProperty(json, "baseX");
      const baseY = Reader.parseNumberProperty(json, "baseY", baseX);
      let topOrigin = Reader.parsePoint3dProperty(json, "topOrigin");
      const topX = Reader.parseNumberProperty(json, "topX", baseX);
      const topY = Reader.parseNumberProperty(json, "topY", baseY);
      const height = Reader.parseNumberProperty(json, "height", baseX);
      const axes = Reader.parseOrientation(json, true)!;

      if (baseOrigin && !topOrigin)
        topOrigin = Matrix3d.XYZMinusMatrixTimesXYZ(baseOrigin, axes, Vector3d.create(0, 0, height));

      if (capped !== undefined
        && baseX !== undefined
        && baseY !== undefined
        && topY !== undefined
        && topX !== undefined
        && axes
        && baseOrigin
        && topOrigin
      ) {
        return Box.createDgnBoxWithAxes(baseOrigin, axes, topOrigin, baseX, baseY, topX, topY, capped);
      }
      return undefined;
    }

    public static parseSphere(json?: SphereProps): any {
      const center = Reader.parsePoint3dProperty(json, "center");
      // optional unqualified radius . . .
      const radius = Reader.parseNumberProperty(json, "radius");
      // optional specific X
      const radiusX = Reader.parseNumberProperty(json, "radiusX", radius);
      // missing Y and Z both pick up radiusX  (which may have already been defaulted from unqualified radius)
      const radiusY = Reader.parseNumberProperty(json, "radiusX", radiusX);
      const radiusZ = Reader.parseNumberProperty(json, "radiusX", radiusX);
      const latitudeStartEnd = Reader.parseAngleSweepProps(json, "latitudeStartEnd"); // this may be undfined!!

      const axes = Reader.parseOrientation(json, true)!;

      const capped = Reader.parseBooleanProperty(json, "capped", false);

      if (center !== undefined
        && radiusX !== undefined
        && radiusY !== undefined
        && radiusZ !== undefined
        && capped !== undefined) {
        return Sphere.createFromAxesAndScales(center, axes, radiusX, radiusY, radiusZ, latitudeStartEnd, capped);
      }
      return undefined;
    }

    public static parseRuledSweep(json?: any): any {
      const capped = Reader.parseBooleanProperty(json, "capped", false);
      const contours = this.loadContourArray(json, "contour");
      if (contours !== undefined
        && capped !== undefined) {
        return RuledSweep.create(contours, capped);
      }
      return undefined;
    }

    public static parseTorusPipe(json?: any): any {

      const axes = Reader.parseOrientation(json, true)!;
      const center = Reader.parsePoint3dProperty(json, "center");
      const radiusA = Reader.parseNumberProperty(json, "majorRadius");
      const radiusB = Reader.parseNumberProperty(json, "minorRadius");
      const sweepAngle = Reader.parseAngleProperty(json, "sweepAngle", undefined);
      const capped = Reader.parseBooleanProperty(json, "capped", false)!;
      if (center
        && radiusA !== undefined
        && radiusB !== undefined
      ) {

        return TorusPipe.createDgnTorusPipe(center, axes.columnX(), axes.columnY(),
          radiusA, radiusB,
          sweepAngle ? sweepAngle : Angle.createDegrees(360), capped);
      }
      return undefined;
    }
    public static parsePointArray(json?: any): Point3d[] {
      const points = [];
      if (json && Array.isArray(json)) {
        for (const member of json) {
          if (XYZ.isXAndY(member)) {
            points.push(Point3d.fromJSON(member));
          } else if (Geometry.isNumberArray(member, 2)) {
            points.push(Point3d.fromJSON(member));
          }
        }
      }
      return points;
    }

    public static parse(json?: any): any {
      if (json !== undefined && json as object) {
        if (json.lineSegment !== undefined) {
          return Reader.parseLineSegmentProps(json.lineSegment);
        } else if (json.lineString !== undefined) {
          return LineString3d.create(Reader.parsePointArray(json.lineString));
        } else if (json.arc !== undefined) {
          return Reader.parseArcObject(json.arc);
        } else if (json.hasOwnProperty("point")) {
          return Reader.parseCoordinate(json.point);

        } else if (json.hasOwnProperty("bcurve")) {
          return Reader.parseBcurve(json.bcurve);
        } else if (json.hasOwnProperty("path")) {
          return Reader.parseCurveCollectionMembers(new Path(), json.path);
        } else if (json.hasOwnProperty("loop")) {
          return Reader.parseCurveCollectionMembers(new Loop(), json.loop);
        } else if (json.hasOwnProperty("parityRegion")) {
          return Reader.parseCurveCollectionMembers(new ParityRegion(), json.parityRegion);
        } else if (json.hasOwnProperty("unionRegion")) {
          return Reader.parseCurveCollectionMembers(new UnionRegion(), json.unionRegion);
        } else if (json.hasOwnProperty("bagOfCurves")) {
          return Reader.parseCurveCollectionMembers(new BagOfCurves(), json.bagOfCurves);
        } else if (json.hasOwnProperty("indexedMesh")) {
          return Reader.parseIndexedMesh(json.indexedMesh);
        } else if (json.hasOwnProperty("bsurf")) {
          return Reader.parseBsurf(json.bsurf);
        } else if (json.hasOwnProperty("cone")) {
          return Reader.parseConeProps(json.cone);
        } else if (json.hasOwnProperty("cylinder")) {
          return Reader.parseCylinderProps(json.cylinder);
        } else if (json.hasOwnProperty("sphere")) {
          return Reader.parseSphere(json.sphere);
        } else if (json.hasOwnProperty("linearSweep")) {
          return Reader.parseLinearSweep(json.linearSweep);
        } else if (json.hasOwnProperty("box")) {
          return Reader.parseBox(json.box);
        } else if (json.hasOwnProperty("rotationalSweep")) {
          return Reader.parseRotationalSweep(json.rotationalSweep);
        } else if (json.hasOwnProperty("ruledSweep")) {
          return Reader.parseRuledSweep(json.ruledSweep);
        } else if (json.hasOwnProperty("torusPipe")) {
          return Reader.parseTorusPipe(json.torusPipe);
        } else if (json.hasOwnProperty("pointString")) {
          return PointString3d.create(Reader.parsePointArray(json.pointString));
        } else if (json.hasOwnProperty("transitionSpiral")) {
          return Reader.parseTransitionSpiral(json.transitionSpiral);
        } else if (Array.isArray(json))
          return Reader.parseArray(json);
      }
      return undefined;
    }
  }
  // ISSUE: include 3d in names?
  // ISSUE: would like shorter term than lineSegment
  // ISSUE: is arc clear?
  // ISSUE: label center, vectorX, vector90 on arc?
  // ISSUE: sweep data on arc -- serialize as AngleSweep?
  export class Writer extends GeometryHandler {
    public handleLineSegment3d(data: LineSegment3d): any {
      return { "lineSegment": [data.point0Ref.toJSON(), data.point1Ref.toJSON()] };
    }
    public handleCoordinateXYZ(data: CoordinateXYZ): any {
      return { "point": data.point.toJSON() };
    }

    public handleArc3d(data: Arc3d): any {
      return {
        "arc": {
          "center": data.center.toJSON(),
          "vectorX": data.vector0.toJSON(),
          "vectorY": data.vector90.toJSON(),
          "sweepStartEnd": [data.sweep.startDegrees, data.sweep.endDegrees],
        },
      };
    }
    /**
     * Insert orientation description to a data object.
     * @param matrix matrix with orientation
     * @param omitIfIdentity omit the axis data if the matrix is an identity.
     * @param data AxesProps object to be annotated.
     */
    private static insertOrientationFromMatrix(data: AxesProps, matrix: Matrix3d | undefined, omitIfIdentity: boolean) {
      if (omitIfIdentity) {
        if (matrix === undefined)
          return;
        if (matrix.isIdentity)
          return;
      }
      if (matrix)
        data.xyVectors = [matrix.columnX().toJSON(), matrix.columnY().toJSON()];
      else
        data.xyVectors = [[1, 0, 0], [0, 1, 0]];
    }
    private static isIdentityXY(xVector: Vector3d, yVector: Vector3d): boolean {
      return xVector.isAlmostEqualXYZ(1, 0, 0) && yVector.isAlmostEqualXYZ(0, 1, 0);
    }

    /**
     * Insert orientation description to a data object.
     * @param matrix matrix with orientation
     * @param omitIfIdentity omit the axis data if the matrix is an identity.
     * @param data AxesProps object to be annotated.
     */
    private static insertOrientationFromXYVectors(data: AxesProps, vectorX: Vector3d, vectorY: Vector3d, omitIfIdentity: boolean) {
      if (omitIfIdentity && Writer.isIdentityXY(vectorX, vectorY))
        return;
      data.xyVectors = [vectorX.toJSON(), vectorY.toJSON()];
    }

    /**
     * Insert orientation description to a data object, with orientation defined by u and v direction
     * vectors.
     * @param vectorX u direction
     * @param vectorV v direction
     * @param omitIfIdentity omit the axis data if the vectorU and vectorV are global x and y vectors.
     * @param data AxesProps object to be annotated.
     */
    private static insertXYOrientation(data: AxesProps, vectorU: Vector3d, vectorV: Vector3d, omitIfIdentity: boolean) {
      if (omitIfIdentity) {
        if (vectorU.isAlmostEqualXYZ(1, 0, 0) && vectorV.isAlmostEqualXYZ(0, 1, 0))
          return;
      }
      data.xyVectors = [vectorU.toJSON(), vectorV.toJSON()];
    }

    public handleTransitionSpiral(data: TransitionSpiral3d): any {
      // TODO: HANDLE NONRIGID TRANSFORM !!
      // the spiral may have indication of how it was defined.  If so, use defined/undefined state of the orignial data
      // as indication of what current data to use.  (Current data may have changed due to transforms.)
      const originalProperties = data.originalProperties;

      const value: TransitionSpiralProps = {
        origin: data.localToWorld.origin.toJSON(),
        type: data.getSpiralType()!,
      };
      Writer.insertOrientationFromMatrix(value, data.localToWorld.matrix, true);

      if (!data.activeFractionInterval.isExact01)
        Object.defineProperty(value, "fractionInterval", [data.activeFractionInterval.x0, data.activeFractionInterval.x1]);

      // if possible, do selective output of defining data (omit exactly one out of the 5, matching original definition)
      if (originalProperties !== undefined && originalProperties.numDefinedProperties() === 4) {
        if (originalProperties.radius0 !== undefined)
          value.startRadius = data.radius01.x0;
        if (originalProperties.radius1 !== undefined)
          value.endRadius = data.radius01.x1;
        if (originalProperties.bearing0 !== undefined)
          value.startBearing = data.bearing01.startAngle.toJSON();
        if (originalProperties.bearing1 !== undefined)
          value.endBearing = data.bearing01.endAngle.toJSON();
        if (originalProperties.curveLength !== undefined)
          value.curveLength = data.curveLength();
      } else {
        // uh oh ... no original data, but the spiral itself knows all 5 values.  We don't know which to consider primary.
        // DECISION -- put everything out, let readers make sense if they can. (It should be consistent ?)
        value.startRadius = data.radius01.x0;
        value.endRadius = data.radius01.x1;
        value.startBearing = data.bearing01.startAngle.toJSON();
        value.endBearing = data.bearing01.endAngle.toJSON();
        value.curveLength = data.curveLength();
      }
      return { "transitionSpiral": value };
    }

    public handleCone(data: Cone): any {

      const radiusA = data.getRadiusA();
      const radiusB = data.getRadiusB();
      const centerA = data.getCenterA();
      const centerB = data.getCenterB();
      const vectorX = data.getVectorX();
      const vectorY = data.getVectorY();
      const axisVector = Vector3d.createStartEnd(centerA, centerB);

      if (Geometry.isSameCoordinate(radiusA, radiusB)
        && vectorX.isPerpendicularTo(axisVector)
        && vectorY.isPerpendicularTo(axisVector)
        && Geometry.isSameCoordinate(vectorX.magnitude(), 1.0)
        && Geometry.isSameCoordinate(vectorY.magnitude(), 1.0)) {
        return {
          "cylinder": {
            "capped": data.capped,
            "start": data.getCenterA().toJSON(),
            "end": data.getCenterB().toJSON(),
            "radius": radiusA,
          },
        };
      } else {
        const coneProps: ConeProps = {
          "capped": data.capped,
          "start": data.getCenterA().toJSON(),
          "end": data.getCenterB().toJSON(),
          "startRadius": data.getRadiusA(),
          "endRadius": data.getRadiusB(),
        };
        Writer.insertOrientationFromXYVectors(coneProps, vectorX, vectorY, false);
        return { "cone": coneProps };
      }
    }

    public handleSphere(data: Sphere): any {
      const xData = data.cloneVectorX().normalizeWithLength();
      const yData = data.cloneVectorY().normalizeWithLength();
      const zData = data.cloneVectorZ().normalizeWithLength();
      const latitudeSweep = data.cloneLatitudeSweep();

      const rX = xData.mag;
      const rY = yData.mag;
      const rZ = zData.mag;
      if (xData.v && zData.v) {
        const value: SphereProps = {
          "center": data.cloneCenter().toJSON(),
        };
        if (!(data.getConstructiveFrame()!).matrix.isIdentity)
          value.zxVectors = [zData.v.toJSON(), xData.v.toJSON()];
        const fullSweep = latitudeSweep.isFullLatitudeSweep;

        if (data.capped && !fullSweep)
          value.capped = data.capped;

        if (Geometry.isSameCoordinate(rX, rY) && Geometry.isSameCoordinate(rX, rZ))
          value.radius = rX;
        else {
          value.radiusX = rX;
          value.radiusY = rY;
          value.radiusZ = rZ;
        }
        if (!fullSweep)
          value.latitudeStartEnd = latitudeSweep.toJSON();
        return { "sphere": value };
      }
      return undefined;
    }

    public handleTorusPipe(data: TorusPipe): any {

      const vectorX = data.cloneVectorX();
      const vectorY = data.cloneVectorY();
      const radiusA = data.getMajorRadius();
      const radiusB = data.getMinorRadius();
      const sweep = data.getSweepAngle();
      if (data.getIsReversed()) {
        vectorY.scaleInPlace(-1.0);
        sweep.setRadians(-sweep.radians);
      }
      const value: TorusPipeProps = {
        "center": data.cloneCenter().toJSON(),
        "majorRadius": radiusA,
        "minorRadius": radiusB,
        "xyVectors": [vectorX.toJSON(), vectorY.toJSON()],
      };
      if (!sweep.isFullCircle) {
        value.sweepAngle = sweep.degrees;
        value.capped = data.capped;
      }
      return { "torusPipe": value };

    }

    public handleLineString3d(data: LineString3d): any {
      const pointsA = data.points;
      const pointsB = [];
      if (pointsA)
        for (const p of pointsA) pointsB.push(p.toJSON());
      return { "lineString": pointsB };
    }

    public handlePointString3d(data: PointString3d): any {
      const pointsA = data.points;
      const pointsB = [];
      if (pointsA)
        for (const p of pointsA) pointsB.push(p.toJSON());
      return { "pointString": pointsB };
    }

    public handlePath(data: Path): any {
      return { "path": this.collectChildren(data) };
    }
    public handleLoop(data: Loop): any {
      return { "loop": this.collectChildren(data) };
    }

    public handleParityRegion(data: ParityRegion): any {
      return { "parityRegion": this.collectChildren(data) };
    }

    public handleUnionRegion(data: UnionRegion): any {
      return { "unionRegion": this.collectChildren(data) };
    }

    public handleBagOfCurves(data: BagOfCurves): any {
      return { "bagOfCurves": this.collectChildren(data) };
    }

    private collectChildren(data: CurveCollection): any[] {
      const children = [];
      if (data.children && Array.isArray(data.children)) {
        for (const child of data.children) {
          const cdata = child.dispatchToGeometryHandler(this);
          if (cdata)
            children.push(cdata);
        }
      }
      return children;
    }

    public handleLinearSweep(data: LinearSweep): any {
      const extrusionVector = data.cloneSweepVector();
      const curves = data.getCurvesRef();
      const capped = data.capped;
      if (extrusionVector
        && curves
        && capped !== undefined) {
        return {
          "linearSweep": {
            "contour": curves.dispatchToGeometryHandler(this),
            "capped": capped,
            "vector": extrusionVector.toJSON(),
          },
        };
      }
      return undefined;
    }

    public handleRuledSweep(data: RuledSweep): any {
      const contours = data.cloneContours();
      const capped = data.capped;
      if (contours
        && contours.length > 1
        && capped !== undefined) {
        const jsonContours = [];
        for (const c of contours) {
          jsonContours.push(this.emit(c));
        }
        return {
          "ruledSweep": {
            "contour": jsonContours,
            "capped": capped,
          },
        };
      }
      return undefined;
    }

    public handleRotationalSweep(data: RotationalSweep): any {
      const axisRay = data.cloneAxisRay();
      const curves = data.getCurves();
      const capped = data.capped;
      const sweepAngle = data.getSweep();
      return {
        "rotationalSweep": {
          "axis": axisRay.direction.toJSON(),
          "contour": curves.dispatchToGeometryHandler(this),
          "capped": capped,
          "center": axisRay.origin.toJSON(),
          "sweepAngle": sweepAngle.degrees,
        },
      };
    }

    public handleBox(box: Box): any {
      const out: any = {
        "box": {
          "baseOrigin": box.getBaseOrigin().toJSON(),
          "baseX": box.getBaseX(),
          "baseY": box.getBaseY(),
          "capped": box.capped,
          "topOrigin": box.getTopOrigin().toJSON(),
        },
      };
      Writer.insertXYOrientation(out.box, box.getVectorX(), box.getVectorY(), true);
      if (!Geometry.isSameCoordinate(box.getTopX(), box.getBaseX()))
        out.box.topX = box.getTopX();
      if (!Geometry.isSameCoordinate(box.getTopY(), box.getBaseY()))
        out.box.topY = box.getTopY();

      return out;
    }

    private handlePolyfaceAuxData(auxData: PolyfaceAuxData): any {
      const contents: { [k: string]: any } = {};

      contents.indices = auxData.indices.slice(0);
      contents.channels = [];
      for (const inChannel of auxData.channels) {
        const outChannel: { [k: string]: any } = {};
        outChannel.dataType = inChannel.dataType;
        outChannel.name = inChannel.name;
        outChannel.inputName = inChannel.inputName;
        outChannel.data = [];
        for (const inData of inChannel.data) {
          const outData: { [k: string]: any } = {};
          outData.input = inData.input;
          outData.values = inData.values.slice(0);
          outChannel.data.push(outData);
        }

        contents.channels.push(outChannel);
      }
      return contents;
    }

    public handleIndexedPolyface(pf: IndexedPolyface): any {
      const points = [];
      const pointIndex: number[] = [];
      const normals = [];
      const params = [];
      const colors = [];
      const p = Point3d.create();
      for (let i = 0; pf.data.point.atPoint3dIndex(i, p); i++)
        points.push(p.toJSON());

      if (pf.data.normal) {
        for (const value of pf.data.normal) normals.push(value.toJSON());
      }

      if (pf.data.param) {
        for (const value of pf.data.param) params.push(value.toJSON());
      }

      if (pf.data.color) {
        for (const value of pf.data.color) colors.push(value);
      }

      const visitor = pf.createVisitor(0);
      let indexCounter = 0;

      const normalIndex = [];
      const paramIndex = [];
      const colorIndex = [];

      let n;
      while (visitor.moveToNextFacet()) {
        n = visitor.indexCount;
        // All meshes have point and point index ...
        for (let i = 0; i < n; i++) {
          // Change sign of value to be pushed based on whether or not the edge was originally visible or not
          const toPush = pf.data.edgeVisible[indexCounter + i] ? visitor.pointIndex[i] + 1 : - (visitor.clientPointIndex(i) + 1);
          pointIndex.push(toPush);
        }
        pointIndex.push(0);  // facet terminator.
        indexCounter += visitor.indexCount;

        if (visitor.normalIndex) {
          for (let i = 0; i < n; i++) normalIndex.push(1 + visitor.clientNormalIndex(i));
          normalIndex.push(0);
        }
        if (visitor.paramIndex) {
          for (let i = 0; i < n; i++) paramIndex.push(1 + visitor.clientParamIndex(i));
          paramIndex.push(0);
        }
        if (visitor.colorIndex) {
          for (let i = 0; i < n; i++) colorIndex.push(1 + visitor.clientColorIndex(i));
          colorIndex.push(0);
        }
      }
      // assemble the contents in alphabetical order.
      const contents: { [k: string]: any } = {};

      if (pf.data.auxData)
        contents.auxData = this.handlePolyfaceAuxData(pf.data.auxData);

      if (pf.data.color) contents.color = colors;
      if (pf.data.colorIndex) contents.colorIndex = colorIndex;

      if (pf.data.normal) contents.normal = normals;
      if (pf.data.normalIndex) contents.normalIndex = normalIndex;

      if (pf.data.param) contents.param = params;
      if (pf.data.paramIndex) contents.paramIndex = paramIndex;

      contents.point = points;
      contents.pointIndex = pointIndex;

      return { "indexedMesh": contents };
    }

    public handleBSplineCurve3d(curve: BSplineCurve3d): any {
      // ASSUME -- if the curve originated "closed" the knot and pole replication are unchanged,
      // so first and last knots can be re-assigned, and last (degree - 1) poles can be deleted.
      if (curve.isClosable) {
        const knots = curve.copyKnots(true);
        const poles = curve.copyPoints();
        const degree = curve.degree;
        for (let i = 0; i < degree; i++) poles.pop();
        // knots have replicated first and last.  Change the values to be periodic.
        const leftIndex = degree;
        const rightIndex = knots.length - degree - 1;
        const knotPeriod = knots[rightIndex] - knots[leftIndex];
        knots[0] = knots[rightIndex - degree] - knotPeriod;
        knots[knots.length - 1] = knots[leftIndex + degree] + knotPeriod;
        return {
          "bcurve": {
            "points": poles,
            "knots": knots,
            "closed": true,
            "order": curve.order,
          },
        };
      } else {
        return {
          "bcurve": {
            "points": curve.copyPoints(),
            "knots": curve.copyKnots(true),
            "closed": false,
            "order": curve.order,
          },
        };
      }
    }

    public handleBSplineCurve3dH(curve: BSplineCurve3dH): any {
      // ASSUME -- if the curve originated "closed" the knot and pole replication are unchanged,
      // so first and last knots can be re-assigned, and last (degree - 1) poles can be deleted.
      if (curve.isClosable) {
        const knots = curve.copyKnots(true);
        const poles = curve.copyPoints();
        const degree = curve.degree;
        for (let i = 0; i < degree; i++) poles.pop();
        // knots have replicated first and last.  Change the values to be periodic.
        const leftIndex = degree;
        const rightIndex = knots.length - degree - 1;
        const knotPeriod = knots[rightIndex] - knots[leftIndex];
        knots[0] = knots[rightIndex - degree] - knotPeriod;
        knots[knots.length - 1] = knots[leftIndex + degree] + knotPeriod;
        return {
          "bcurve": {
            "points": poles,
            "knots": knots,
            "closed": true,
            "order": curve.order,
          },
        };
      } else {
        return {
          "bcurve": {
            "points": curve.copyPoints(),
            "knots": curve.copyKnots(true),
            "closed": false,
            "order": curve.order,
          },
        };
      }
    }

    public handleBSplineSurface3d(surface: BSplineSurface3d): any {
      // ASSUME -- if the curve originated "closed" the knot and pole replication are unchanged,
      // so first and last knots can be re-assigned, and last (degree - 1) poles can be deleted.
      if (surface.isClosable(0)
        || surface.isClosable(1)) {
        // TODO
      } else {
        return {
          "bsurf": {
            "points": surface.getPointArray(false),
            "uKnots": surface.copyKnots(0, true),
            "vKnots": surface.copyKnots(1, true),
            "orderU": surface.orderUV(0),
            "orderV": surface.orderUV(1),
          },
        };
      }
    }

    public handleBSplineSurface3dH(surface: BSplineSurface3dH): any {
      const data = surface.getPointGridJSON();
      return {
        "bsurf": {
          "points": data.points,
          "uKnots": surface.copyKnots(0, true),
          "vKnots": surface.copyKnots(1, true),
          "orderU": surface.orderUV(0),
          "orderV": surface.orderUV(1),
        },
      };
    }

    public emitArray(data: object[]): any {
      const members = [];
      for (const c of data) {
        const toPush = this.emit(c);
        members.push(toPush);
      }
      return members;
    }

    public emit(data: any): any {
      if (Array.isArray(data))
        return this.emitArray(data);

      if (data instanceof GeometryQuery) {
        return data.dispatchToGeometryHandler(this);
      }
      return undefined;
    }
    /** One-step static method to create a writer and emit a json object */
    public static toIModelJson(data: any): any {
      const writer = new Writer();
      return writer.emit(data);
    }
  }
}
