/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import { Vector3d } from "@bentley/geometry-core";
import { RotMatrix, Transform } from "@bentley/geometry-core";
import { AxisOrder } from "@bentley/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core";

export const enum StyleMod {
  Scale = 0x0001,       // Scale present
  SWidth = 0x0008,      // Start width present
  EWidth = 0x0010,      // End width present
  Normal = 0x0100,      // Surface normal present
  RMatrix = 0x0200,     // Rotation matrix present
  TrueWidth = 0x2000,
}

/** Line style parameters. */
export class LineStyleParams {
  public modifiers = 0;
  public scale = 1.0;       // Applied to all length values
  public dashScale?: number;   // Applied to adjustable dash strokes
  public gapScale?: number;    // Applied to adjustable gap strokes
  public startWidth?: number;  // Taper start width
  public endWidth?: number;    // Taper end width
  public distPhase?: number;   // Phase shift by distance
  public fractPhase?: number;  // Phase shift by fraction
  public lineMask?: number;    // Multiline line mask
  public mlineFlags?: number;  // Multiline flags
  public readonly normal = new Vector3d();
  public readonly rMatrix = new RotMatrix();

  /** Returns LineStyleParams with default values */
  public static createDefaults(): LineStyleParams {
    const retVal = new LineStyleParams();
    retVal.rMatrix.setIdentity();
    retVal.normal.setZero();

    const tmpRetVal = retVal as any;
    for (const prop in tmpRetVal) {    // Assign all numeric properties to zero to begin
      if (this.hasOwnProperty(prop) && typeof tmpRetVal[prop] === "number") {
        tmpRetVal[prop] = 0;
      }
    }
    retVal.scale = retVal.gapScale = retVal.dashScale = retVal.normal.z = 1.0;
    return retVal;
  }

  /** Returns a deep copy of this object. */
  public clone() {
    const retVal = new LineStyleParams();
    retVal.modifiers = this.modifiers;
    retVal.scale = this.scale;
    retVal.dashScale = this.dashScale;
    retVal.gapScale = this.gapScale;
    retVal.startWidth = this.startWidth;
    retVal.endWidth = this.endWidth;
    retVal.distPhase = this.distPhase;
    retVal.fractPhase = this.fractPhase;
    retVal.lineMask = this.lineMask;
    retVal.mlineFlags = this.mlineFlags;
    retVal.normal.setFrom(this.normal);
    retVal.rMatrix.setFrom(this.rMatrix);
    return retVal;
  }

  public setScale(inScale: number) {
    this.modifiers |= 0x01;
    this.scale = inScale;
  }

  public isEqualTo(other: LineStyleParams): boolean {
    if (this === other)   // same pointer
      return true;

    if (other.modifiers !== this.modifiers)
      return false;

    if (0 === other.modifiers && 0 === this.modifiers)
      return true;    // No need to compare further if both inactive...

    if (other.scale !== this.scale ||
      other.dashScale !== this.dashScale ||
      other.gapScale !== this.gapScale ||
      other.startWidth !== this.startWidth ||
      other.endWidth !== this.endWidth ||
      other.distPhase !== this.distPhase ||
      other.fractPhase !== this.fractPhase)
      return false;

    if (!other.normal.isExactEqual(this.normal))
      return false;

    if (!other.rMatrix.isExactEqual(this.rMatrix))
      return false;

    return true;
  }

  public applyTransform(transform: Transform) {
    if (this.modifiers & StyleMod.Normal) {
      transform.matrix.multiplyVector(this.normal, this.normal);
      const normalized = this.normal.normalize();
      if (normalized)
        this.normal.setFrom(normalized);
    }
    if (this.modifiers & StyleMod.RMatrix) {
      const rTmp = this.rMatrix.inverse();
      if (rTmp) {
        rTmp.multiplyMatrixMatrix(transform.matrix, rTmp);
        RotMatrix.createRigidFromRotMatrix(rTmp, AxisOrder.XYZ, rTmp);
        const rTmpInverse = rTmp.inverse();
        if (rTmpInverse)
          this.rMatrix.setFrom(rTmpInverse);
      }
    }

    let scaleFactor = 1.0;
    const scaleVector = Vector3d.create();
    const scaleMatrix = transform.matrix;
    scaleMatrix.normalizeRowsInPlace(scaleVector);

    // Check for flatten transform, dividing scaleVector by 3 gives wrong scaleFactor
    if (scaleVector.x !== 0.0 && scaleVector.y !== 0.0 && scaleVector.z !== 0.0)
      scaleFactor = (scaleVector.x + scaleVector.y + scaleVector.z) / 3.0;
    else
      scaleFactor = (scaleVector.x + scaleVector.y + scaleVector.z) / 2.0;

    if (1.0 === scaleFactor)
      return;

    this.modifiers |= StyleMod.Scale;
    this.scale *= scaleFactor;

    if (!(this.modifiers & StyleMod.TrueWidth))
      return;

    if (this.modifiers & StyleMod.SWidth && this.startWidth)
      this.startWidth *= scaleFactor;

    if (this.modifiers & StyleMod.EWidth && this.endWidth)
      this.endWidth *= scaleFactor;
  }
}

/** Line style id and parameters */
export class LineStyleInfo {
  public styleId: Id64;
  public styleParams: LineStyleParams; // <-- Modifiers for user defined linestyle (if applicable)

  private constructor(styleId: Id64, params?: LineStyleParams) {
    this.styleId = styleId;
    if (params)
      this.styleParams = params;
    else
      this.styleParams = LineStyleParams.createDefaults();
  }

  /** Creates a LineStyleInfo object */
  public static create(styleId: Id64, params?: LineStyleParams): LineStyleInfo {
    return new LineStyleInfo(styleId, params);
  }

  /** Returns a deep copy of this object. */
  public clone(): LineStyleInfo {
    return new LineStyleInfo(this.styleId, this.styleParams.clone());
  }

  public isEqualTo(other: LineStyleInfo): boolean {
    if (this === other)
      return true;
    if (!this.styleId.equals(other.styleId))
      return false;
    if (!this.styleParams.isEqualTo(other.styleParams))
      return false;
    return true;
  }
}
