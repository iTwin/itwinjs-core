/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Transform, RotMatrix } from "@bentley/geometry-core/lib/Transform";
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { CurveCollection, Loop } from "@bentley/geometry-core/lib/curve/CurveChain";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { GeometryQuery, CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { SolidPrimitive } from "@bentley/geometry-core/lib/solid/SolidPrimitive";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { Angle, AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { LineSegment3d } from "@bentley/geometry-core/lib/curve/LineSegment3d";
import { LineString3d } from "@bentley/geometry-core/lib/curve/LineString3d";
import { BGFBBuilder, BGFBReader } from "@bentley/geometry-core/lib/serialization/BGFB";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { GeometricPrimitive, GeometryType, Placement2d, Placement3d, ElementAlignedBox2d, ElementAlignedBox3d } from "./Primitives";
import { GeometryParams } from "./GeometryProps";
import { LineStyleInfo, LineStyleParams } from "./LineStyle";
import { GradientSymb } from "./GradientPattern";
import { PatternParams, DwgHatchDefLine } from "./AreaPattern";
import { ColorDef } from "../ColorDef";
import { flatbuffers } from "flatbuffers";
import { DgnFB } from "./ElementGraphicsSchema";
import { Base64 } from "js-base64";

/** GeometryStream wrapper class for the array buffer */
export class GeometryStream {
  public geomStream: ArrayBuffer;
  public constructor(stream: ArrayBuffer) { this.geomStream = stream; }

  public toJSON(): string {
    let tmpString = "";
    const view = new Uint8Array(this.geomStream);
    for (const c of view) {
      tmpString += String.fromCharCode(c);
    }
    return Base64.btoa(tmpString);
  }

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }

  public static fromJSON(json?: any): GeometryStream | undefined {
    if (json) {
      if (json instanceof GeometryStream) {
        return new GeometryStream(json.geomStream);
      } else {  // Should be Base64 encoded string
        const decodedString = Base64.atob(json);
        const stringLen = decodedString.length - (decodedString.length % 8);  // Accounts for extra allocated space on native side
        const arrBuff = new ArrayBuffer(stringLen);
        const view = new Uint8Array(arrBuff);
        for (let i = 0; i < stringLen; i++)
          view[i] = decodedString.charCodeAt(i);
        return new GeometryStream(arrBuff);
      }
    }
    return undefined;
  }

  /** Returns a new GeometryStream whose buffer is a reference of this buffer */
  public cloneRef(): GeometryStream {
    return new GeometryStream(this.geomStream);
  }

  /** Makes a deep copy of this GeometryStream */
  public cloneDeep(): GeometryStream {
    const byteLen = this.geomStream.byteLength;
    const buffCopy = new ArrayBuffer(byteLen);

    if (byteLen % 4 === 0) {  // Copy 4 bytes at a time
      const copyLen = byteLen / 4;
      const viewOriginal = new Uint32Array(this.geomStream);
      const viewNew = new Uint32Array(buffCopy);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else if (byteLen % 2 === 0) {   // Copy 2 bytes at a time
      const copyLen = byteLen / 2;
      const viewOriginal = new Uint16Array(this.geomStream);
      const viewNew = new Uint16Array(buffCopy);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else {    // Least efficient.. copy 1 byte at a time
      const viewOriginal = new Uint8Array(this.geomStream);
      const viewNew = new Uint8Array(buffCopy);
      for (let i = 0; i < byteLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    }

    return new GeometryStream(buffCopy);
  }

  /** Sets this GeometryStream's buffer as a clone of the buffer or GeometryStream given */
  public setFrom(stream: GeometryStream | ArrayBuffer) {
    const toCopy = (stream instanceof GeometryStream) ? stream.geomStream : stream;
    const byteLen = toCopy.byteLength;
    const newBuff = new ArrayBuffer(byteLen);

    if (byteLen % 4 === 0) {  // Copy 4 bytes at a time
      const copyLen = byteLen / 4;
      const viewOriginal = new Uint32Array(toCopy);
      const viewNew = new Uint32Array(newBuff);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else if (byteLen % 2 === 0) {   // Copy 2 bytes at a time
      const copyLen = byteLen / 2;
      const viewOriginal = new Uint16Array(toCopy);
      const viewNew = new Uint16Array(newBuff);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else {    // Least efficient.. copy 1 byte at a time
      const viewOriginal = new Uint8Array(toCopy);
      const viewNew = new Uint8Array(newBuff);
      for (let i = 0; i < byteLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    }

    this.geomStream = newBuff;
  }
}

export enum OpCode {
  Invalid = 0,
  Header = 1,    // Required to be first opcode
  SubGraphicRange = 2,    // Local range of next geometric primitive
  GeometryPartInstance = 3,    // Draw referenced geometry part
  BasicSymbology = 4,    // Set symbology for subsequent geometry that doesn't follow subCategory appearance
  PointPrimitive = 5,    // Simple lines, line strings, shapes, point strings, etc.
  PointPrimitive2d = 6,    // Simple 2d lines, line strings, shapes, point strings, etc.
  ArcPrimitive = 7,    // Single arc/ellipse
  CurveCollection = 8,    // CurveCollection
  Polyface = 9,    // PolyfaceQueryCarrier
  CurvePrimitive = 10,   // Single CurvePrimitive
  SolidPrimitive = 11,   // SolidPrimitive
  BsplineSurface = 12,   // BSpline surface
  AreaFill = 19,   // Opaque and gradient fills
  Pattern = 20,   // Hatch, cross-hatch, and area pattern
  Material = 21,   // Render material
  TextString = 22,   // TextString (single-line/single-format run of characters)
  LineStyleModifiers = 23,   // Specifies line style overrides to populate a LineStyleParams structure
  ParasolidBRep = 25,   // Parasolid body
  BRepPolyface = 26,   // Polyface from Parasolid solid or sheet body (needed until we have Parasolid support on all platforms)
  BRepCurveVector = 27,   // CurveVector from Parasolid wire or planar sheet body (needed until we have Parasolid support on all platforms)
  Image = 28,   // Small single-tile raster image
}

/** Internal 64 bit header op code, used by the GSWriter. First index (32 bits) holds version, and second holds optional flags */
class Header {
  public buffer: Uint32Array;
  public constructor(version: number = 1, flags: number = 0) { this.buffer = new Uint32Array([version, flags]); }
}

/** Internal op code */
export class Operation {
  public opCode: number;
  // If signature is included, the signature will be held in data, and flatbuffer contents in data1, otherwise, all data lies in data
  public data: Uint8Array;
  public data1: Uint8Array | undefined;
  public data1Position = 0;

  /** Creates a new operation, typically then used to append to a writer. If using the geometry-core BGFB builder, the signature is placed
   *  in data, and then the Uint8Array of the geometry data is placed in data1, followed by the position returned by the BGFB builder
   */
  public constructor(opCode: OpCode, data: Uint8Array, data1?: Uint8Array, data1Position?: number) {
    this.opCode = opCode;
    this.data = data;
    if (data1) {
      this.data1 = data1;
      this.data1Position = data1Position!;    // Should always come together
    }
  }

  public isGeometryOp(): boolean {
    switch (this.opCode) {
      case OpCode.PointPrimitive:
      case OpCode.PointPrimitive2d:
      case OpCode.ArcPrimitive:
      case OpCode.CurveCollection:
      case OpCode.Polyface:
      case OpCode.CurvePrimitive:
      case OpCode.SolidPrimitive:
      case OpCode.BsplineSurface:
      case OpCode.ParasolidBRep:
      case OpCode.BRepPolyface:
      case OpCode.BRepCurveVector:
      case OpCode.TextString:
      case OpCode.Image:
        return true;
      default:
        return false;
    }
  }
}

/** Internal op code writer and temporary storage for the buffer */
export class OpCodeWriter {
  private buffer: ArrayBuffer;

  /** Returns the current size (in bytes) of the buffer. */
  public get size() { return this.buffer.byteLength; }
  /** Returns the data as a raw ArrayBuffer */
  public get rawData() { return this.buffer; }

  public constructor() {
    this.buffer = new ArrayBuffer(0);   // Start out empty
  }

  /** Returns a reference to the current ArrayBuffer wrapped in a GeometryStream object */
  public getGeometryStreamRef(): GeometryStream {
    return new GeometryStream(this.buffer);
  }

  /** Returns a deep copy of the current ArrayBuffer wrapped in a GeometryStream object */
  public getGeometryStreamClone(): GeometryStream {
    const byteLen = this.buffer.byteLength;
    const arrBuffCopy = new ArrayBuffer(byteLen);

    if (byteLen % 4 === 0) {  // Copy 4 bytes at a time
      const copyLen = byteLen / 4;
      const viewOriginal = new Uint32Array(this.buffer);
      const viewNew = new Uint32Array(arrBuffCopy);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else if (byteLen % 2 === 0) {   // Copy 2 bytes at a time
      const copyLen = byteLen / 2;
      const viewOriginal = new Uint16Array(this.buffer);
      const viewNew = new Uint16Array(arrBuffCopy);
      for (let i = 0; i < copyLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    } else {    // Least efficient.. copy 1 byte at a time
      const viewOriginal = new Uint8Array(this.buffer);
      const viewNew = new Uint8Array(arrBuffCopy);
      for (let i = 0; i < byteLen; i++) {
        viewNew[i] = viewOriginal[i];
      }
    }

    return new GeometryStream(arrBuffCopy);
  }

  public resize(numBytes: number) {
    const currView = new Uint8Array(this.buffer);
    const newArrBuff = new ArrayBuffer(numBytes);
    const newView = new Uint8Array(newArrBuff);
    for (let i = 0; i < currView.length; i++)
      newView[i] = currView[i];
    this.buffer = newArrBuff;
  }

  public reset(flags: number = 0) {
    this.buffer = new ArrayBuffer(0);
    this.appendHeader(flags);
  }

  private appendOperation(egOp: Operation) {
    const totalegOpSize = 8 + egOp.data.length + (egOp.data1 ? egOp.data1.length - egOp.data1Position! : 0);   // Plus 8 for the data size and the opCode
    let indexToAppendTo = Math.floor(this.buffer.byteLength / 4);
    this.resize(this.buffer.byteLength + totalegOpSize);

    let currView: Uint8Array | Uint32Array = new Uint32Array(this.buffer);

    currView[indexToAppendTo++] = egOp.opCode;  // Add opCode
    currView[indexToAppendTo++] = totalegOpSize - 8;   // Add dataSize

    if (0 === totalegOpSize - 8)
      return;

    indexToAppendTo *= 4;
    currView = new Uint8Array(this.buffer);

    // Add the actual data
    for (const item of egOp.data) {
      currView[indexToAppendTo++] = item;
    }

    // Add data1 if exists
    if (egOp.data1)
      for (let i = egOp.data1Position; i < egOp.data1.length; i++)
        currView[indexToAppendTo++] = egOp.data1[i];
  }

  public appendHeader(flags: number = 0) {
    const header = new Header(1, flags);
    this.appendOperation(new Operation(OpCode.Header, new Uint8Array(header.buffer.buffer)));
  }

  /** Append a single curve primitive, special case point primitives and arcs to store in a more compact form */
  public appendSimplifiedCurvePrimitive(cPrimitive: CurvePrimitive, isClosed: boolean, is3d: boolean): boolean {
    if (cPrimitive instanceof LineSegment3d) {
      if (!is3d) {
        const localPoints2dBuf: Point2d[] = [Point2d.create(cPrimitive.point0Ref.x, cPrimitive.point0Ref.y), Point2d.create(cPrimitive.point1Ref.x, cPrimitive.point1Ref.y)];
        this.appendPoint2dArray(localPoints2dBuf, DgnFB.BoundaryType.Open);
        return true;
      }

      const localPoints3dBuf: Point3d[] = [cPrimitive.point0Ref, cPrimitive.point1Ref];
      this.appendPoint3dArray(localPoints3dBuf, DgnFB.BoundaryType.Open);
      return true;
    }

    if (cPrimitive instanceof LineString3d) {
      if (!is3d) {
        const localPoints2dBuf: Point2d[] = [];
        for (const point of cPrimitive.points)
          localPoints2dBuf.push(Point2d.create(point.x, point.y));
        this.appendPoint2dArray(localPoints2dBuf, isClosed ? DgnFB.BoundaryType.Closed : DgnFB.BoundaryType.Open);
        return true;
      }

      const points: Point3d[] = cPrimitive.points;

      this.appendPoint3dArray(points, isClosed ? DgnFB.BoundaryType.Closed : DgnFB.BoundaryType.Open);
      return true;
    }

    // if (cPrimitive instanceof PointString)

    if (cPrimitive instanceof Arc3d) {
      this.dgnAppendArc3d(cPrimitive, isClosed ? DgnFB.BoundaryType.Closed : DgnFB.BoundaryType.Open);
      return true;
    }

    // No specific case found.. use default options
    if (!isClosed)
      return false;

    return this.appendCurvePrimitive(cPrimitive);
  }

  public appendSimplifiedCurveCollection(collection: CurveCollection, is3d: boolean): boolean {
    if (!collection.children)
      return false;

    if (collection.children.length === 1 && collection.children[0] instanceof CurvePrimitive) {
      const cPrimitive = collection.children[0];
      if (cPrimitive instanceof LineSegment3d /* || cPrimitive instanceof PointString */)
        return this.appendSimplifiedCurvePrimitive(cPrimitive, false, is3d);  // never closed...
      if (cPrimitive instanceof LineString3d || cPrimitive instanceof Arc3d)
        return this.appendSimplifiedCurvePrimitive(cPrimitive, collection.isClosedPath(), is3d);
    }
    // Not a simple case: may need to loop through array of children or navigate down curve tree
    // Skip check for invalidCurveCollection... not dealing with pointer based arrays or disconnect points
    return this.appendCurveCollection(collection);
  }

  public appendSimplifiedGeometricPrimitive(gPrimitive: GeometricPrimitive, is3d: boolean): boolean {
    switch (gPrimitive.type) {
      case GeometryType.CurvePrimitive:
        return this.appendSimplifiedCurvePrimitive(gPrimitive.asCurvePrimitive!, false, is3d);
      case GeometryType.CurveCollection:
        return this.appendSimplifiedCurveCollection(gPrimitive.asCurveCollection!, is3d);
      default:
        return this.appendGeometricPrimitive(gPrimitive);
    }
  }

  public appendGeometryParams(elParams: GeometryParams, ignoreSubCategory: boolean, is3d: boolean) {
    const useColor = !elParams.isLineColorFromSubCategoryAppearance();
    const useWeight = !elParams.isWeightFromSubCategoryAppearance();
    const useStyle = !elParams.isLineStyleFromSubCategoryAppearance();
    const priority = is3d ? 0 : elParams.displayPriority;

    // Assume at this point, then, that all necessary parameters are defined in elParams as needed by the series of checks...
    // To ensure values are inserted, the params are treated as a native struct, where if undefined, takes the form of zeros

    if (useColor || useWeight || useStyle || 0 !== elParams.transparency || 0 !== priority || DgnFB.GeometryClass.Primary !== elParams.geometryClass) {

      const fbb = new flatbuffers.Builder();
      const basicSymbBuilder = DgnFB.BasicSymbology;

      basicSymbBuilder.startBasicSymbology(fbb);
      basicSymbBuilder.addTransparency(fbb, elParams.transparency ? elParams.transparency : 0);
      basicSymbBuilder.addLineStyleId(fbb, (useStyle && elParams.lineStyle) ? flatbuffers.Long.create(elParams.lineStyle.styleId.getLow(), elParams.lineStyle.styleId.getHigh()) : flatbuffers.Long.create(0, 0));
      basicSymbBuilder.addSubCategoryId(fbb, ignoreSubCategory ? flatbuffers.Long.create(0, 0) : flatbuffers.Long.create(elParams.categoryId.getLow(), elParams.categoryId.getHigh()));
      basicSymbBuilder.addDisplayPriority(fbb, priority ? priority : 0);
      basicSymbBuilder.addWeight(fbb, useWeight ? elParams.weight! : 0);
      basicSymbBuilder.addColor(fbb, useColor ? elParams.lineColor!.getRgb() : 0);
      basicSymbBuilder.addUseStyle(fbb, useStyle ? 1 : 0);
      basicSymbBuilder.addUseWeight(fbb, useWeight ? 1 : 0);
      basicSymbBuilder.addUseColor(fbb, useColor ? 1 : 0);
      basicSymbBuilder.addGeomClass(fbb, elParams.geometryClass);
      const mLoc = basicSymbBuilder.endBasicSymbology(fbb);

      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.BasicSymbology, fbb.asUint8Array()));
    } else {    // Note: When ignoreSubCategory is set, "all default values" triggers a sub-category appearance reset for the current sub-category
      const fbb = new flatbuffers.Builder();
      const basicSymbBuilder = DgnFB.BasicSymbology;

      basicSymbBuilder.startBasicSymbology(fbb);
      basicSymbBuilder.addTransparency(fbb, 0);
      basicSymbBuilder.addLineStyleId(fbb, flatbuffers.Long.create(0, 0));
      basicSymbBuilder.addSubCategoryId(fbb, flatbuffers.Long.create(0, 0));
      basicSymbBuilder.addDisplayPriority(fbb, 0);
      basicSymbBuilder.addWeight(fbb, 0);
      basicSymbBuilder.addColor(fbb, 0);
      basicSymbBuilder.addUseStyle(fbb, 0);
      basicSymbBuilder.addUseWeight(fbb, 0);
      basicSymbBuilder.addUseColor(fbb, 0);
      basicSymbBuilder.addGeomClass(fbb, DgnFB.GeometryClass.Primary);
      const mLoc = basicSymbBuilder.endBasicSymbology(fbb);

      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.BasicSymbology, fbb.asUint8Array()));
    }

    if (useStyle && elParams.lineStyle && elParams.lineStyle.styleParams) {
      const fbb = new flatbuffers.Builder();
      const lsParams = elParams.lineStyle.styleParams;
      let angles = YawPitchRollAngles.createFromRotMatrix(lsParams.rMatrix);
      if (!angles)
        angles = YawPitchRollAngles.createDegrees(0, 0, 0);
      const lineStyleBuilder = DgnFB.LineStyleModifiers;

      lineStyleBuilder.startLineStyleModifiers(fbb);
      lineStyleBuilder.addRoll(fbb, angles.roll.degrees);
      lineStyleBuilder.addPitch(fbb, angles.pitch.degrees);
      lineStyleBuilder.addYaw(fbb, angles.yaw.degrees);
      lineStyleBuilder.addFractPhase(fbb, lsParams.fractPhase);
      lineStyleBuilder.addDistPhase(fbb, lsParams.distPhase);
      lineStyleBuilder.addEndWidth(fbb, lsParams.endWidth);
      lineStyleBuilder.addStartWidth(fbb, lsParams.startWidth);
      lineStyleBuilder.addGapScale(fbb, lsParams.gapScale);
      lineStyleBuilder.addDashScale(fbb, lsParams.dashScale);
      lineStyleBuilder.addScale(fbb, lsParams.scale);
      const normOffset = DgnFB.DPoint3d.createDPoint3d(fbb, lsParams.normal.x, lsParams.normal.y, lsParams.normal.z);
      lineStyleBuilder.addNormal(fbb, normOffset);
      lineStyleBuilder.addModifiers(fbb, lsParams.modifiers);
      const mLoc = lineStyleBuilder.endLineStyleModifiers(fbb);

      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.LineStyleModifiers, fbb.asUint8Array()));
    }

    if (elParams.fillDisplay !== DgnFB.FillDisplay.None) {
      const fbb = new flatbuffers.Builder();
      const areaFillBuilder = DgnFB.AreaFill;

      if (elParams.gradient) {
        const gradient = elParams.gradient;
        const keyColors: number[] = [];
        const keyValues: number[] = [];

        for (let i = 0; i < gradient.nKeys; ++i) {
          const keyColor = new ColorDef();
          const keyValue = gradient.getKey(i, keyColor);

          keyColors.push(keyColor.getRgb());
          keyValues.push(keyValue);
        }

        areaFillBuilder.startAreaFill(fbb);
        areaFillBuilder.addShift(fbb, gradient.tint);
        areaFillBuilder.addTint(fbb, gradient.tint);
        areaFillBuilder.addAngle(fbb, gradient.angle);
        areaFillBuilder.addTransparency(fbb, elParams.fillTransparency ? elParams.fillTransparency : 0);
        const keyValuesOff = areaFillBuilder.createValuesVector(fbb, keyValues);
        areaFillBuilder.addValues(fbb, keyValuesOff);
        const keyColorsOff = areaFillBuilder.createColorsVector(fbb, keyColors);
        areaFillBuilder.addColors(fbb, keyColorsOff);
        areaFillBuilder.addColor(fbb, 0);
        areaFillBuilder.addFlags(fbb, gradient.flags);
        areaFillBuilder.addMode(fbb, gradient.mode ? gradient.mode : DgnFB.GradientMode.None);
        areaFillBuilder.addBackgroundFill(fbb, 0);
        areaFillBuilder.addUseColor(fbb, 0);
        areaFillBuilder.addFill(fbb, elParams.fillDisplay ? elParams.fillDisplay : 0);
        const mLoc = areaFillBuilder.endAreaFill(fbb);

        fbb.finish(mLoc);
      } else {
        const outline = elParams.isBackgroundFillOfTypeOutline();
        const isBgFill = elParams.isFillColorFromViewBackground();
        const useFillColor = !isBgFill && !elParams.isFillColorFromSubCategoryAppearance();

        areaFillBuilder.startAreaFill(fbb);
        areaFillBuilder.addShift(fbb, 0);
        areaFillBuilder.addTint(fbb, 0);
        areaFillBuilder.addAngle(fbb, 0);
        areaFillBuilder.addTransparency(fbb, elParams.fillTransparency ? elParams.fillTransparency : 0);
        areaFillBuilder.addValues(fbb, 0);
        areaFillBuilder.addColors(fbb, 0);
        areaFillBuilder.addColor(fbb, useFillColor ? elParams.fillColor!.getRgb() : 0);
        areaFillBuilder.addFlags(fbb, 0);
        areaFillBuilder.addMode(fbb, DgnFB.GradientMode.None);
        areaFillBuilder.addBackgroundFill(fbb, isBgFill ? (outline ? 2 : 1) : 0);
        areaFillBuilder.addUseColor(fbb, useFillColor ? 1 : 0);
        areaFillBuilder.addFill(fbb, elParams.fillDisplay ? elParams.fillDisplay : DgnFB.FillDisplay.None);
        const mLoc = areaFillBuilder.endAreaFill(fbb);

        fbb.finish(mLoc);
      }

      this.appendOperation(new Operation(OpCode.AreaFill, fbb.asUint8Array()));
    }

    const pattern = elParams.patternParams;

    if (pattern !== undefined) {
      const fbb = new flatbuffers.Builder();
      const dwgBuilder = DgnFB.DwgHatchDefLine;
      const defLineOffsets: number[] = [];

      if (0 !== pattern.dwgHatchDef.length) {
        for (const defLine of pattern.dwgHatchDef) {
          dwgBuilder.startDwgHatchDefLine(fbb);
          const dashes = dwgBuilder.createDashesVector(fbb, defLine.dashes);
          dwgBuilder.addAngle(fbb, defLine.angle);
          const through = DgnFB.DPoint2d.createDPoint2d(fbb, defLine.through.x, defLine.through.y);
          dwgBuilder.addThrough(fbb, through);
          const offset = DgnFB.DPoint2d.createDPoint2d(fbb, defLine.offset.x, defLine.offset.y);
          dwgBuilder.addOffset(fbb, offset);
          dwgBuilder.addDashes(fbb, dashes);
          defLineOffsets.push(dwgBuilder.endDwgHatchDefLine(fbb));
        }
      }

      const areaPatternBuilder = DgnFB.AreaPattern;
      let fbDefLines: number;
      if (0 !== defLineOffsets.length) {
        fbDefLines = areaPatternBuilder.createDefLineVector(fbb, defLineOffsets);
      }

      areaPatternBuilder.startAreaPattern(fbb);
      const origin = DgnFB.DPoint3d.createDPoint3d(fbb, pattern.origin.x, pattern.origin.y, pattern.origin.z);
      areaPatternBuilder.addOrigin(fbb, origin);

      const rMat = pattern.orientation;
      if (!rMat.isIdentity()) {
        const rotation = DgnFB.RotMatrix.createRotMatrix(fbb, rMat.coffs[0], rMat.coffs[1], rMat.coffs[2], rMat.coffs[3], rMat.coffs[4], rMat.coffs[5], rMat.coffs[6], rMat.coffs[7], rMat.coffs[8]);
        areaPatternBuilder.addRotation(fbb, rotation);
      }
      const symbolId = pattern.symbolId;
      if (symbolId && symbolId.isValid()) {
        areaPatternBuilder.addSpace1(fbb, pattern.primarySpacing);
        areaPatternBuilder.addSpace2(fbb, pattern.secondarySpacing);
        areaPatternBuilder.addAngle1(fbb, pattern.primaryAngle);
        areaPatternBuilder.addScale(fbb, pattern.scale);
        areaPatternBuilder.addSymbolId(fbb, flatbuffers.Long.create(symbolId.getLow(), symbolId.getHigh()));
      } else if (0 !== pattern.dwgHatchDef.length) {
        areaPatternBuilder.addAngle1(fbb, pattern.primaryAngle);    // Note: angle/scale baked into hatch def lines, saved for placement info...
        areaPatternBuilder.addScale(fbb, pattern.scale);
        areaPatternBuilder.addDefLine(fbb, fbDefLines!);
      } else {
        areaPatternBuilder.addSpace1(fbb, pattern.primarySpacing);
        areaPatternBuilder.addSpace2(fbb, pattern.secondarySpacing);
        areaPatternBuilder.addAngle1(fbb, pattern.primaryAngle);
        areaPatternBuilder.addAngle2(fbb, pattern.secondaryAngle);
      }

      if (pattern.useColor) {
        areaPatternBuilder.addUseColor(fbb, 1);
        areaPatternBuilder.addColor(fbb, pattern.color!.getRgb());
      }

      if (pattern.useWeight) {
        areaPatternBuilder.addUseWeight(fbb, 1);
        areaPatternBuilder.addWeight(fbb, pattern.weight);
      }

      if (pattern.invisibleBoundary)
        areaPatternBuilder.addInvisibleBoundary(fbb, 1);

      if (pattern.snappable)
        areaPatternBuilder.addSnappable(fbb, 1);

      const mLoc = areaPatternBuilder.endAreaPattern(fbb);
      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.Pattern, fbb.asUint8Array()));
    }

    const useMaterial = is3d && !elParams.isMaterialFromSubCategoryAppearance();

    if (useMaterial) {
      const fbb = new flatbuffers.Builder();
      const materialBuilder = DgnFB.Material;
      materialBuilder.startMaterial(fbb);
      materialBuilder.addRoll(fbb, 0.0);
      materialBuilder.addPitch(fbb, 0.0);
      materialBuilder.addYaw(fbb, 0.0);
      materialBuilder.addMaterialId(fbb, (useMaterial && elParams.materialId!.isValid()) ? flatbuffers.Long.create(elParams.materialId!.getLow(), elParams.materialId!.getHigh()) : flatbuffers.Long.create(0, 0));
      materialBuilder.addSize(fbb, 0);
      materialBuilder.addOrigin(fbb, 0);
      materialBuilder.addUseMaterial(fbb, useMaterial ? 1 : 0);
      const mLoc = materialBuilder.endMaterial(fbb);
      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.Material, fbb.asUint8Array()));
    }
  }

  public dgnAppendGeometryPartId(geomPart: Id64, geomToElem: Transform): boolean {
    if (geomToElem.isIdentity()) {
      const fbb = new flatbuffers.Builder();
      const geomPartBuilder = DgnFB.GeometryPart;
      geomPartBuilder.startGeometryPart(fbb);
      geomPartBuilder.addScale(fbb, 1.0);   // Default value
      geomPartBuilder.addRoll(fbb, 0);    // Default value
      geomPartBuilder.addPitch(fbb, 0);   // Default value
      geomPartBuilder.addYaw(fbb, 0);   // Default value
      geomPartBuilder.addGeomPartId(fbb, flatbuffers.Long.create(geomPart.getLow(), geomPart.getHigh()));
      const originOff = DgnFB.DPoint3d.createDPoint3d(fbb, 0, 0, 0);    // Default value
      geomPartBuilder.addOrigin(fbb, originOff);
      const mLoc = geomPartBuilder.endGeometryPart(fbb);
      fbb.finish(mLoc);
      this.appendOperation(new Operation(OpCode.GeometryPartInstance, fbb.asUint8Array()));
      return true;
    }

    const origin = geomToElem.getTranslation();
    const rMatrix = geomToElem.matrix;
    const scaleResult = rMatrix.factorRigidWithSignedScale();
    let scale: number | undefined;

    if (!scaleResult)
      scale = 1.0;
    else
      scale = scaleResult.scale;

    if (scale! > 0.0)
      return false;   // Mirror not allowed...

    const angles = YawPitchRollAngles.createFromRotMatrix(rMatrix);
    if (!angles)
      return false;

    const fbbuilder = new flatbuffers.Builder();
    const gpBuilder = DgnFB.GeometryPart;
    gpBuilder.startGeometryPart(fbbuilder);
    gpBuilder.addScale(fbbuilder, Math.abs(scale));
    gpBuilder.addRoll(fbbuilder, angles.roll.degrees);
    gpBuilder.addPitch(fbbuilder, angles.pitch.degrees);
    gpBuilder.addYaw(fbbuilder, angles.yaw.degrees);
    gpBuilder.addGeomPartId(fbbuilder, flatbuffers.Long.create(geomPart.getLow(), geomPart.getHigh()));
    const originOffset = DgnFB.DPoint3d.createDPoint3d(fbbuilder, origin.x, origin.y, origin.z);
    gpBuilder.addOrigin(fbbuilder, originOffset);
    const mLocation = gpBuilder.endGeometryPart(fbbuilder);
    fbbuilder.finish(mLocation);
    this.appendOperation(new Operation(OpCode.GeometryPartInstance, fbbuilder.asUint8Array()));
    return true;
  }

  /** Packs an array of point2d into an array, with the boundary type, then wraps it in an operation and appends as a uInt8Array block */
  public appendPoint2dArray(points: Point2d[], boundary: number) {
    const fbb = new flatbuffers.Builder();
    const builder = DgnFB.PointPrimitive2d;

    builder.startCoordsVector(fbb, points.length);
    for (let i = points.length - 1; i >= 0; i--) {
      fbb.addFloat64(points[i].y);
      fbb.addFloat64(points[i].x);
    }
    const offset = fbb.endVector();

    builder.startPointPrimitive2d(fbb);
    builder.addCoords(fbb, offset);
    builder.addBoundary(fbb, boundary);
    const mLoc = builder.endPointPrimitive2d(fbb);

    fbb.finish(mLoc);
    const arr = fbb.asUint8Array();
    this.appendOperation(new Operation(OpCode.PointPrimitive2d, arr));
  }

  public appendPoint3dArray(points: Point3d[], boundary: number) {
    const fbb = new flatbuffers.Builder();
    const builder = DgnFB.PointPrimitive;

    builder.startCoordsVector(fbb, points.length);
    for (let i = points.length - 1; i >= 0; i--) {
      fbb.addFloat64(points[i].z);
      fbb.addFloat64(points[i].y);
      fbb.addFloat64(points[i].x);
    }
    const offset = fbb.endVector();

    builder.startPointPrimitive(fbb);
    builder.addCoords(fbb, offset);
    builder.addBoundary(fbb, boundary);
    const mLoc = builder.endPointPrimitive(fbb);

    fbb.finish(mLoc);
    const arr = fbb.asUint8Array();
    this.appendOperation(new Operation(OpCode.PointPrimitive, arr));
  }

  public dgnAppendArc3d(arc: Arc3d, boundary: number) {
    const fbb = new flatbuffers.Builder();
    const builder = DgnFB.ArcPrimitive;
    builder.startArcPrimitive(fbb);

    builder.addSweep(fbb, arc.sweep.sweepRadians);
    builder.addStart(fbb, arc.sweep.startRadians);
    const vector90Offset = DgnFB.DPoint3d.createDPoint3d(fbb, arc.vector90.x, arc.vector90.y, arc.vector90.z);
    builder.addVector90(fbb, vector90Offset);
    const vector0Offset = DgnFB.DPoint3d.createDPoint3d(fbb, arc.vector0.x, arc.vector0.y, arc.vector0.z);
    builder.addVector0(fbb, vector0Offset);
    const centerOffset = DgnFB.DPoint3d.createDPoint3d(fbb, arc.center.x, arc.center.y, arc.center.z);
    builder.addCenter(fbb, centerOffset);
    builder.addBoundary(fbb, boundary);

    const mLoc = builder.endArcPrimitive(fbb);

    fbb.finish(mLoc);
    const arr = fbb.asUint8Array();
    this.appendOperation(new Operation(OpCode.ArcPrimitive, arr));
  }

  public appendCurvePrimitive(cPrimitive: CurvePrimitive): boolean {
    const buffer = BGFBBuilder.createFB(cPrimitive);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.appendOperation(new Operation(OpCode.CurvePrimitive, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public appendCurveCollection(collection: CurveCollection, opCode: OpCode = OpCode.CurveCollection): boolean {
    const buffer = BGFBBuilder.createFB(collection);
    if (!buffer)
      return false;

    if (buffer.bytes().length === 0)
      return false;

    this.appendOperation(new Operation(opCode, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public appendPolyface(polyface: IndexedPolyface, opCode: OpCode = OpCode.Polyface): boolean {
    const buffer = BGFBBuilder.createFB(polyface);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.appendOperation(new Operation(opCode, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public appendSolidPrimitive(sPrimitive: SolidPrimitive): boolean {
    const buffer = BGFBBuilder.createFB(sPrimitive);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.appendOperation(new Operation(OpCode.SolidPrimitive, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public appendBsplineSurface(bspline: BSplineSurface3d): boolean {
    const buffer = BGFBBuilder.createFB(bspline);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.appendOperation(new Operation(OpCode.BsplineSurface, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public appendGeometricPrimitive(gPrimitive: GeometricPrimitive): boolean {
    switch (gPrimitive.type) {
      case GeometryType.CurvePrimitive:
        return this.appendCurvePrimitive(gPrimitive.asCurvePrimitive!);
      case GeometryType.CurveCollection:
        return this.appendCurveCollection(gPrimitive.asCurveCollection!);
      case GeometryType.IndexedPolyface:
        return this.appendPolyface(gPrimitive.asIndexedPolyface!);
      case GeometryType.SolidPrimitive:
        return this.appendSolidPrimitive(gPrimitive.asSolidPrimitive!);
      case GeometryType.BsplineSurface:
        return this.appendBsplineSurface(gPrimitive.asBsplineSurface!);
      // case GeometryType.BRepEntity:
      // case GeometryType.TextString:
      default:
        return false;
    }
  }
  public dgnAppendRange3d(range: Range3d) {
    const fbb = new flatbuffers.Builder();
    const builder = DgnFB.PointPrimitive;
    builder.startPointPrimitive(fbb);

    builder.startCoordsVector(fbb, 2);
    fbb.addFloat64(range.high.z);
    fbb.addFloat64(range.high.y);
    fbb.addFloat64(range.high.x);
    fbb.addFloat64(range.low.z);
    fbb.addFloat64(range.low.y);
    fbb.addFloat64(range.low.x);
    const offset = fbb.endVector();
    builder.addCoords(fbb, offset);

    const mLoc = builder.endPointPrimitive(fbb);

    fbb.finish(mLoc);
    const arr = fbb.asUint8Array();
    this.appendOperation(new Operation(OpCode.SubGraphicRange, arr));
  }

  // public appendBRepEntity()
  // public appendDgnGeometryPart()
  // public appendTextString()
}

/** Internal op code reader that returns geometry based on given Operations (which hold their own buffer) */
export class OpCodeReader {

  /** Read the header. Return undefined if unsuccessful */
  public static getHeader(egOp: Operation): Uint8Array | undefined { return (OpCode.Header === egOp.opCode) ? egOp.data : undefined; }

  /** Store the read Point2d's in the array given, and return the boundary type. Return undefined if unsuccessful. */
  public getPoint2dArray(egOp: Operation, pts: Point2d[]): number | undefined {
    if (OpCode.PointPrimitive2d !== egOp.opCode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(egOp.data);
    const ppfb = DgnFB.PointPrimitive2d.getRootAsPointPrimitive2d(buffer);

    pts.length = 0;
    for (let i = 0; i < ppfb.coordsLength(); i++) {
      pts.push(Point2d.create(ppfb.coords(i)!.x(), ppfb.coords(i)!.y()));
    }

    return ppfb.boundary();
  }

  /** Store the read Point3d's in the array given, and return the boundary type. Return undefined if unsuccessful. */
  public getPoint3dArray(egOp: Operation, pts: Point3d[]): number | undefined {
    if (OpCode.PointPrimitive !== egOp.opCode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(egOp.data);
    const ppfb = DgnFB.PointPrimitive.getRootAsPointPrimitive(buffer);

    pts.length = 0;
    for (let i = 0; i < ppfb.coordsLength(); i++)
      pts.push(Point3d.create(ppfb.coords(i)!.x(), ppfb.coords(i)!.y(), ppfb.coords(i)!.z()));

    return ppfb.boundary();
  }

  /** Store the Arc3d read in the Arc3d given, and return the boundary type. Return undefined if unsuccessful. */
  public getArc3d(egOp: Operation, arc: Arc3d): number | undefined {
    if (OpCode.ArcPrimitive !== egOp.opCode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(egOp.data);
    const ppfb = DgnFB.ArcPrimitive.getRootAsArcPrimitive(buffer);

    const dCenter = ppfb.center();
    const center = Point3d.create(dCenter!.x(), dCenter!.y(), dCenter!.z());
    const dVector0 = ppfb.vector0();
    const vector0 = Vector3d.create(dVector0!.x(), dVector0!.y(), dVector0!.z());
    const dVector90 = ppfb.vector90();
    const vector90 = Vector3d.create(dVector90!.x(), dVector90!.y(), dVector90!.z());
    Arc3d.create(center, vector0, vector90, AngleSweep.createStartSweepRadians(ppfb.start(), ppfb.sweep()), arc);

    return ppfb.boundary();
  }

  /** Return the Range3d read. Return undefined if unsuccessful. */
  public getRange3d(egOp: Operation): Range3d | undefined {
    if (OpCode.SubGraphicRange !== egOp.opCode)
      return undefined;

    const buffer = new flatbuffers.ByteBuffer(egOp.data);
    const ppfb = DgnFB.PointPrimitive.getRootAsPointPrimitive(buffer);

    if (ppfb.coordsLength() !== 2)
      return undefined;

    const low = Point3d.create(ppfb.coords(0)!.x(), ppfb.coords(0)!.y(), ppfb.coords(0)!.z());
    const high = Point3d.create(ppfb.coords(1)!.x(), ppfb.coords(1)!.y(), ppfb.coords(1)!.z());

    return Range3d.create(low, high);
  }

  /** Return the CurvePrimitive read. Return undefined if unsuccessful. */
  public getCurvePrimitive(egOp: Operation): CurvePrimitive | undefined {
    if (OpCode.CurvePrimitive !== egOp.opCode)
      return undefined;

    // Check version signature
    if (!egOp.data1 || egOp.data.length !== BGFBBuilder.versionSignature.length)
      return undefined;
    for (let i = 0; i < egOp.data.length; i++)
      if (!(egOp.data[i] === BGFBBuilder.versionSignature[i]))
        return undefined;

    const curve = BGFBReader.readFB(egOp.data1);
    if (curve !== undefined && curve instanceof CurvePrimitive)
      return curve;
    return undefined;
  }

  /** Return the CurveVector read. Return undefined if unsuccessful. */
  public getCurveCollection(egOp: Operation): CurveCollection | undefined {
    if (OpCode.CurveCollection !== egOp.opCode)
      return undefined;

    // Check version signature
    if (!egOp.data1 || egOp.data.length !== BGFBBuilder.versionSignature.length)
      return undefined;
    for (let i = 0; i < egOp.data.length; i++)
      if (!(egOp.data[i] === BGFBBuilder.versionSignature[i]))
        return undefined;

    const curves = BGFBReader.readFB(egOp.data1);
    if (curves !== undefined && curves instanceof CurveCollection)
      return curves;
    return undefined;
  }

  /** Return the Polyface read. Return undefined if unsuccessful. */
  public getPolyface(egOp: Operation): IndexedPolyface | undefined {
    if (OpCode.Polyface !== egOp.opCode)
      return undefined;

    // Check version signature
    if (!egOp.data1 || egOp.data.length !== BGFBBuilder.versionSignature.length)
      return undefined;
    for (let i = 0; i < egOp.data.length; i++)
      if (!(egOp.data[i] === BGFBBuilder.versionSignature[i]))
        return undefined;

    const polyface = BGFBReader.readFB(egOp.data1);
    if (polyface !== undefined && polyface instanceof IndexedPolyface)
      return polyface;
    return undefined;
  }

  /** Return the SolidPrimitive read. Return undefined if unsuccessful. */
  public getSolidPrimitive(egOp: Operation): SolidPrimitive | undefined {
    if (OpCode.SolidPrimitive !== egOp.opCode)
      return undefined;

    // Check version signature
    if (!egOp.data1 || egOp.data.length !== BGFBBuilder.versionSignature.length)
      return undefined;
    for (let i = 0; i < egOp.data.length; i++)
      if (!(egOp.data[i] === BGFBBuilder.versionSignature[i]))
        return undefined;

    const solidPrimitive = BGFBReader.readFB(egOp.data1);
    if (solidPrimitive !== undefined && solidPrimitive instanceof SolidPrimitive)
      return solidPrimitive;
    return undefined;
  }

  /** Return the BsplineSurface read. Return undefined if unsuccessful. */
  public getBsplineSurface(egOp: Operation): BSplineSurface3d | undefined {
    if (OpCode.BsplineSurface !== egOp.opCode)
      return undefined;

    // Check version signature
    if (!egOp.data1 || egOp.data.length !== BGFBBuilder.versionSignature.length)
      return undefined;
    for (let i = 0; i < egOp.data.length; i++)
      if (!(egOp.data[i] === BGFBBuilder.versionSignature[i]))
        return undefined;

    const bspline = BGFBReader.readFB(egOp.data1);
    if (bspline !== undefined && bspline instanceof BSplineSurface3d)
      return bspline;
    return undefined;
  }

  // public getRepEntity

  // public getGeometryPart

  // public getGeometryParams

  // public getTextString

  /** Return the GeometricPrimitive read. Return undefined if unsuccessful. (May or may not use geometry-core serializers) */
  public getGeometricPrimitive(egOp: Operation): GeometricPrimitive | undefined {
    switch (egOp.opCode) {
      case OpCode.PointPrimitive2d: {
        const pts: Point2d[] = [];
        const boundary = this.getPoint2dArray(egOp, pts);
        if (boundary === undefined)
          break;

        const localPoints3dBuf: Point3d[] = [];
        for (const point of pts)
          localPoints3dBuf.push(Point3d.createFrom(point));

        switch (boundary) {
          case DgnFB.BoundaryType.None:
            /* NOTE: HAVE TO IMPLEMENT
            elemGeom = GeometricPrimitive.createCurvePrimitiveRef(CurvePrimitive.createPointString(localPoints3dBuf));
            break;
            */
            return undefined;
          case DgnFB.BoundaryType.Open:
            return GeometricPrimitive.createCurvePrimitiveRef(LineString3d.createPoints(localPoints3dBuf));
          case DgnFB.BoundaryType.Closed:
            return GeometricPrimitive.createCurveCollectionRef(Loop.create(LineString3d.createPoints(localPoints3dBuf)));
          default:
            return undefined;   // Should be impossible to hit...
        }
      }
      case OpCode.PointPrimitive: {
        const pts: Point3d[] = [];
        const boundary = this.getPoint3dArray(egOp, pts);
        if (boundary === undefined)
          break;

        switch (boundary) {
          case DgnFB.BoundaryType.None:
            /* NOTE: HAVE TO IMPLEMENT
            elemGeom = GeometricPrimitive.createCurvePrimitiveRef(CurvePrimitive.createPointString(localPoints3dBuf));
            break;
            */
            return undefined;
          case DgnFB.BoundaryType.Open:
            return GeometricPrimitive.createCurvePrimitiveRef(LineString3d.createPoints(pts));
          case DgnFB.BoundaryType.Closed:
            return GeometricPrimitive.createCurveCollectionRef(Loop.create(LineString3d.createPoints(pts)));
          default:
            return undefined;   // Should be impossible to hit...
        }
      }
      case OpCode.ArcPrimitive: {
        const arc: Arc3d = Arc3d.createUnitCircle();
        const boundary = this.getArc3d(egOp, arc);
        if (boundary === undefined)
          return undefined;

        switch (boundary) {
          case DgnFB.BoundaryType.None:
          case DgnFB.BoundaryType.Open:
            return GeometricPrimitive.createCurvePrimitiveRef(arc);
          case DgnFB.BoundaryType.Closed:
            return GeometricPrimitive.createCurveCollectionRef(Loop.create(arc));
          default:
            return undefined;   // Should be impossible to hit...
        }
      }
      case OpCode.CurvePrimitive: {
        const curve = this.getCurvePrimitive(egOp);
        if (!curve)
          return undefined;

        return GeometricPrimitive.createCurvePrimitiveRef(curve);
      }
      case OpCode.CurveCollection: {
        const curves = this.getCurveCollection(egOp);
        if (!curves)
          return undefined;

        return GeometricPrimitive.createCurveCollectionRef(curves);
      }
      case OpCode.Polyface: {
        const polyface = this.getPolyface(egOp);
        if (!polyface)
          return undefined;

        return GeometricPrimitive.createIndexedPolyfaceRef(polyface);
      }
      case OpCode.SolidPrimitive: {
        const solidPrimitive = this.getSolidPrimitive(egOp);
        if (!solidPrimitive)
          return undefined;

        return GeometricPrimitive.createSolidPrimitiveRef(solidPrimitive);
      }
      case OpCode.BsplineSurface: {
        const bspline = this.getBsplineSurface(egOp);
        if (!bspline)
          return undefined;

        return GeometricPrimitive.createBsplineSurfaceRef(bspline);
      }
      /*
      #if defined (BENTLEYCONFIG_PARASOLID)
        case GeometryStreamIO::OpCode::ParasolidBRep:
            {
            IBRepEntityPtr entityPtr;

            if (!Get(egOp, entityPtr))
                break;

            elemGeom = GeometricPrimitive::Create(entityPtr);
            return true;
            }
      #else
        case GeometryStreamIO::OpCode::BRepPolyface:
            {
            PolyfaceQueryCarrier meshData(0, false, 0, 0, nullptr, nullptr);

            if (!BentleyGeometryFlatBuffer::BytesToPolyfaceQueryCarrier(egOp.m_data, meshData))
                break;

            elemGeom = GeometricPrimitive::Create(meshData);
            return true;
            }
        case GeometryStreamIO::OpCode::BRepCurveVector:
            {
            CurveVectorPtr curvePtr = BentleyGeometryFlatBuffer::BytesToCurveVector(egOp.m_data);

            if (!curvePtr.IsValid())
                break;

            elemGeom = GeometricPrimitive::Create(curvePtr);
            return true;
            }
      #endif
      */
      // case OpCode.TextString:
    }
    return undefined;
  }

  /** Stores the read GeometricParams into the GeometricParams object given. If certain members read are not valid, preserves the old values.
   *  Returns true if the original elParams argument is changed
   */
  public getGeometryParams(egOp: Operation, elParams: GeometryParams): boolean {
    let changed = false;

    switch (egOp.opCode) {
      case OpCode.BasicSymbology: {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.BasicSymbology.getRootAsBasicSymbology(buffer);

        const subCategoryId = new Id64([ppfb.subCategoryId().low, ppfb.subCategoryId().high]);
        // Must preserve current category and reset to sub-category appearance
        elParams.resetAppearance();
        elParams.setSubCategoryId(subCategoryId);
        changed = true;

        if (ppfb.useColor()) {
          const lineColor = new ColorDef(ppfb.color());

          if (elParams.isLineColorFromSubCategoryAppearance() || (elParams.lineColor && !lineColor.equals(elParams.lineColor))) {
            elParams.setLineColor(lineColor);
            changed = true;
          }
        }

        if (ppfb.useWeight()) {
          const weight = ppfb.weight();

          if (elParams.isWeightFromSubCategoryAppearance() || weight !== elParams.weight) {
            elParams.setWeight(weight);
            changed = true;
          }
        }

        if (ppfb.useStyle()) {
          const styleId = new Id64([ppfb.lineStyleId().low, ppfb.lineStyleId().high]);

          if (elParams.isLineStyleFromSubCategoryAppearance() || !styleId.equals(elParams.lineStyle ? elParams.lineStyle.styleId : new Id64())) {
            if (styleId.isValid()) {
              const lsInfo = LineStyleInfo.create(styleId, undefined);
              elParams.setLineStyle(lsInfo);
            } else {
              elParams.setLineStyle(undefined);
            }
            changed = true;
          }
        }

        const transparency = ppfb.transparency();
        if (transparency !== elParams.transparency) {
          elParams.setTransparency(transparency);
          changed = true;
        }
        const displayPriority = ppfb.displayPriority();
        if (displayPriority !== elParams.displayPriority) {
          elParams.setDisplayPriority(displayPriority);
          changed = true;
        }
        const geomClass = ppfb.geomClass();
        if (geomClass !== elParams.geometryClass) {
          elParams.setGeometryClass(geomClass);
          changed = true;
        }

        break;
      }
      case OpCode.AreaFill: {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.AreaFill.getRootAsAreaFill(buffer);

        const fillDisplay = ppfb.fill();
        if (fillDisplay !== elParams.fillDisplay) {
          elParams.setFillDisplay(fillDisplay);
          changed = true;
        }

        if (fillDisplay !== DgnFB.FillDisplay.None) {
          const transparency = ppfb.transparency();
          const mode = ppfb.mode();

          if (transparency !== elParams.fillTransparency) {
            elParams.setFillTransparency(transparency);
            changed = true;
          }
          if (mode === DgnFB.GradientMode.None) {
            if (ppfb.useColor()) {
              const fillColor = new ColorDef(ppfb.color());
              if (elParams.isFillColorFromSubCategoryAppearance() || (elParams.fillColor && !fillColor.equals(elParams.fillColor))) {
                elParams.setFillColor(fillColor);
                changed = true;
              }
            } else if (ppfb.backgroundFill() !== 0) {
              const currBgFill = elParams.isFillColorFromViewBackground();
              const currOutline = elParams.isBackgroundFillOfTypeOutline();
              const useOutline = (2 === ppfb.backgroundFill());

              if (!currBgFill || useOutline !== currOutline) {
                elParams.setFillColorFromViewBackground(useOutline);
                changed = true;
              }
            }
          } else {
            const gradient = GradientSymb.createDefaults();
            gradient.setMode(mode);
            gradient.setFlags(ppfb.flags());
            gradient.setShift(ppfb.shift());
            gradient.setTint(ppfb.tint());
            gradient.setAngle(ppfb.angle());

            const colors = ppfb.colorsArray();
            const keyColors: ColorDef[] = [];
            const values = ppfb.valuesArray();
            const keyValues: number[] = [];

            if (colors)
              for (const color of colors)
                keyColors.push(new ColorDef(color));
            if (values)
              for (const value of values)
                keyValues.push(value);

            gradient.setKeys(keyColors.length, keyColors, keyValues);
            elParams.setGradient(gradient);
          }
        }
        break;
      }
      case OpCode.Pattern: {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.AreaPattern.getRootAsAreaPattern(buffer);
        const pattern = PatternParams.createDefaults();

        const origin = ppfb.origin();
        if (origin)
          pattern.setOrigin(Point3d.create(origin.x(), origin.y(), origin.z()));

        const rMatrix = ppfb.rotation();
        if (rMatrix) {
          pattern.setOrientation(RotMatrix.createRowValues(
            rMatrix.x00(), rMatrix.x01(), rMatrix.x02(),
            rMatrix.x10(), rMatrix.x11(), rMatrix.x12(),
            rMatrix.x20(), rMatrix.x21(), rMatrix.x22(),
          ));
        }

        pattern.setPrimarySpacing(ppfb.space1());
        pattern.setSecondarySpacing(ppfb.space2());
        pattern.setPrimaryAngle(ppfb.angle1());
        pattern.setSecondaryAngle(ppfb.angle2());
        pattern.setScale(ppfb.scale());

        if (ppfb.useColor())
          pattern.setColor(new ColorDef(ppfb.color()));

        if (ppfb.useWeight())
          pattern.setWeight(ppfb.weight());

        pattern.setInvisibleBoundary(ppfb.invisibleBoundary() ? true : false);
        pattern.setSnappable(ppfb.snappable() ? true : false);
        pattern.setSymbolId(new Id64([ppfb.symbolId().low, ppfb.symbolId().high]));

        const defLines: DwgHatchDefLine[] = [];
        const dwgHatchLen = ppfb.defLineLength();
        for (let i = 0; i < dwgHatchLen; i++) {
          const defLine = ppfb.defLine(i);
          if (!defLine)
            continue;
          const line = new DwgHatchDefLine();
          line.angle = defLine.angle();
          const through = defLine.through();
          if (through)
            line.through.setFrom(Point2d.create(through.x(), through.y()));
          const offset = defLine.offset();
          if (offset)
            line.offset.setFrom(Point2d.create(offset.x(), offset.y()));

          const dashArray = defLine.dashesArray();
          if (defLine.dashesLength() !== 0 && dashArray) {
            for (const value of dashArray) {
              line.dashes.push(value);
            }
          }

          defLines.push(line);
        }
        pattern.setDwgHatchDef(defLines);

        if (elParams.patternParams === undefined || !elParams.patternParams.isEqualTo(pattern)) {
          elParams.setPatternParams(pattern);
          changed = true;
        }
        break;
      }
      case OpCode.Material: {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.Material.getRootAsMaterial(buffer);

        if (ppfb.useMaterial()) {
          const material = new Id64([ppfb.materialId().low, ppfb.materialId().high]);

          if (elParams.isMaterialFromSubCategoryAppearance() || (elParams.materialId && !material.equals(elParams.materialId))) {
            elParams.setMaterialId(material);
            changed = true;
          }
        }
        break;
      }
      case OpCode.LineStyleModifiers: {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.LineStyleModifiers.getRootAsLineStyleModifiers(buffer);

        let styleId: Id64;
        const currentLsInfo = elParams.lineStyle;
        if (currentLsInfo)
          styleId = currentLsInfo.styleId;
        else
          styleId = new Id64();

        const styleParams = LineStyleParams.createDefaults();
        styleParams.modifiers = ppfb.modifiers();
        styleParams.scale = ppfb.scale();
        styleParams.dashScale = ppfb.dashScale();
        styleParams.gapScale = ppfb.gapScale();
        styleParams.startWidth = ppfb.startWidth();
        styleParams.endWidth = ppfb.endWidth();
        styleParams.distPhase = ppfb.distPhase();
        styleParams.fractPhase = ppfb.fractPhase();
        const normal = ppfb.normal();
        if (normal)
          styleParams.normal = Vector3d.create(normal.x(), normal.y(), normal.z());
        const ypr = YawPitchRollAngles.createDegrees(ppfb.yaw(), ppfb.pitch(), ppfb.roll());
        styleParams.rMatrix = ypr.toRotMatrix();

        const lsInfo = LineStyleInfo.create(styleId, styleParams);
        elParams.setLineStyle(lsInfo);
        changed = true;
        break;
      }
      default:
        return false;
    }
    return changed;
  }
}

/** Iterator used by the reader in iterating over the operations contained within a buffer. Holds its own shallow copy of the entire buffer, but only allows access
 *  to the last operation found.
 */
export class OpCodeIterator {
  private data: Uint8Array | undefined;   // Pointer to the Uint8Array in the writer
  private dataOffset: number; // Our current position in the data array (always points to the index of an opCode)
  private egOp?: Operation;    // The data stored in the last block

  public get operation() { return this.egOp; }
  public get isValid() { return this.data !== undefined; }

  public constructor(data: ArrayBuffer, dataOffset: number = 0) {
    this.data = new Uint8Array(data);
    this.dataOffset = dataOffset;
    this.toNext();
  }

  private toNext(): boolean | undefined {
    if (this.data === undefined || this.dataOffset >= this.data.length) {
      this.data = undefined;
      this.dataOffset = 0;
      return undefined;
    }

    // Grab the opcode, data size, and data (store in the Operation member)
    const data32 = new Uint32Array(this.data!.buffer);
    const index0 = this.dataOffset / 4;
    const dataSize = data32[index0 + 1];
    const opSize = dataSize + 8;

    // Assign to either data or.. data AND data1 in operation based on whether a signature is needed (Will be using geometry-core serializers)
    switch (data32[index0]) {
      case OpCode.CurvePrimitive:
      case OpCode.CurveCollection:
      case OpCode.Polyface:
      case OpCode.SolidPrimitive:
      case OpCode.BsplineSurface:
      case OpCode.BRepPolyface:
      case OpCode.BRepCurveVector:
        this.egOp = new Operation(data32[index0], this.data!.slice(this.dataOffset + 8, this.dataOffset + 16), this.data!.slice(this.dataOffset + 16, this.dataOffset + opSize));
        break;
      default:
        this.egOp = new Operation(data32[index0], this.data!.slice(this.dataOffset + 8, this.dataOffset + opSize));
        break;
    }

    // Move to the next block
    this.dataOffset += opSize;

    return true;
  }

  public nextOp(): Operation | undefined {
    if (this.toNext())
      return this.egOp;
    return undefined;
  }

  public equalTo(itr: OpCodeIterator): boolean {
    return this.dataOffset === itr.dataOffset;
  }

//  public get geometryParams() { return this.state.geomParams; }   // Returns GeometryParams for current GeometricPrimitive...
//  public get geometryPartId() { return this.state.geomStreamEntryId!.geometryPartId; }   // Returns invalid id if not a DgnGeometryPart reference...
//  public get geometryStreamEntryId() { return this.state.geomStreamEntryId; }   // Returns primitive id for current GeometricPrimitive...
//  public get subgraphicLocalRange() { return this.state.localRange; }   // Returns local range for geometry that was appended with GeometryBuilder.SetAppendAsSubGraphics enabled
//  public get sourceToWorld() { return this.state.sourceToWorld; }
//  public get geometryToSource() { return this.state.geomToSource; }
//  public get geometryToWorld() {
//    this.state.geomToWorld.setMultiplyTransformTransform(this.state.sourceToWorld, this.state.geomToSource);
//    return this.state.geomToWorld;
//  }
//  public getGeometry(): GeometricPrimitive | undefined {
//    const gsReader = new OpCodeReader();
//    const result = gsReader.getGeometricPrimitive(this.egOp!);
//    if (!result)
//      return undefined;
//    this.state.geometry = result;
//    return this.state.geometry;
//  }

  /** Returns true if this offset is equal to the given iterator's offset */
  public isEqualOffset(other: OpCodeIterator): boolean {
    return this.dataOffset === other.dataOffset;
  }

  /** Iterate a GeometryStream for a GeometryPart in the context of a parent GeometricElement iterator.
   *  When iterating a GeometricElement that has GeometryPart id references, this allows iteration of the GeometryPart's
   *  GeometryStream using the instance specific GeometryParams and part geometry to world transform as established by the parent GeometrySource.
   */
//  public setNestedIteratorContext(collection: OpCodeIterator) {
//    this.state.geomParams = collection.state.geomParams!.clone();
//    this.state.geomStreamEntryId = collection.state.geomStreamEntryId!.clone();
//    this.state.sourceToWorld = collection.state.sourceToWorld.clone();
//    this.state.geomToSource = collection.state.geomToSource.clone();
//  }
}

/** Class for identifying a geometric primitive in a GeometryStream */
export class GeometryStreamEntryId {
  private _partId: Id64;      // Valid when index refers to a part
  private _index: number;     // Index into top-level GeometryStream
  private _partIndex: number; // Index into part GeometryStream

  public constructor() {
    this._partId = new Id64();
    this._index = 0;
    this._partIndex = 0;
  }

  public get index() { return this._index; }
  public get partIndex() { return this._partIndex; }
  public get geometryPartId() { return this._partId; }
  public isValid() { return this._index !== 0; }
  public increment() { if (this._partId.isValid()) this.incrementPartIndex(); else this.incrementIndex(); }
  public incrementIndex() { if (65535 === this._index) return; this._index++; } // More than 65535 geometric entries in a single GeometryStream is questionable...
  public incrementPartIndex() { if (65535 === this._partIndex) return; this._partIndex++; }
  public setGeometryPartId(partId: Id64) { this._partId = partId; }
  public setIndex(index: number) { this._index = index; }
  public setPartIndex(partIndex: number) { this._index = partIndex; }
  public setActive(enable: boolean) {
    if (this._partId.isValid()) {
      if (!enable) this._partId = new Id64();
      return;
    }
    this._partId = new Id64();
    this._index = 0;
    this._partIndex = 0;
  }
  public setActiveGeometryPart(partId: Id64) {
    this._partId = new Id64(partId);
  }

  public clone(): GeometryStreamEntryId {
    const retVal = new GeometryStreamEntryId();
    retVal._partId = new Id64(this._partId);
    retVal._index = this._index;
    retVal._partIndex = this._partIndex;
    return retVal;
  }
}

// class CurrentState {
//   public geomParams?: GeometryParams;
//   public sourceToWorld: Transform;
//   public geomToSource: Transform;
//   public geomToWorld: Transform;
//   public geometry?: GeometricPrimitive;
//   public geomStreamEntryId?: GeometryStreamEntryId;
//   public localRange: Range3d;

//   public constructor() {
//     this.sourceToWorld = Transform.createIdentity();
//     this.geomToSource = Transform.createIdentity();
//     this.geomToWorld = Transform.createIdentity();
//     this.localRange = Range3d.createNull();
//   }
// }

export enum GeomCoordSystem {
  Local = 0,  // <-- GeometricPrimitive being supplied in local coordinates. @note Builder must be created with a known placement for local coordinates to be meaningful.
  World = 1,  // <-- GeometricPrimitive being supplied in world coordinates. @note Builder requires world coordinate geometry when placement isn't specified up front.
}

// ==============================================================================================================================================
// ==============================================================================================================================================

// =======================================================================================
// ! GeometryBuilder provides methods for setting up an element's GeometryStream and Placement2d or Placement3d.
// ! The GeometryStream stores one or more GeometricPrimitive and optional GeometryParam for a GeometricElement.
// ! An element's geometry should always be stored relative to its placement. As the placement defines the
// ! element to world transform, an element can be moved/rotated by just updating it's placement.
// !
// ! GeometryBuilder supports several approaches to facilitate creating a placement relative GeometryStream.
// ! Consider a 10m line from 5,5,0 to 15,5,0 where we want the placement origin to be the line's start point.
// !
// ! Approach 1: Construct a builder with the desired placement and then add the geometry in local coordinates.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! builder->Finish(source);
// ! \endcode
// !
// ! Approach 2: Construct a builder with the desired placement and then add the geometry in world coordinates.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::From(5.0, 5.0, 0.0), DPoint3d::From(15.0, 5.0, 0.0))), GeometryBuilder::CoordSystem::World);
// ! builder->Finish(source);
// ! \endcode
// !
// ! Approach 3: Construct a builder with identity placement, add the geometry in local coordinates, then update the element's placement.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::FromZero());
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! builder->Finish(source);
// ! Placement3d placement = source.ToGeometrySource3d()->GetPlacement(); // Finish updated placement's ElementAlignedBox3d
// ! placement.GetOriginR() = DPoint3d::From(5.0, 5.0, 0.0);
// ! source.ToGeometrySource3dP()->SetPlacement(placement);
// ! \endcode
// !
// ! Approach 4: Construct a builder without specifying any placement, add the geometry in world coordinates, and let the builder choose a placement.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::CreateWithAutoPlacement(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! builder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::From(5.0, 5.0, 0.0), DPoint3d::From(15.0, 5.0, 0.0))), GeometryBuilder::CoordSystem::World);
// ! builder->Finish(source);
// ! \endcode
// !
// ! @note It is NEVER correct to construct a builder with an identity placement and then proceed to add geometry in world coordinates.
// !       The resulting element won't have a meaningful placement.
// !       To keep the example code snippets more compact it was assumed that all operations are successful. Be aware however
// !       that trying to create a builder with invalid input (ex. 2d model and 3d placement) will return nullptr.
// !       An append call may also return false for un-supported geometry (ex. trying to append a cone to 2d builder).
// !
// ! GeometryBuilder also provides a mechanism for sharing repeated geometry, both within a single element, as well as between elements.
// ! GeometryBuilder can be used to define a DgnGeometryPart, and then instead of appending one or more GeometricPrimitive to a builder for a GeometricElement,
// ! you can instead append the DgnGeometryPartId to reference the shared geometry and position it relative to the GeometricElement's placement.
// !
// ! A DgnGeometryPart is always defined in it's un-rotated orientation and positioned relative to 0,0,0. The GeometryStream for a DgnGeometryPart can
// ! not include sub-category changes. A part may include specific symbology, otherwise it inherits the symbology established by the referencing GeometryStream.
// ! As an example, let's instead create our 10m line from above as a DgnGeometryPart. We will then use this part to create a "+" symbol by appending 4 instances.
// !
// ! Construct a builder to create a new DgnGeometryPart having already checked that it doesn't already exist.
// ! \code
// ! GeometryBuilderPtr partBuilder = GeometryBuilder::CreateGeometryPart(imodel, is3d);
// ! partBuilder->Append(*ICurvePrimitive::CreateLine(DSegment3d::From(DPoint3d::FromZero(), DPoint3d::From(10.0, 0.0, 0.0))));
// ! DgnGeometryPartPtr geomPart = DgnGeometryPart::Create(imodel, partCode); // The DgnCode for the part is important for finding an existing part
// ! if (SUCCESS == partBuilder->Finish(*geomPart)) imodel.Elements().Insert<DgnGeometryPart>(*geomPart); // Finish and Insert part
// ! \endcode
// !
// ! Construct a builder to create a new GeometricElement using an existing DgnGeometryPart.
// ! \code
// ! GeometryBuilderPtr builder = GeometryBuilder::Create(model, category, DPoint3d::From(5.0, 5.0, 0.0));
// ! DgnGeometryPartId partId = DgnGeometryPart::QueryGeometryPartId(partCode, imodel); // Find existing part by code, check partId.IsValid()
// ! builder->Append(partId, DPoint3d::FromZero());
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(90.0, 0.0, 0.0));
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(180.0, 0.0, 0.0));
// ! builder->Append(partId, DPoint3d::FromZero(), YawPitchRollAngles::FromDegrees(270.0, 0.0, 0.0));
// ! builder->Finish(source);
// ! \endcode
// !
// ! @note If performance/memory is the only consideration, it's not worth creating a DgnGeometryPart for very simple geometry such as a single line or cone.
// !
// ! @ingroup GROUP_Geometry
// =======================================================================================
export class GeometryStreamBuilder {
  private appearanceChanged = false;
  private appearanceModified = false;
  private appendAsSubGraphics = false;
  /** Whether builder Placement2d or Placement3d has been set */
  public havePlacement = false;
  /** Whether builder is creating a GeometryPart or GeometricElement */
  public isPartCreate = false;
  /** Whether builder is creating a 2d or 3d GeometryStream */
  public is3d = false;
  /** Current Placement3d as of last call to Append when creating a 3d GeometryStream */
  public readonly placement3d = new Placement3d(Point3d.createZero(), YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0), new ElementAlignedBox3d());
  /** Current Placement2d as of last call to Append when creating a 2d GeometryStream */
  public readonly placement2d = new Placement2d(Point2d.createZero(), Angle.createDegrees(0.0), new ElementAlignedBox2d());
  /** Current GeometryParams as of last call to Append */
  public geometryParams = new GeometryParams(new Id64());
  private geometryParamsModified: GeometryParams | undefined;
  private writer = new OpCodeWriter();

  /** Current size (in bytes) of the GeometryStream being constructed */
  public get currentSize() { return this.writer.size; }
  /** Enable option so that subsequent calls to Append a GeometricPrimitive produce sub-graphics with local ranges to optimize picking/range testing. Not valid when creating a part */
  public setAppendAsSubGraphics() { this.appendAsSubGraphics = !this.isPartCreate; }
  /** Get the raw ArrayBuffer from the current writer. Note that this is a reference to the ArrayBuffer and not a clone. */
  public getRawData(): ArrayBuffer { return this.writer.rawData; }
  /** Get a GeometryStream whose buffer's bytes are a direct reference to the current writer's */
  public getGeometryStreamRef(): GeometryStream { return this.writer.getGeometryStreamRef(); }
  /** Get a GeometryStream whose buffer's bytes are a deep copy of the current writer's */
  public getGeometryStreamClone(): GeometryStream { return this.writer.getGeometryStreamClone(); }

  private constructor(categoryId: Id64, is3d: boolean) {
    this.isPartCreate = !categoryId.isValid();
    this.is3d = is3d;
    this.geometryParams.setCategoryId(categoryId);
  }

  private static fromPlacement2d(categoryId: Id64, placement: Placement2d): GeometryStreamBuilder {
    const retVal = new GeometryStreamBuilder(categoryId, false);
    retVal.placement2d.setFrom(placement);
    retVal.placement2d.bbox.setNull();  // Throw away pre-existing bounding box
    retVal.havePlacement = true;
    return retVal;
  }

  private static fromPlacement3d(categoryId: Id64, placement: Placement3d): GeometryStreamBuilder {
    const retVal = new GeometryStreamBuilder(categoryId, true);
    retVal.placement3d.setFrom(placement);
    retVal.placement3d.bbox.setNull();  // Throw away pre-existing bounding box
    retVal.havePlacement = true;
    return retVal;
  }

  /** Create builder from model, categoryId, and placement as represented by a transform.
   *  NOTE: Transform must satisfy requirements of YawPitchRollAngles.TryFromTransform; scale is not supported
   */
  public static fromTransform(categoryId: Id64, transform: Transform, is3d: boolean): GeometryStreamBuilder | undefined {
    if (!categoryId.isValid())
      return undefined;

    const origin = transform.getOrigin();
    const rMatrix = transform.matrix;
    const angles = YawPitchRollAngles.createDegrees(0, 0, 0);
    const retVal = YawPitchRollAngles.createFromRotMatrix(rMatrix, angles);

    // NOTE: YawPitchRollAngles::TryFromRotMatrix compares against Angle::SmallAngle, which after
    //       consulting with Earlin is too strict for our purposes and shouldn't be considered a failure.
    if (!retVal) {
      const resultMatrix = angles.toRotMatrix();

      if (rMatrix.maxDiff(resultMatrix) > 1.0e-5)
        return undefined;
    }

    if (is3d) {
      const placement3d = new Placement3d(origin, angles, new ElementAlignedBox3d());
      return GeometryStreamBuilder.fromPlacement3d(/* model */ categoryId, placement3d);
    }

    if (origin.z !== 0 || angles.pitch.degrees !== 0 || angles.roll.degrees !== 0)
      return undefined;

    const placement2d = new Placement2d(Point2d.create(origin.x, origin.y), angles.yaw, new ElementAlignedBox2d());
    return GeometryStreamBuilder.fromPlacement2d(categoryId, placement2d);
  }

  /** Create 3d builder from model, categoryId, origin, and optional YawPitchRollAngles */
  public static fromCategoryIdAndOrigin3d(categoryId: Id64, origin: Point3d, angles?: YawPitchRollAngles): GeometryStreamBuilder | undefined {
    if (!categoryId.isValid())
      return undefined;

    if (!angles)
      angles = YawPitchRollAngles.createDegrees(0, 0, 0);

    const placement = new Placement3d(origin, angles, new ElementAlignedBox3d());
    return GeometryStreamBuilder.fromPlacement3d(/* imodel, */ categoryId, placement);
  }

  /** Create 3d builder from model, categoryId, origin, and optional rotation Angle */
  public static fromCategoryIdAndOrigin2d(categoryId: Id64, origin: Point2d, angle?: Angle): GeometryStreamBuilder | undefined {
    if (!categoryId.isValid())
      return undefined;

    if (!angle)
      angle = Angle.createDegrees(0);

    const placement = new Placement2d(origin, angle, new ElementAlignedBox2d());
    return GeometryStreamBuilder.fromPlacement2d(/* model */ categoryId, placement);
  }

  /** Create a GeometryPart builder for defining a new part that will contain a group of either 2d or 3d GeometricPrimitive */
  public static from3d(is3d: boolean): GeometryStreamBuilder {
    // Note: Part geometry is always specified in local coords, i.e. has identity placement.
    //       Category isn't needed when creating a part, invalid category will be used to set isPartCreate
    return new GeometryStreamBuilder(new Id64(), is3d);
  }

  private appendWorld(geom: GeometricPrimitive): boolean {
    if (!this.convertToLocal(geom))
      return false;
    return this.appendLocal(geom);
  }

  private convertToLocal(geom: GeometricPrimitive): boolean {
    if (this.isPartCreate)
      return false;   // Part geometry must be supplied in local coordinates...

    let localToWorld = Transform.createIdentity();
    const transformParams = !this.havePlacement;

    if (transformParams) {
      if (!geom.getLocalCoordinateFrame(localToWorld))
        return false;

      const origin = localToWorld.getTranslation();
      const rMatrix = localToWorld.matrix;
      const angles = YawPitchRollAngles.createFromRotMatrix(rMatrix);
      if (!angles)
        return false;

      if (this.is3d) {
        this.placement3d.origin.setFrom(origin);
        this.placement3d.angles.setFrom(angles);
      } else {
        if (origin.z !== 0.0)
          return false;
        if (0.0 !== angles.pitch.degrees || 0.0 !== angles.roll.degrees) {
          const tmpAngles = YawPitchRollAngles.createDegrees(0.0, angles.pitch.degrees, angles.roll.degrees);
          localToWorld.multiplyTransformTransform(Transform.createOriginAndMatrix(Point3d.create(), tmpAngles.toRotMatrix()), localToWorld);
        }
        this.placement2d.origin = Point2d.create();
        this.placement3d.angles = angles;
      }

      this.havePlacement = true;
    } else if (this.is3d) {
      localToWorld = this.placement3d.getTransform();
    } else {
      localToWorld = this.placement2d.getTransform();
    }

    if (localToWorld.isIdentity())
      return true;

    const worldToLocal = localToWorld.inverse();
    if (!worldToLocal)
      return false;
    // Note: Apply world-to-local to GeometryParams for auto-placement data supplied in world coords...
    if (transformParams && this.geometryParams.isTransformable())
      this.geometryParams.applyTransform(worldToLocal);

    return geom.tryTransformInPlace(worldToLocal);
  }

  private appendLocal(geom: GeometricPrimitive): boolean {
    if (!this.havePlacement) {
      return false;   // Placement must already be defined...
    }

    const localRange = geom.getRange();
    if (!localRange)
      return false;

    let opCode: OpCode;

    switch (geom.type) {
      case GeometryType.CurvePrimitive:
        opCode = OpCode.CurvePrimitive;
        break;
      case GeometryType.CurveCollection:
        opCode = geom.asCurveCollection!.isAnyRegionType() ? OpCode.CurveCollection : OpCode.CurvePrimitive;
        break;
      case GeometryType.SolidPrimitive:
        opCode = OpCode.SolidPrimitive;
        break;
      case GeometryType.BsplineSurface:
        opCode = OpCode.BsplineSurface;
        break;
      case GeometryType.IndexedPolyface:
        opCode = OpCode.Polyface;
        break;
      case GeometryType.BRepEntity:
        opCode = OpCode.ParasolidBRep;
        break;
      case GeometryType.TextString:
        opCode = OpCode.TextString;
        break;
      default:
        opCode = OpCode.Invalid;
        break;
    }

    this.onNewGeom(localRange, this.appendAsSubGraphics, opCode);
    return this.writer.appendSimplifiedGeometricPrimitive(geom, this.is3d);
  }
  private onNewGeom(localRange: Range3d, isSubGraphic: boolean, opCode: OpCode) {
    // NOTE: range to include line style width. Maybe this should be removed when/if we start doing locate from mesh tiles...
    if (this.geometryParams.categoryId.isValid()) {
      const lsInfo = this.geometryParams.lineStyle;

      if (lsInfo !== undefined) {
        const maxWidth = lsInfo.lStyleSymb.styleWidth;

        localRange.low.x -= maxWidth;
        localRange.low.y -= maxWidth;
        localRange.high.x += maxWidth;
        localRange.high.y += maxWidth;

        if (this.is3d) {
          localRange.low.z -= maxWidth;
          localRange.high.z += maxWidth;
        }
      }
    }

    if (this.is3d) {
      this.placement3d.bbox.extendRange(localRange);
    } else {
      this.placement2d.bbox.extendPoint(Point2d.create(localRange.low.x, localRange.low.y));
      this.placement2d.bbox.extendPoint(Point2d.create(localRange.high.x, localRange.high.y));
    }

    let allowPatGradnt = false;
    let allowSolidFill = false;
    let allowLineStyle = false;
    let allowMaterial = false;

    switch (opCode) {
      case OpCode.GeometryPartInstance:
        allowSolidFill = allowPatGradnt = allowLineStyle = allowMaterial = true;    // Don't reject anything
        break;
      case OpCode.CurvePrimitive:
        allowLineStyle = true;
        break;
      case OpCode.CurveCollection:
        allowSolidFill = allowPatGradnt = allowLineStyle = allowMaterial = true;
        break;
      case OpCode.Polyface:
        allowSolidFill = allowMaterial = true;
        break;
      case OpCode.SolidPrimitive:
      case OpCode.BsplineSurface:
        // case Parasolid:
        allowMaterial = true;
        break;
    }

    let hasInvalidPatGradnt = false;
    let hasInvalidSolidFill = false;
    let hasInvalidLineStyle = false;
    let hasInvalidMaterial = false;

    if (!allowPatGradnt || !allowSolidFill || !allowLineStyle || !allowMaterial) {
      if (DgnFB.FillDisplay.None !== this.geometryParams.fillDisplay) {
        if (this.geometryParams.gradient !== undefined) {
          if (!allowPatGradnt)
            hasInvalidPatGradnt = true;
        } else {
          if (!allowSolidFill)
            hasInvalidSolidFill = true;
        }
      }

      if (!allowPatGradnt && this.geometryParams.patternParams !== undefined)
        hasInvalidPatGradnt = true;
      if (!allowLineStyle && !this.geometryParams.isLineStyleFromSubCategoryAppearance() && this.geometryParams.hasStrokedLineStyle())
        hasInvalidLineStyle = true;
      if (!allowMaterial && !this.geometryParams.isMaterialFromSubCategoryAppearance() && this.geometryParams.materialId && this.geometryParams.materialId.isValid())
        hasInvalidMaterial = true;
    }

    if (hasInvalidPatGradnt || hasInvalidSolidFill || hasInvalidLineStyle || hasInvalidMaterial) {
      // NOTE: We won't change m_elParams in case some caller is doing something like appending a single symbology
      //       that includes fill, and then adding a series of open and closed elements expecting the open elements
      //       to ignore the fill.
      const localParams = this.geometryParams.clone();

      if (hasInvalidPatGradnt) {
        localParams.setGradient(undefined);
        localParams.setPatternParams(undefined);
      }
      if (hasInvalidSolidFill || hasInvalidPatGradnt)
        localParams.setFillDisplay(DgnFB.FillDisplay.None);
      if (hasInvalidLineStyle)
        localParams.setLineStyle(undefined);
      if (hasInvalidMaterial)
        localParams.setMaterialId(new Id64());
      if (!this.appearanceModified || (this.geometryParamsModified && !this.geometryParamsModified.isEqualTo(localParams))) {
        this.geometryParamsModified = localParams;
        this.writer.appendGeometryParams(this.geometryParamsModified, this.isPartCreate, this.is3d);
        this.appearanceChanged = this.appearanceModified = true;
      }
    } else if (this.appearanceChanged) {
      this.writer.appendGeometryParams(this.geometryParams, this.isPartCreate, this.is3d);
      this.appearanceChanged = this.appearanceModified = false;
    }

    if (isSubGraphic && !this.isPartCreate)
      this.writer.dgnAppendRange3d(localRange);
  }

  /** RESETS THE BUILDER. All mod boolean values are set to false, placement is set to origin, if GeometryParams exists, is set to default, and the
   *  writer is cleared to contain 0 bytes.
   */
  public reset() {
    this.appearanceChanged = false;
    this.appearanceModified = false;
    this.isPartCreate = false;
    this.appendAsSubGraphics = false;
    if (this.is3d)
      this.placement3d.setFrom(new Placement3d(Point3d.createZero(), YawPitchRollAngles.createDegrees(0.0, 0.0, 0.0), new ElementAlignedBox3d()));
    else
      this.placement2d.setFrom(new Placement2d(Point2d.createZero(), Angle.createDegrees(0.0), new ElementAlignedBox2d()));
    this.geometryParams = new GeometryParams(this.geometryParams.categoryId, this.geometryParams.subCategoryId);
    this.geometryParamsModified = undefined;
    this.writer.reset();
  }

  /** Set GeometryParams by SubCategoryId - Appearance. Any subsequent Append of a GeometricPrimitive will display using this symbology.
   *  NOTE - If no symbology is specifically set in a GeometryStream, the GeometricPrimitive display uses the default SubCategoryId for the GeometricElement's CategoryId.
   */
  public appendSubCategoryId(subCategoryId: Id64): boolean {
    const elParams = new GeometryParams(this.geometryParams.categoryId, subCategoryId); // Preserve current category...
    return this.appendGeometryParams(elParams);
  }

  /** Set symbology by supplying a fully qualified GeometryParams. Any subsequent Append of a GeometricPrimitive will display using this symbology.
   *  NOTE: If no symbology is specifically set in a GeometryStream, the GeometricPrimitive display uses the default SubCategoryId for the GeometricElement's
   *  CategoryId. World vs. local affects PatternParams and LineStyleInfo that need to store an orientation and other "placement" relative info.
   */
  public appendGeometryParams(elParams: GeometryParams, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    // NOTE: Allow explicit symbology in GeometryPart's GeometryStream, sub-category won't be persisted
    if (!this.isPartCreate) {
      if (!this.geometryParams.categoryId.isValid())
        return false;
      if (!elParams.categoryId.equals(this.geometryParams.categoryId))
        return false;
      /*
        if (elParams.GetCategoryId() != DgnSubCategory::QueryCategoryId(m_dgnDb, elParams.GetSubCategoryId()))
            return false;
        }
       */
    }
    if (elParams.isTransformable()) {
      if (coord === GeomCoordSystem.World) {
        if (this.isPartCreate)
          return false;   // Part GeometryParams must be supplied in local coordinates...

        // Note: Must defer applying transform until placement is computed from first geometric primitive...
        if (this.havePlacement) {
          const localToWorld = (this.is3d ? this.placement3d.getTransform() : this.placement2d.getTransform());
          const worldToLocal = localToWorld.inverse();
          if (!worldToLocal)
            return false;

          if (!worldToLocal.isIdentity()) {
            const localParams = elParams.clone();
            localParams.applyTransform(worldToLocal);
            return this.appendGeometryParams(localParams, GeomCoordSystem.Local);
          }
        }
      } else {
        if (!this.havePlacement)
          return false;   // Caller can't supply local coordinates if we don't know what local is yet...
      }
    }

    if (this.geometryParams.isEqualTo(elParams))
      return true;

    this.geometryParams = elParams.clone();
    this.appearanceChanged = true;   // Defer append until we actually have some geometry...
    return true;
  }

  /** Append a GeometryPartId with relative placement supplied as a Transform, and a range representing the Part range rather than performing a query.
   *  NOTE - Builder must be created with a known placement for relative location to be meaningful. Can't be called when creating a GeometryPart;
   *  nested parts are not supported.
   */
  public appendPartUsingTransformRange(geomPartId: Id64, geomToElement: Transform, localRange: Range3d): boolean {
    if (this.isPartCreate)
      return false;   // Nested parts are not supported...

    if (!this.havePlacement)
      return false;   // geomToElement must be relative to an already defined placement (i.e. not computed placement from CreateWorld)...

    const partRange = localRange.clone();

    if (!geomToElement.isIdentity())
      geomToElement.multiplyRange(partRange, partRange);

    this.onNewGeom(partRange, false, OpCode.GeometryPartInstance);    // Parts are already handled as sub-graphics
    return this.writer.dgnAppendGeometryPartId(geomPartId, geomToElement);
  }

  /**
   * Append a GeometryPartId with relative placement supplied as a DPoint3d and optional YawPitchRollAngles.
   * @note Builder must be created with a known placement for relative location to be meaningful.
   * Can't be called when creating a DgnGeometryPart, nested parts are not supported.
   */
  /*
  public appendPartUsingOriginYawPitchRollAngles(geomPartId: Id64, origin: Point3d, angles: YawPitchRollAngles): boolean {
    const geomToElementRot = angles.toRotMatrix();
    const geomToElement = Transform.createOriginAndMatrix(origin, geomToElementRot);
    return this.appendPartUsingTransform(geomPartId, geomToElement);
  }
  */

  /** Append a GeometryPartId with relative placement supplied as a Point2d and optional AngleInDegrees rotation.
   * @note Builder must be created with a known placement for relative location to be meaningful.
   * Can't be called when creating a DgnGeometryPart, nested parts are not supported.
   */
  /*
  public appendPartUsingOriginAngle(geomPartId: Id64, origin: Point2d, angle: Angle): boolean {

  }
  */

  /** Append GeometricPrimitive to the builder in either local or world coordinates. */
  public appendGeometricPrimitive(geom: GeometricPrimitive, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (!this.is3d && geom.is3dGeometryType())
      return false;   // 3d only geometry

    if (coord === GeomCoordSystem.Local)
      return this.appendLocal(geom);

    const clone = geom.clone();

    return this.appendWorld(clone);
  }

  /** Append a CurvePrimitive to builder in either local or world coordinates. */
  public appendCurvePrimitive(geom: CurvePrimitive, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (coord === GeomCoordSystem.Local) {
      const localRange = Range3d.createNull();
      geom.extendRange(localRange);

      if (localRange.isNull())
        return false;

      this.onNewGeom(localRange, this.appendAsSubGraphics, OpCode.CurvePrimitive);
      return this.writer.appendSimplifiedCurvePrimitive(geom, false, this.is3d);
    }

    const wrappedGeom = GeometricPrimitive.createCurvePrimitiveClone(geom);
    return this.appendWorld(wrappedGeom);
  }

  /** Append a CurveCollection to builder in either local or world coordinates. */
  public appendCurveCollection(geom: CurveCollection, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (coord === GeomCoordSystem.Local) {
      const localRange = Range3d.createNull();
      geom.extendRange(localRange);

      if (localRange.isNull())
        return false;

      this.onNewGeom(localRange, this.appendAsSubGraphics, geom.isAnyRegionType() ? OpCode.CurveCollection : OpCode.CurvePrimitive);
      return this.writer.appendSimplifiedCurveCollection(geom, this.is3d);
    }

    const wrappedGeom = GeometricPrimitive.createCurveCollectionClone(geom);
    return this.appendWorld(wrappedGeom);
  }

  /** Append a SolidPrimitive to builder in either local or world coordinates.
   *  NOTE: Only valid with a 3d builder
   */
  public appendSolidPrimitive(geom: SolidPrimitive, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (!this.is3d)
      return false;   // 3d only geometry

    if (coord === GeomCoordSystem.Local) {
      const localRange = Range3d.createNull();
      geom.extendRange(localRange);

      if (localRange.isNull())
        return false;

      this.onNewGeom(localRange, this.appendAsSubGraphics, OpCode.SolidPrimitive);
      return this.writer.appendSolidPrimitive(geom);
    }

    const wrappedGeom = GeometricPrimitive.createSolidPrimitiveClone(geom);
    return this.appendWorld(wrappedGeom);
  }

  /** Append a BsplineSurface3d to builder in either local or world coordinates.
   *  NOTE: Only valid with 3d builder
   */
  public appendBsplineSurface(geom: BSplineSurface3d, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (!this.is3d)
      return false;   // only 3d geometry

    if (coord === GeomCoordSystem.Local) {
      const localRange = Range3d.createNull();
      geom.extendRange(localRange);

      if (localRange.isNull())
        return false;

      this.onNewGeom(localRange, this.appendAsSubGraphics, OpCode.BsplineSurface);
      return this.writer.appendBsplineSurface(geom);
    }

    const wrappedGeom = GeometricPrimitive.createBsplineSurfaceClone(geom);
    return this.appendWorld(wrappedGeom);
  }

  /** Append an IndexedPolyface to builder in either local or world coordinates.
   *  NOTE: Only valid with 3d builder
   */
  public appendPolyface(geom: IndexedPolyface, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (!this.is3d)
      return false;   // 3d only geometry

    if (coord === GeomCoordSystem.Local) {
      const localRange = Range3d.createNull();
      geom.extendRange(localRange);

      if (localRange.isNull())
        return false;

      this.onNewGeom(localRange, this.appendAsSubGraphics, OpCode.Polyface);
      return this.writer.appendPolyface(geom);
    }

    const wrappedGeom = GeometricPrimitive.createIndexedPolyfaceClone(geom);
    return this.appendWorld(wrappedGeom);
  }

  // public appendBRepEntity

  /** Append a non-specific geometry, passed using the encompassing GeometryQuery abstract class. */
  public appendGeometryQuery(geometry: GeometryQuery, coord: GeomCoordSystem = GeomCoordSystem.Local): boolean {
    if (geometry instanceof CurvePrimitive)
      return this.appendCurvePrimitive(geometry, coord);
    if (geometry instanceof CurveCollection)
      return this.appendCurveCollection(geometry, coord);
    if (geometry instanceof IndexedPolyface)
      return this.appendPolyface(geometry, coord);
    if (geometry instanceof SolidPrimitive)
      return this.appendSolidPrimitive(geometry, coord);
    if (geometry instanceof BSplineSurface3d)
      return this.appendBsplineSurface(geometry, coord);
    return false;
  }

  // public appendTextString
  // public appendTextAnnotation
}
