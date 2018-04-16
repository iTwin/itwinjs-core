/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../PointVector";
import { RotMatrix } from "../Transform";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { SolidPrimitive } from "./SolidPrimitive";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../GeometryHandler";
import { Loop, CurveCollection } from "../curve/CurveChain";
import { LineString3d } from "../curve/LineString3d";
/**
 */
export class Box extends SolidPrimitive {
  private localToWorld: Transform;
  private baseX: number;
  private baseY: number;
  private topX: number;
  private topY: number;

  protected constructor(map: Transform,
    baseX: number, baseY: number, topX: number, topY: number, capped: boolean) {
    super(capped);
    this.localToWorld = map;
    this.baseX = baseX;
    this.baseY = baseY;
    this.topX = topX;
    this.topY = topY;
  }
  public clone(): Box {
    return new Box(this.localToWorld.clone(), this.baseX, this.baseY, this.topX, this.topY, this.capped);
  }

  /** Return a coordinate frame (right handed unit vectors)
   * * origin lower left of box
   * * x direction on base rectangle x edge
   * * y direction in base rectangle
   * * z direction perpenedicular
   */
  public getConstructiveFrame(): Transform | undefined {
    return this.localToWorld.cloneRigid();
  }
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this.localToWorld, this.localToWorld);
    return true;
  }

  public cloneTransformed(transform: Transform): Box | undefined {
    const result = this.clone();
    transform.multiplyTransformTransform(result.localToWorld, result.localToWorld);
    return result;
  }

  /**
   * @param baseOrigin Origin of base rectangle
   * @param vectorX  Direction for base rectangle
   * @param vectorY Direction for base rectangle
   * @param topOrigin origin of top rectangle
   * @param baseX size factor for base rectangle (multiplies vectorX)
   * @param baseY size factor for base rectangle (multiplies vectorY)
   * @param topX size factor for top rectangle (multiplies vectorX)
   * @param topY size factor for top rectangle (multiplies vectorY)
   * @param capped true to define top and bottom closure caps
   */
  public static createDgnBox(baseOrigin: Point3d, vectorX: Vector3d, vectorY: Vector3d,
    topOrigin: Point3d,
    baseX: number, baseY: number, topX: number, topY: number,
    capped: boolean): Box | undefined {
    const vectorZ = baseOrigin.vectorTo(topOrigin);
    const localToWorld = Transform.createOriginAndMatrixColumns(baseOrigin, vectorX, vectorY, vectorZ);
    return new Box(localToWorld, baseX, baseY, topX, topY, capped);
  }

  /**
   * @param baseOrigin Origin of base rectangle
   * @param vectorX  Direction for base rectangle
   * @param vectorY Direction for base rectangle
   * @param topOrigin origin of top rectangle
   * @param baseX size factor for base rectangle (multiplies vectorX)
   * @param baseY size factor for base rectangle (multiplies vectorY)
   * @param topX size factor for top rectangle (multiplies vectorX)
   * @param topY size factor for top rectangle (multiplies vectorY)
   * @param capped true to define top and bottom closure caps
   */
  public static createDgnBoxWithAxes(baseOrigin: Point3d, axes: RotMatrix,
    topOrigin: Point3d,
    baseX: number, baseY: number, topX: number, topY: number,
    capped: boolean): Box | undefined {
    return Box.createDgnBox(baseOrigin, axes.columnX(), axes.columnY(), topOrigin,
      baseX, baseY, topX, topY, capped);
  }

  public getBaseX(): number { return this.baseX; }
  public getBaseY(): number { return this.baseY; }
  public getTopX(): number { return this.topX; }
  public getTopY(): number { return this.topY; }
  public getBaseOrigin(): Point3d { return this.localToWorld.multiplyXYZ(0, 0, 0); }
  public getTopOrigin(): Point3d { return this.localToWorld.multiplyXYZ(0, 0, 1); }
  public getVectorX(): Vector3d { return this.localToWorld.matrix.columnX(); }
  public getVectorY(): Vector3d { return this.localToWorld.matrix.columnY(); }
  public getVectorZ(): Vector3d { return this.localToWorld.matrix.columnZ(); }
  public isSameGeometryClass(other: any): boolean { return other instanceof Box; }

  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof Box) {
      if (this.capped !== other.capped) return false;
      if (!this.localToWorld.isAlmostEqual(other.localToWorld)) return false;
      return Geometry.isSameCoordinate(this.baseX, other.baseX)
        && Geometry.isSameCoordinate(this.baseY, other.baseY)
        && Geometry.isSameCoordinate(this.topX, other.topX)
        && Geometry.isSameCoordinate(this.topY, other.topY);
    }
    return false;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBox(this);
  }
  public strokeConstantVSection(zFraction: number): LineString3d {
    const ax = Geometry.interpolate(this.baseX, zFraction, this.topX);
    const ay = Geometry.interpolate(this.baseY, zFraction, this.topY);
    const result = LineString3d.create();
    const transform = this.localToWorld;
    const workPoint = Point3d.create();
    transform.multiplyXYZ(0, 0, zFraction, workPoint);
    result.addPoint(workPoint);
    transform.multiplyXYZ(ax, 0, zFraction, workPoint);
    result.addPoint(workPoint);
    transform.multiplyXYZ(ax, ay, zFraction, workPoint);
    result.addPoint(workPoint);
    transform.multiplyXYZ(0, ay, zFraction, workPoint);
    result.addPoint(workPoint);
    transform.multiplyXYZ(0, 0, zFraction, workPoint);
    result.addPoint(workPoint);
    return result;
  }

  public constantVSection(zFraction: number): CurveCollection {
    const ls = this.strokeConstantVSection(zFraction);
    return Loop.create(ls);
  }
  public extendRange(range: Range3d, transform?: Transform): void {
    const boxTransform = this.localToWorld;
    const ax = this.baseX;
    const ay = this.baseY;
    const bx = this.topX;
    const by = this.topY;
    if (transform) {
      range.extendTransformTransformedXYZ(transform, boxTransform, 0, 0, 0);
      range.extendTransformTransformedXYZ(transform, boxTransform, ax, 0, 0);
      range.extendTransformTransformedXYZ(transform, boxTransform, 0, ay, 0);
      range.extendTransformTransformedXYZ(transform, boxTransform, ax, ay, 0);
      range.extendTransformTransformedXYZ(transform, boxTransform, 0, 0, 1);
      range.extendTransformTransformedXYZ(transform, boxTransform, bx, 0, 1);
      range.extendTransformTransformedXYZ(transform, boxTransform, 0, by, 1);
      range.extendTransformTransformedXYZ(transform, boxTransform, bx, by, 1);
    } else {
      range.extendTransformedXYZ(boxTransform, 0, 0, 0);
      range.extendTransformedXYZ(boxTransform, ax, 0, 0);
      range.extendTransformedXYZ(boxTransform, 0, ay, 0);
      range.extendTransformedXYZ(boxTransform, ax, ay, 0);
      range.extendTransformedXYZ(boxTransform, 0, 0, 1);
      range.extendTransformedXYZ(boxTransform, bx, 0, 1);
      range.extendTransformedXYZ(boxTransform, 0, by, 1);
      range.extendTransformedXYZ(boxTransform, bx, by, 1);
    }
  }
}
