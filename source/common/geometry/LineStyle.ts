/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Vector3d, RotMatrix, Transform } from "@bentley/geometry-core/lib/PointVector";
import { AxisOrder } from "@bentley/geometry-core/lib/Geometry";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

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
  public modifiers: number;
  public reserved: number;
  public scale: number;       // Applied to all length values
  public dashScale: number;   // Applied to adjustable dash strokes
  public gapScale: number;    // Applied to adjustable gap strokes
  public startWidth: number;  // Taper start width
  public endWidth: number;    // Taper end width
  public distPhase: number;   // Phase shift by distance
  public fractPhase: number;  // Phase shift by fraction
  public lineMask: number;    // Multiline line mask
  public mlineFlags: number;  // Multiline flags
  public normal: Vector3d;
  public rMatrix: RotMatrix;

  private constructor() {

  }

  /** Returns LineStyleParams with default values */
  public static createDefaults(): LineStyleParams {
    const retval = new LineStyleParams();
    retval.rMatrix = RotMatrix.createIdentity();
    retval.normal = Vector3d.create();

    const tmpRetval = retval as any;
    for (const prop in tmpRetval) {    // Assign all numeric properties to zero to begin
      if (this.hasOwnProperty(prop) && typeof tmpRetval[prop] === "number") {
        tmpRetval[prop] = 0;
      }
    }
    retval.scale = retval.gapScale = retval.dashScale = retval.normal.z = 1.0;
    return retval;
  }

  /** Returns a deep copy of this object. */
  public clone() {
    const retVal = new LineStyleParams();
    retVal.modifiers = this.modifiers;
    retVal.reserved = this.reserved;
    retVal.scale = this.scale;
    retVal.dashScale = this.dashScale;
    retVal.gapScale = this.gapScale;
    retVal.startWidth = this.startWidth;
    retVal.endWidth = this.endWidth;
    retVal.distPhase = this.distPhase;
    retVal.fractPhase = this.fractPhase;
    retVal.lineMask = this.lineMask;
    retVal.mlineFlags = this.mlineFlags;
    retVal.normal = this.normal.clone();
    retVal.rMatrix = this.rMatrix.clone();
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

    if (other.reserved   !== this.reserved   ||
        other.scale      !== this.scale      ||
        other.dashScale  !== this.dashScale  ||
        other.gapScale   !== this.gapScale   ||
        other.startWidth !== this.startWidth ||
        other.endWidth   !== this.endWidth   ||
        other.distPhase  !== this.distPhase  ||
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
      transform.matrixRef().multiplyVector(this.normal, this.normal);
      const normalized = this.normal.normalize();
      if (normalized)
        this.normal.setFrom(normalized);
    }
    if (this.modifiers & StyleMod.RMatrix) {
      const rTmp = this.rMatrix.inverse();
      if (rTmp) {
        rTmp.multiplyMatrixMatrix(transform.matrixRef(), rTmp);
        RotMatrix.createPerpendicularUnitColumnsFromRotMatrix(rTmp, AxisOrder.XYZ, rTmp);
        const rTmpInverse = rTmp.inverse();
        if (rTmpInverse)
          this.rMatrix.setFrom(rTmpInverse);
      }
    }
    if (bitOptions & 0x01)
      return;

    let scaleFactor = 1.0;
    const scaleVector = Vector3d.create();
    const scaleMatrix = transform.matrixRef();
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

    if (this.modifiers & StyleMod.SWidth)
      this.startWidth *= scaleFactor;

    if (this.modifiers & StyleMod.EWidth)
      this.endWidth *= scaleFactor;
  }
}

/** Non-exported supporting class for LineStyleSymb */
class LineStyleSymbOptions {
  public scale: boolean;
  public dashScale: boolean;
  public gapScale: boolean;
  public orgWidth: boolean;
  public endWidth: boolean;
  public phaseShift: boolean;
  public autoPhase: boolean;
  public maxCompress: boolean;
  public iterationLimit: boolean;
  public treatAsSingleSegment: boolean;
  public plane: boolean;
  public cosmetic: boolean;
  public centerPhase: boolean;
  public xElemPhaseSet: boolean;
  public startTangentSet: boolean;
  public endTangentSet: boolean;
  public elementIsClosed: boolean;
  public continuationXElems: boolean;
  public isCurve: boolean;
  public isContinuous: boolean;

  public constructor() {
    this.scale = false;
    this.dashScale = false;
    this.gapScale = false;
    this.orgWidth = false;
    this.endWidth = false;
    this.phaseShift = false;
    this.autoPhase = false;
    this.maxCompress = false;
    this.iterationLimit = false;
    this.treatAsSingleSegment = false;
    this.plane = false;
    this.cosmetic = false;
    this.centerPhase = false;
    this.xElemPhaseSet = false;
    this.startTangentSet = false;
    this.endTangentSet = false;
    this.elementIsClosed = false;
    this.continuationXElems = false;
    this.isCurve = false;
    this.isContinuous = false;
  }
}

// =======================================================================================
// ! This structure contains options (modifications) that can be applied
// ! to existing line styles to change their appearance without changing the line style
// ! definition. Most of the options pertain to the operation of the StrokePatternComponent
// ! component but the plane definition and scale factors can be used by all components.
// =======================================================================================
export class LineStyleSymb {
  private _options: LineStyleSymbOptions;
  private _lstyle: any;    // <-- Change to use LineStyle class once it is created
  private _nIterate: number;
  private _scale: number;
  private _dashScale: number;
  private _gapScale: number;
  private _orgWidth: number;
  private _endWidth: number;
  private _phaseShift: number;
  private _autoPhase: number;
  private _maxCompress: number;
  private _totalLength: number;    // length of entire element
  private _xElemPhase: number;     // where we left off from the last element (for compound elements)
  private _styleWidth: number;
  private _startTangent: Vector3d;
  private _endTangent: Vector3d;
  private _useStroker: boolean;
  private _useLinePixels: boolean;
  private _linePixels: number;
  private _planeByRows: RotMatrix;

  public get useStroker() { return this._useStroker; }
  public get styleWidth() { return this._styleWidth; }
  public get lStyle() { return this._lstyle; }

  private constructor(lstyle: any) {
    this._lstyle = lstyle;
  }

  /** Returns LineStyleParams with default values */
  public static createDefaults(lstyle: any): LineStyleSymb {
    const retval = new LineStyleSymb(lstyle);
    retval._options = new LineStyleSymbOptions();
    retval._nIterate = 0;
    retval._scale = retval._dashScale = retval._gapScale = 1.0;
    retval._orgWidth = retval._endWidth = retval._phaseShift = retval._autoPhase = retval._styleWidth = 0.0;
    retval._maxCompress = 0.3;
    retval._planeByRows = RotMatrix.createIdentity();
    retval._useLinePixels = false;
    retval._useStroker = false;
    retval._totalLength = 0;
    retval._xElemPhase = 0;
    retval._startTangent = Vector3d.create();
    retval._endTangent = Vector3d.create();
    retval._linePixels = 0;

    return retval;
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

    if (!other._startTangent.isExactEqual(this._startTangent))
        return false;

    if (!other._endTangent.isExactEqual(this._endTangent))
        return false;

    if (!other._planeByRows.isExactEqual(this._planeByRows))
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
    const tmpRetval = retVal._options as any;
    for (const prop in tmpThis) {
      if (tmpThis.hasOwnProperty(prop))
        tmpRetval[prop] = tmpThis[prop];
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
    retVal._startTangent = this._startTangent.clone();
    retVal._endTangent = this._endTangent.clone();
    retVal._useStroker = this._useStroker;
    retVal._useLinePixels = this._useLinePixels;
    retVal._linePixels = this._linePixels;
    retVal._planeByRows = this._planeByRows.clone();
    return retVal;
  }

  // TODO: ADD REST OF FUNCTIONALITY FROM LsSymbology.cpp
}

/** Line style id and parameters */
export class LineStyleInfo {
  private _styleId: Id64;
  private _styleParams: LineStyleParams;   // <-- Modifiers for user defined linestyle (if applicable)
  private _lStyleSymb: LineStyleSymb;      // <-- Cooked form of linestyle

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
    const retVal = new LineStyleInfo(new Id64(this._styleId), this._styleParams.clone());
    retVal._lStyleSymb = this._lStyleSymb.clone();
    return retVal;
  }

  public isEqualTo(other: LineStyleInfo): boolean {
    if (this === other)
      return true;
    if (!this._styleId.equals(other._styleId))
      return false;
    if (!this._styleParams.isEqualTo(other._styleParams))
      return false;
    if (!this._lStyleSymb.isEqualTo(other._lStyleSymb))
      return false;
    return true;
  }
}
