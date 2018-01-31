/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { RotMatrix, Transform} from "@bentley/geometry-core/lib/Transform";
import { Geometry } from "@bentley/geometry-core/lib/Geometry";
import { ColorDef } from "../ColorDef";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

/** Explicit declaration, separate from generated "schema", for easily changing and reassigning values */
export class DwgHatchDefLine {
  public angle: number;
  public readonly through = new Point2d();
  public readonly offset = new Point2d();
  public readonly dashes: number[] = [];
}

/** Defines a hatch, cross hatch, or area pattern. */
export class PatternParams {
  private readonly _origin = new Point3d();                // Pattern origin (offset from to element's placement)
  private readonly _rMatrix = RotMatrix.createIdentity();             // Pattern coordinate system (relative to element's placement)
  private _space1: number;                 // Primary (row) spacing
  private _space2: number;                 // Secondary (column) spacing
  private _angle1: number;                 // Angle of first hatch or pattern
  private _angle2: number;                 // Angle of second hatch
  private _scale: number;                  // Pattern scale
  private _invisibleBoundary: boolean;     // Whether pattern boundary should not display (ignored when also filled)...
  private _snappable: boolean;             // Whether pattern geometry can be snapped to
  private _useColor: boolean;              // WWhether to use pattern color instead of inheriting current color
  private _useWeight: boolean;             // Whether to use pattern weight instead of inheriting current weight
  private _color?: ColorDef;                // The pattern / hatch color
  private _weight: number;                 // The pattern / hatch weight
  private _symbolId?: Id64;                 // The id of the GeometryPart to use for an area pattern
  private readonly _hatchLines: DwgHatchDefLine[] = [];  // The DWG style hatch definition

  public get dwgHatchDef() { return this._hatchLines; }
  public get origin() { return this._origin; }
  public get orientation() { return this._rMatrix; }
  public get symbolId() { return this._symbolId; }
  public get primarySpacing() { return this._space1; }
  public get secondarySpacing() { return this._space2; }
  public get primaryAngle() { return this._angle1; }
  public get secondaryAngle() { return this._angle2; }
  public get scale() { return this._scale; }
  public get useColor() { return this._useColor; }
  public get color() { return this._color; }
  public get useWeight() { return this._useWeight; }
  public get weight() { return this._weight; }
  public get invisibleBoundary() { return this._invisibleBoundary; }
  public get snappable() { return this._snappable; }

  public setOrigin(origin: Point3d) { this._origin.setFrom(origin); }
  public setOrientation(rMatrix: RotMatrix) { this._rMatrix.setFrom(rMatrix); }
  public setPrimarySpacing(space1: number) { this._space1 = space1; }
  public setSecondarySpacing(space2: number) { this._space2 = space2; }
  public setPrimaryAngle(angle1: number) { this._angle1 = angle1; }
  public setSecondaryAngle(angle2: number) { this._angle2 = angle2; }
  public setScale(scale: number) { this._scale = scale; }
  public setColor(color: ColorDef) { this._color = color; this._useColor = true; }
  public setWeight(weight: number) { this._weight = weight; this._useWeight = true; }
  public setInvisibleBoundary(invisibleBoundary: boolean) { this._invisibleBoundary = invisibleBoundary; }
  public setSnappable(snappable: boolean) { this._snappable = snappable; }
  public setSymbolId(symbolId: Id64) { this._symbolId = symbolId; }
  public setDwgHatchDef(hatchLines: DwgHatchDefLine[]) { this._hatchLines.length = 0; hatchLines.forEach((line) => this._hatchLines.push(line)); }

  public static createDefaults(): PatternParams {
    const retVal = new PatternParams();
    retVal._space1 = retVal._space2 = retVal._angle1 = retVal._angle2 = 0;
    retVal._scale = 1.0;
    retVal._useColor = retVal._useWeight = retVal._invisibleBoundary = retVal._snappable = false;
    retVal._weight = 0;
    return retVal;
  }

  public clone(): PatternParams {
    const retVal = new PatternParams();
    retVal._origin.setFrom(this._origin);
    retVal._rMatrix.setFrom(this._rMatrix);
    retVal._space1 = this._space1;
    retVal._space2 = this._space2;
    retVal._angle1 = this._angle1;
    retVal._angle2 = this._angle2;
    retVal._scale = this._scale;
    retVal._invisibleBoundary = this._invisibleBoundary;
    retVal._snappable = this._snappable;
    retVal._useColor = this._useColor;
    retVal._useWeight = this._useWeight;
    retVal._weight = this._weight;
    retVal._symbolId = this._symbolId;
    this._hatchLines.forEach((line) => retVal._hatchLines.push(line));
    return retVal;
  }

  public isEqualTo(other: PatternParams): boolean {
    if (this === other)
      return true;    // Same pointer

    if (!this._origin.isAlmostEqual(other._origin, 1.0e-10))
      return false;
    if (!this._rMatrix.isAlmostEqual(other._rMatrix, 1.0e-10))
      return false;
    if (!Geometry.isSameCoordinate(this._space1, other._space1, 1.0e-10))
      return false;
    if (!Geometry.isSameCoordinate(this._space2, other._space2, 1.0e-10))
      return false;
    if (!Geometry.isSameCoordinate(this._angle1, other._angle1, 1.0e-10))
      return false;
    if (!Geometry.isSameCoordinate(this._angle2, other._angle2, 1.0e-10))
      return false;
    if (!Geometry.isSameCoordinate(this._scale, other._scale, 1.0e-10))
      return false;
    if (this._invisibleBoundary !== other._invisibleBoundary)
      return false;
    if (this._snappable !== other._snappable)
      return false;
    if (this._useColor !== other._useColor)
      return false;
    else if (this._useColor && !this._color!.equals(other._color!))
      return false;
    if (this._useWeight !== other._useWeight)
      return false;
    else if (this._useWeight && !this._color!.equals(other._color!))
      return false;
    if ((this._symbolId === undefined) !== (other._symbolId === undefined))
      return false;
    else if (this._symbolId && !this._symbolId.equals(other._symbolId!))
      return false;
    if (this._hatchLines.length !== other._hatchLines.length)
      return false;

    for (let i = 0; i < this._hatchLines.length; i++) {
      const otherLine = other._hatchLines[i];
      const thisLine = this._hatchLines[i];

      if (thisLine.dashes.length !== otherLine.dashes.length)
        return false;
      if (!Geometry.isSameCoordinate(otherLine.angle, thisLine.angle, 1.0e-10))
        return false;
      if (!otherLine.through.isAlmostEqual(thisLine.through, 1.0e-10))
        return false;
      if (!otherLine.offset.isAlmostEqual(thisLine.offset, 1.0e-10))
        return false;
      for (let dash = 0; dash < thisLine.dashes.length; ++dash) {
        if (!Geometry.isSameCoordinate(thisLine.dashes[dash], otherLine.dashes[dash], 1.0e-10))
          return false;
      }
    }
    return true;
  }

  public static transformPatternSpace(oldSpace: number, patRot: RotMatrix, angle: number, transform: Transform): number {
    let tmpRot: RotMatrix;
    if (0.0 !== angle) {
      const yprTriple = YawPitchRollAngles.createDegrees(angle, 0.0, 0.0);
      const angRot = yprTriple.toRotMatrix();
      tmpRot = patRot.multiplyMatrixMatrix(angRot);
    } else {
      tmpRot = patRot;
    }

    const yDir = tmpRot.getColumn(1);
    yDir.scale(oldSpace, yDir);
    transform.multiplyVector(yDir, yDir);
    return yDir.magnitude();
  }

  public static getTransformPatternScale(transform: Transform): number {
    const xDir = transform.matrix.getColumn(0);
    const mag = xDir.magnitude();
    return (mag > 1.0e-10) ? mag : 1.0;
  }

  public applyTransform(transform: Transform) {
    if (this._symbolId !== undefined) {
      this._space1 = PatternParams.transformPatternSpace(this._space1, this._rMatrix, this._angle1, transform);
      this._space2 = PatternParams.transformPatternSpace(this._space2, this._rMatrix, this._angle2, transform);
      this._scale *= PatternParams.getTransformPatternScale(transform);
    } else if (0 !== this._hatchLines.length) {
      const scale = PatternParams.getTransformPatternScale(transform);
      if (!Geometry.isSameCoordinate(1.0, scale, 1.0e-10)) {
        this._scale *= scale;

        for (const line of this._hatchLines) {
          line.through.x *= scale;
          line.through.y *= scale;
          line.offset.x *= scale;
          line.offset.y *= scale;
          for (let iDash = 0; iDash < line.dashes.length; iDash++)
            line.dashes[iDash] *= scale;
        }
      }
    } else {
      this._space1 = PatternParams.transformPatternSpace(this._space1, this._rMatrix, this._angle1, transform);

      if (0 !== this._space2)
        this._space2 = PatternParams.transformPatternSpace(this._space2, this._rMatrix, this._angle2, transform);
    }

    transform.multiplyPoint(this._origin);
    this._rMatrix.multiplyMatrixMatrix(transform.matrix, this._rMatrix);
    const normalized = RotMatrix.createPerpendicularUnitColumnsFromRotMatrix(this._rMatrix);
    if (normalized)
      this._rMatrix.setFrom(normalized);
  }

}
