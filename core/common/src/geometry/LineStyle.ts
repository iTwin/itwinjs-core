/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Vector3d } from "@bentley/geometry-core";
import { RotMatrix, Transform } from "@bentley/geometry-core";
import { AxisOrder } from "@bentley/geometry-core";
import { Id64 } from "@bentley/bentleyjs-core";

/** @module Geometry */

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

  public applyTransform(transform: Transform, bitOptions: number) {
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
    if (bitOptions & 0x01)
      return;

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

/** Non-exported supporting class for LineStyleSymb */
class LineStyleSymbOptions {
  public scale = false;
  public dashScale = false;
  public gapScale = false;
  public orgWidth = false;
  public endWidth = false;
  public phaseShift = false;
  public autoPhase = false;
  public maxCompress = false;
  public iterationLimit = false;
  public treatAsSingleSegment = false;
  public plane = false;
  public cosmetic = false;
  public centerPhase = false;
  public xElemPhaseSet = false;
  public startTangentSet = false;
  public endTangentSet = false;
  public elementIsClosed = false;
  public continuationXElems = false;
  public isCurve = false;
  public isContinuous = false;
}

/**
 * This structure contains options (modifications) that can be applied
 * to existing line styles to change their appearance without changing the line style
 * definition. Most of the options pertain to the operation of the StrokePatternComponent
 * component but the plane definition and scale factors can be used by all components.
 */
export class LineStyleSymb {
  private _options?: LineStyleSymbOptions;
  private _lstyle?: any;    // <-- Change to use LineStyle class once it is created
  private _nIterate?: number;
  private _scale?: number;
  private _dashScale?: number;
  private _gapScale?: number;
  private _orgWidth?: number;
  private _endWidth?: number;
  private _phaseShift?: number;
  private _autoPhase?: number;
  private _maxCompress?: number;
  private _totalLength?: number;    // length of entire element
  private _xElemPhase?: number;     // where we left off from the last element (for compound elements)
  private _styleWidth?: number;
  private _startTangent?: Vector3d;
  private _endTangent?: Vector3d;
  private _useStroker?: boolean;
  private _useLinePixels?: boolean;
  private _linePixels?: number;
  private _planeByRows?: RotMatrix;

  public get useStroker() { return this._useStroker; }
  public get styleWidth() { return this._styleWidth; }
  public get lStyle() { return this._lstyle; }

  private constructor(lstyle: any) {
    this._lstyle = lstyle;
  }

  /** Returns LineStyleParams with default values */
  public static createDefaults(lstyle: any): LineStyleSymb {
    const retVal = new LineStyleSymb(lstyle);
    retVal._options = new LineStyleSymbOptions();
    retVal._nIterate = 0;
    retVal._scale = retVal._dashScale = retVal._gapScale = 1.0;
    retVal._orgWidth = retVal._endWidth = retVal._phaseShift = retVal._autoPhase = retVal._styleWidth = 0.0;
    retVal._maxCompress = 0.3;
    retVal._planeByRows = RotMatrix.createIdentity();
    retVal._useLinePixels = false;
    retVal._useStroker = false;
    retVal._totalLength = 0;
    retVal._xElemPhase = 0;
    retVal._startTangent = Vector3d.create();
    retVal._endTangent = Vector3d.create();
    retVal._linePixels = 0;

    return retVal;
  }

  /** Tests if two LineStyleSymb are equal */
  public isEqualTo(other: LineStyleSymb): boolean {
    if (this === other)
      return true;

    if (undefined === other._lstyle && undefined === this._lstyle)
      return true; // No need to compare further if both inactive...

    if (!other._lstyle.isEqualTo(this._lstyle))
      return false;

    const tmp = this._options as any;
    const tmpOther = other._options as any;
    for (const prop in tmp) {
      if (tmp[prop] !== tmpOther[prop])
        return false;
    }

    if (other._nIterate !== this._nIterate)
      return false;

    if (other._scale !== this._scale)
      return false;

    if (other._dashScale !== this._dashScale)
      return false;

    if (other._gapScale !== this._gapScale)
      return false;

    if (other._orgWidth !== this._orgWidth)
      return false;

    if (other._endWidth !== this._endWidth)
      return false;

    if (other._phaseShift !== this._phaseShift)
      return false;

    if (other._autoPhase !== this._autoPhase)
      return false;

    if (other._maxCompress !== this._maxCompress)
      return false;

    if (other._totalLength !== this._totalLength)
      return false;

    if (other._xElemPhase !== this._xElemPhase)
      return false;

    if (this._startTangent && other._startTangent && !other._startTangent.isExactEqual(this._startTangent))
      return false;

    if (this._endTangent && other._endTangent && !other._endTangent.isExactEqual(this._endTangent))
      return false;

    if (this._planeByRows && other._planeByRows && !other._planeByRows.isExactEqual(this._planeByRows))
      return false;

    return true;
  }

  /** Sets this object's lstyle member to undefined. */
  public clear() {
    // this.lstyle = undefined;
  }

  /** Returns a deep copy of this object. */
  public clone(): LineStyleSymb {
    const retVal = new LineStyleSymb(this._lstyle ? this._lstyle.clone() : undefined);
    // Clone the options members
    const tmpThis = this._options as any;
    const tmpRetVal = retVal._options as any;
    for (const prop in tmpThis) {
      if (tmpThis.hasOwnProperty(prop))
        tmpRetVal[prop] = tmpThis[prop];
    }

    // Clone the immediate members
    retVal._nIterate = this._nIterate;
    retVal._scale = this._scale;
    retVal._dashScale = this._dashScale;
    retVal._gapScale = this._gapScale;
    retVal._orgWidth = this._orgWidth;
    retVal._endWidth = this._endWidth;
    retVal._phaseShift = this._phaseShift;
    retVal._autoPhase = this._autoPhase;
    retVal._maxCompress = this._maxCompress;
    retVal._totalLength = this._totalLength;
    retVal._xElemPhase = this._xElemPhase;
    retVal._styleWidth = this._styleWidth;
    if (this._startTangent) retVal._startTangent = this._startTangent.clone();
    if (this._endTangent) retVal._endTangent = this._endTangent.clone();
    retVal._useStroker = this._useStroker;
    retVal._useLinePixels = this._useLinePixels;
    retVal._linePixels = this._linePixels;
    if (this._planeByRows) retVal._planeByRows = this._planeByRows.clone();
    return retVal;
  }

  // TODO: ADD REST OF FUNCTIONALITY FROM LsSymbology.cpp
}

/** Line style id and parameters */
export class LineStyleInfo {
  private _styleId: Id64;
  private _styleParams: LineStyleParams;   // <-- Modifiers for user defined linestyle (if applicable)
  private _lStyleSymb?: LineStyleSymb;      // <-- Cooked form of linestyle

  public get styleId() { return this._styleId; }
  public get styleParams() { return this._styleParams; }
  public get lStyleSymb() { return this._lStyleSymb; }

  private constructor(styleId: Id64, params?: LineStyleParams) {
    this._styleId = styleId;
    if (params)
      this._styleParams = params;
    else
      this._styleParams = LineStyleParams.createDefaults();
  }

  /** Creates a LineStyleInfo object */
  public static create(styleId: Id64, params?: LineStyleParams): LineStyleInfo {
    return new LineStyleInfo(styleId, params);
  }

  /** Returns a deep copy of this object. */
  public clone(): LineStyleInfo {
    const retVal = new LineStyleInfo(this._styleId, this._styleParams.clone());
    if (this._lStyleSymb) retVal._lStyleSymb = this._lStyleSymb.clone();
    return retVal;
  }

  public isEqualTo(other: LineStyleInfo): boolean {
    if (this === other)
      return true;
    if (!this._styleId.equals(other._styleId))
      return false;
    if (!this._styleParams.isEqualTo(other._styleParams))
      return false;
    if (this._lStyleSymb && other._lStyleSymb && !this._lStyleSymb.isEqualTo(other._lStyleSymb))
      return false;
    return true;
  }
}
