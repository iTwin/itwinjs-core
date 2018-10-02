/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Solid */

import { Point3d, Vector3d } from "../geometry3d/PointVector";
import { Matrix3d } from "../geometry3d/Transform";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { GeometryQuery } from "../curve/GeometryQuery";
import { SolidPrimitive } from "./SolidPrimitive";
import { Geometry } from "../Geometry";
import { GeometryHandler } from "../geometry3d/GeometryHandler";
import { Loop } from "../curve/Loop";
import { CurveCollection } from "../curve/CurveCollection";
import { LineString3d } from "../curve/LineString3d";
/**
 */
export class Box extends SolidPrimitive {
  private _localToWorld: Transform;
  private _baseX: number;
  private _baseY: number;
  private _topX: number;
  private _topY: number;

  protected constructor(map: Transform,
    baseX: number, baseY: number, topX: number, topY: number, capped: boolean) {
    super(capped);
    this._localToWorld = map;
    this._baseX = baseX;
    this._baseY = baseY;
    this._topX = topX;
    this._topY = topY;
  }
  public clone(): Box {
    return new Box(this._localToWorld.clone(), this._baseX, this._baseY, this._topX, this._topY, this.capped);
  }

  /** Return a coordinate frame (right handed unit vectors)
   * * origin lower left of box
   * * x direction on base rectangle x edge
   * * y direction in base rectangle
   * * z direction perpenedicular
   */
  public getConstructiveFrame(): Transform | undefined {
    return this._localToWorld.cloneRigid();
  }
  public tryTransformInPlace(transform: Transform): boolean {
    transform.multiplyTransformTransform(this._localToWorld, this._localToWorld);
    return true;
  }

  public cloneTransformed(transform: Transform): Box | undefined {
    const result = this.clone();
    transform.multiplyTransformTransform(result._localToWorld, result._localToWorld);
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
  public static createDgnBoxWithAxes(baseOrigin: Point3d, axes: Matrix3d,
    topOrigin: Point3d,
    baseX: number, baseY: number, topX: number, topY: number,
    capped: boolean): Box | undefined {
    return Box.createDgnBox(baseOrigin, axes.columnX(), axes.columnY(), topOrigin,
      baseX, baseY, topX, topY, capped);
  }

  public getBaseX(): number { return this._baseX; }
  public getBaseY(): number { return this._baseY; }
  public getTopX(): number { return this._topX; }
  public getTopY(): number { return this._topY; }
  public getBaseOrigin(): Point3d { return this._localToWorld.multiplyXYZ(0, 0, 0); }
  public getTopOrigin(): Point3d { return this._localToWorld.multiplyXYZ(0, 0, 1); }
  public getVectorX(): Vector3d { return this._localToWorld.matrix.columnX(); }
  public getVectorY(): Vector3d { return this._localToWorld.matrix.columnY(); }
  public getVectorZ(): Vector3d { return this._localToWorld.matrix.columnZ(); }
  public isSameGeometryClass(other: any): boolean { return other instanceof Box; }

  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof Box) {
      if (this.capped !== other.capped) return false;
      if (!this._localToWorld.isAlmostEqual(other._localToWorld)) return false;
      return Geometry.isSameCoordinate(this._baseX, other._baseX)
        && Geometry.isSameCoordinate(this._baseY, other._baseY)
        && Geometry.isSameCoordinate(this._topX, other._topX)
        && Geometry.isSameCoordinate(this._topY, other._topY);
    }
    return false;
  }
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBox(this);
  }
  public strokeConstantVSection(zFraction: number): LineString3d {
    const ax = Geometry.interpolate(this._baseX, zFraction, this._topX);
    const ay = Geometry.interpolate(this._baseY, zFraction, this._topY);
    const result = LineString3d.create();
    const transform = this._localToWorld;
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
    const boxTransform = this._localToWorld;
    const ax = this._baseX;
    const ay = this._baseY;
    const bx = this._topX;
    const by = this._topY;
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
