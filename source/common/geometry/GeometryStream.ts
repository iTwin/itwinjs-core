/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Vector3d, Transform, Range3d, YawPitchRollAngles, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { CurveCollection, Loop } from "@bentley/geometry-core/lib/curve/CurveChain";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { CurvePrimitive } from "@bentley/geometry-core/lib/curve/CurvePrimitive";
import { SolidPrimitive } from "@bentley/geometry-core/lib/solid/SolidPrimitive";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { LineSegment3d } from "@bentley/geometry-core/lib/curve/LineSegment3d";
import { LineString3d } from "@bentley/geometry-core/lib/curve/LineString3d";
import { BGFBBuilder, BGFBReader } from "@bentley/geometry-core/lib/serialization/BGFB";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { GeometricPrimitive, GeometryType } from "./ElementGeometry";
import { GeometryParams } from "./GeometryProps";
import { LineStyleInfo, LineStyleParams } from "./LineStyle";
import { GradientSymb } from "./GradientPattern";
import { PatternParams, DwgHatchDefLine } from "./AreaPattern";
import { ColorDef } from "../Render";
import { IModel } from "../IModel";
import { flatbuffers } from "flatbuffers";
import { DgnFB } from "./ElementGraphicsSchema";
import { Base64 } from "js-base64";

export enum OpCode {
  Invalid                 = 0,
  Header                  = 1,    // Required to be first opcode
  SubGraphicRange         = 2,    // Local range of next geometric primitive
  GeometryPartInstance    = 3,    // Draw referenced geometry part
  BasicSymbology          = 4,    // Set symbology for subsequent geometry that doesn't follow subCategory appearance
  PointPrimitive          = 5,    // Simple lines, line strings, shapes, point strings, etc.
  PointPrimitive2d        = 6,    // Simple 2d lines, line strings, shapes, point strings, etc.
  ArcPrimitive            = 7,    // Single arc/ellipse
  CurveCollection         = 8,    // CurveCollection
  Polyface                = 9,    // PolyfaceQueryCarrier
  CurvePrimitive          = 10,   // Single CurvePrimitive
  SolidPrimitive          = 11,   // SolidPrimitive
  BsplineSurface          = 12,   // BSpline surface
  AreaFill                = 19,   // Opaque and gradient fills
  Pattern                 = 20,   // Hatch, cross-hatch, and area pattern
  Material                = 21,   // Render material
  TextString              = 22,   // TextString (single-line/single-format run of characters)
  LineStyleModifiers      = 23,   // Specifies line style overrides to populate a LineStyleParams structure
  ParasolidBRep           = 25,   // Parasolid body
  BRepPolyface            = 26,   // Polyface from Parasolid solid or sheet body (needed until we have Parasolid support on all platforms)
  BRepCurveVector         = 27,   // CurveVector from Parasolid wire or planar sheet body (needed until we have Parasolid support on all platforms)
  Image                   = 28,   // Small single-tile raster image
}

export enum EntryType {
  Unknown             = 0,  // Invalid
  GeometryPart        = 1,  // DgnGeometryPart reference
  CurvePrimitive      = 2,  // A single open curve
  CurveVector         = 3,  // Open paths, planar regions, and unstructured curve collections
  SolidPrimitive      = 4,  // ISolidPrimitive
  BsplineSurface      = 5,  // MSBSplineSurface
  Polyface            = 6,  // Polyface
  BRepEntity          = 7,  // BRepEntity
  TextString          = 8,  // TextString
  ImageGraphic        = 9,  // ImageGraphic
}

/** Internal 64 bit header op code, used by the GSWriter. First index (32 bits) holds version, and indices 5, 6, 7, 8 holds the flags */
class Header {
  public buffer: Uint32Array;
  // this.buffer[0] === version
  // this.buffer[1] === flags

  public constructor(version: number = 1, flags: number = 0) {
    this.buffer = new Uint32Array([version, flags]);
  }
}

/** Internal op code */
export class Operation {
  public opCode: number;
  // If signature is included, the signature will be held in data, and flatbuffer contents in data1, otherwise, all data lies in data
  public data: Uint8Array;
  public data1: Uint8Array | undefined;
  public data1Position: number;

  private constructor(opCode: OpCode, data: Uint8Array, data1?: Uint8Array, data1Position?: number) {
    this.opCode = opCode;
    this.data = data;
    if (data1) {
      this.data1 = data1;
      this.data1Position = data1Position!;    // Should always come together
    }
  }

  /** Creates a new operation, typically then used to append to a writer. If using the geometry-core BGFB builder, the signature is placed
   *  in data, and then the Uint8Array of the geometry data is placed in data1, followed by the position returned by the BGFB builder
   */
  public static createNewItem(opCode: OpCode, data: Uint8Array, data1?: Uint8Array, data1Position?: number): Operation {
    return new Operation(opCode, data, data1, data1Position);
  }
}

class CurrentState {
  public imodel: IModel;
  public geomParams: GeometryParams;
  public sourceToWorld: Transform;
  public geomToSource: Transform;
  public geomToWorld: Transform;
  public geometry: GeometricPrimitive;
  public geomStreamEntryId: any;
  public localRange: Range3d;

  public constructor(imodel: IModel) {
    this.imodel = imodel;
    this.sourceToWorld = Transform.createIdentity();
    this.geomToSource = Transform.createIdentity();
    this.geomToWorld = Transform.createIdentity();
    this.localRange = Range3d.createNull();
  }
}

/** Iterator used by the reader in iterating over the operations contained within a buffer. Holds its own shallow copy of the entire buffer, but only allows access
 *  to the last operation found.
 */
export class Iterator {
  private data: Uint8Array | undefined;   // Pointer to the Uint8Array in the writer
  private dataOffset: number; // Our current position in the data array (always points to the index of an opCode)
  private egOp: Operation;    // The data stored in the last block
  private state: CurrentState;  // Current state of the data (not yet in use)

  public get operation() { return this.egOp; }

  private constructor(data: ArrayBuffer, dataOffset: number) {
    this.data = new Uint8Array(data);
    this.dataOffset = dataOffset;
  }

  public static create(data: ArrayBuffer, dataOffset: number = 0): Iterator {
    const iter = new Iterator(data, dataOffset);
    iter.toNext();
    return iter;
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
        this.egOp = Operation.createNewItem(data32[index0], this.data!.slice(this.dataOffset + 8, this.dataOffset + 16),
          this.data!.slice(this.dataOffset + 16, this.dataOffset + opSize));
        break;
      default:
        this.egOp = Operation.createNewItem(data32[index0], this.data!.slice(this.dataOffset + 8, this.dataOffset + opSize));
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

  public equalTo(itr: Iterator): boolean {
    return this.dataOffset === itr.dataOffset;
  }

  public get imodel() { return this.state.imodel; }   // imodel used to create collector...
  public get geometryParams() { return this.state.geomParams; }   // Returns GeometryParams for current GeometricPrimitive...
  public get geometryPartId() { return this.state.geomStreamEntryId.geometryPartId; }   // Returns invalid id if not a DgnGeometryPart reference...
  public get geometryStreamEntryId() { return this.state.geomStreamEntryId; }   // Returns primitive id for current GeometricPrimitive...
  public get subgraphicLocalRange() { return this.state.localRange; }   // Returns local range for geometry that was appended with GeometryBuilder.SetAppendAsSubGraphics enabled
  // public get geometryPartRef() {}
  // public get geometryPartCRef() {}
  public get sourceToWorld() { return this.state.sourceToWorld; }
  public get geometryToSource() { return this.state.geomToSource; }
  public get geometryToWorld() {
    this.state.geomToWorld.setMultiplyTransformTransform(this.state.sourceToWorld, this.state.geomToSource);
    return this.state.geomToWorld;
  }
  public getGeometry(): GeometricPrimitive | undefined {
    const gsReader = new GSReader(this.state.imodel);
    const result = gsReader.dgnGetGeometricPrimitive(this.egOp);
    if (!result)
      return undefined;
    this.state.geometry = result;
    return this.state.geometry;
  }
  public getEntryType() {   // check geometry type to avoid creating GeometricPrimitive for undesired types
    switch (this.egOp.opCode) {
      case OpCode.GeometryPartInstance:
      {
        return EntryType.GeometryPart;
      }
      case OpCode.PointPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive.getRootAsPointPrimitive(buffer);
        return (DgnFB.BoundaryType.Closed === ppfb.boundary()) ? EntryType.CurveVector : EntryType.CurvePrimitive;
      }
      case OpCode.PointPrimitive2d:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive2d.getRootAsPointPrimitive2d(buffer);
        return (DgnFB.BoundaryType.Closed === ppfb.boundary()) ? EntryType.CurveVector : EntryType.CurvePrimitive;
      }
      case OpCode.ArcPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.ArcPrimitive.getRootAsArcPrimitive(buffer);
        return (DgnFB.BoundaryType.Closed === ppfb.boundary()) ? EntryType.CurveVector : EntryType.CurvePrimitive;
      }
      case OpCode.CurvePrimitive:
        return EntryType.CurvePrimitive;
      case OpCode.CurveCollection:
        return EntryType.CurveVector;
      case OpCode.Polyface:
        return EntryType.Polyface;
      case OpCode.SolidPrimitive:
        return EntryType.SolidPrimitive;
      case OpCode.BsplineSurface:
        return EntryType.BsplineSurface;
      case OpCode.ParasolidBRep:
        return EntryType.BRepEntity;
      case OpCode.BRepPolyface:
        return EntryType.Polyface;
      case OpCode.BRepCurveVector:
        return EntryType.CurveVector;
      case OpCode.TextString:
        return EntryType.TextString;
      case OpCode.Image:
        return EntryType.ImageGraphic;
      default:
        return EntryType.Unknown;
    }
  }

  public isCurve() {    // open and unstructured curves check that avoids creating GeometricPrimitive when possible
    switch (this.egOp.opCode) {
      case OpCode.PointPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive.getRootAsPointPrimitive(buffer);
        return DgnFB.BoundaryType.Open === ppfb.boundary();
      }
      case OpCode.PointPrimitive2d:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive2d.getRootAsPointPrimitive2d(buffer);
        return DgnFB.BoundaryType.Open === ppfb.boundary();
      }
      case OpCode.ArcPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.ArcPrimitive.getRootAsArcPrimitive(buffer);
        return DgnFB.BoundaryType.Open === ppfb.boundary();
      }
      case OpCode.CurvePrimitive:
      {
        return true;   // Should never be a point string or closed bcurve....
      }
      case OpCode.CurveCollection:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && !geom.asCurveCollection.isAnyRegionType());   // Accept "none" boundary type
      }
      default:
        return false;
    }
  }

  public isSurface() {    // closed curve, planar region, surface, and open mesh check that avoids creating GeometricPrimitive when possible
    switch (this.egOp.opCode) {
      case OpCode.PointPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive.getRootAsPointPrimitive(buffer);
        return DgnFB.BoundaryType.Closed === ppfb.boundary();
      }
      case OpCode.PointPrimitive2d:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.PointPrimitive2d.getRootAsPointPrimitive2d(buffer);
        return DgnFB.BoundaryType.Closed === ppfb.boundary();
      }
      case OpCode.ArcPrimitive:
      {
        const buffer = new flatbuffers.ByteBuffer(this.egOp.data);
        const ppfb = DgnFB.ArcPrimitive.getRootAsArcPrimitive(buffer);
        return DgnFB.BoundaryType.Closed === ppfb.boundary();
      }
      case OpCode.CurvePrimitive:
        return false;   // Should never be a point string or closed bcurve....
      case OpCode.CurveCollection:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && geom.asCurveCollection.isAnyRegionType());
      }
      case OpCode.SolidPrimitive:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && !geom.asSolidPrimitive.getCapped());
      }
      case OpCode.Polyface:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && !geom.asIndexedPolyface.isClosedByEdgePairing());
      }
      case OpCode.BsplineSurface:
        return true;
      /*
      #if defined (BENTLEYCONFIG_PARASOLID)
        case GeometryStreamIO::OpCode::ParasolidBRep:
            {
            auto ppfb = flatbuffers::GetRoot<FB::BRepData>(m_egOp.m_data);

            return (IBRepEntity::EntityType::Sheet == ((IBRepEntity::EntityType) ppfb->brepType()));
            }
      #else
        case GeometryStreamIO::OpCode::BRepPolyface:
            {
            GeometricPrimitivePtr geom = GetGeometryPtr();

            return (geom.IsValid() && !geom->GetAsPolyfaceHeader()->IsClosedByEdgePairing());
            }

        case GeometryStreamIO::OpCode::BRepCurveVector:
            {
            GeometricPrimitivePtr geom = GetGeometryPtr();

            return (geom.IsValid() && geom->GetAsCurveVector()->IsAnyRegionType());
            }
      #endif
      */
      default:
        return false;
    }
  }

  public isSolid() {    // solid and volumetric mesh check that avoids creating GeometricPrimitive when possible
    switch (this.egOp.opCode) {
      case OpCode.SolidPrimitive:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && geom.asSolidPrimitive.getCapped());
      }
      case OpCode.Polyface:
      {
        const geom = this.getGeometry();
        return (geom !== undefined && geom.asIndexedPolyface.isClosedByEdgePairing());
      }
      /*
      #if defined (BENTLEYCONFIG_PARASOLID)
        case GeometryStreamIO::OpCode::ParasolidBRep:
            {
            auto ppfb = flatbuffers::GetRoot<FB::BRepData>(m_egOp.m_data);

            return (IBRepEntity::EntityType::Solid == ((IBRepEntity::EntityType) ppfb->brepType()));
            }
      #else
        case GeometryStreamIO::OpCode::BRepPolyface:
            {
            GeometricPrimitivePtr geom = GetGeometryPtr();

            return (geom.IsValid() && geom->GetAsPolyfaceHeader()->IsClosedByEdgePairing());
            }
      #endif
      */
      default:
        return false;
    }
  }
}

// ========================================================================================================================================================
// GEOMETRYSTREAM CLASSES =================================================================================================================================
/** Wrapper class for the buffer */
export class GeometryStream {
  public geomStream: ArrayBuffer;
  public constructor(stream: ArrayBuffer) { this.geomStream = stream; }

  public toJSON(): any {
    let tmpString = "";
    const view = new Uint16Array(this.geomStream);
    for (const c of view)
      tmpString += String.fromCharCode(c);
    return Base64.encode(tmpString);
  }

  /** return false if this GeometryStream is empty. */
  public hasGeometry(): boolean { return this.geomStream.byteLength !== 0; }

  public static fromJSON(json?: any): GeometryStream | undefined {
    if (json) {
      if (json instanceof GeometryStream) {
        return new GeometryStream(json.geomStream);
      } else {  // Should be given as an encoded string
        const decodedString = Base64.decode(json);
        const stringLen = decodedString.length;
        const arrBuff = new ArrayBuffer(stringLen * 2);
        const view = new Uint16Array(arrBuff);
        for (let i = 0; i < stringLen; i++)
          view[i] = decodedString.charCodeAt(i);
        return new GeometryStream(arrBuff);
      }
    }
    return undefined;
  }
}

/** Internal op code writer and temporary storage for the buffer */
export class GSWriter {
  public imodel: IModel;
  private buffer: ArrayBuffer;

  public constructor(imodel?: IModel) {
    if (imodel)
      this.imodel = imodel;
    this.buffer = new ArrayBuffer(0);   // Start out empty
  }

  /** Wraps the buffer in a GeometryStream object and returns */
  public finish() {
    return new GeometryStream(this.buffer);
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

  public appendHeader(flags: number = 0) {
    const header = new Header(1, flags);
    this.dgnAppendOperation(Operation.createNewItem(OpCode.Header, new Uint8Array(header.buffer.buffer)));
  }

  /** Allows for the possibility of 2-D curvature */
  public dgnAppendCurvePrimitive(cPrimitive: CurvePrimitive, isClosed: boolean, is3d: boolean): boolean {
    if (!is3d)
      return false;   // Should never not be 3d point..

    if (cPrimitive instanceof LineSegment3d) {
      /*
      if (hasDisconnectPoint(segment->point, 2))
        return false;
      */
      const localPoints3dBuf: Point3d[] = [cPrimitive.point0Ref, cPrimitive.point1Ref];
      this.dgnAppendPoint3dArray(localPoints3dBuf, DgnFB.BoundaryType.Open);
      return true;
    }

    if (cPrimitive instanceof LineString3d) {
      /*
      if (hasDisconnectPoint(&points->front(), points->size()))
        return false;
      */

      const points: Point3d[] = cPrimitive.points;

      this.dgnAppendPoint3dArray(points, isClosed ? DgnFB.BoundaryType.Closed : DgnFB.BoundaryType.Open);
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

    this.gcAppendCurvePrimitive(cPrimitive);
    return true;
  }

  public dgnAppendCurveCollection(collection: CurveCollection, is3d: boolean): boolean {
    if (!collection.children)
      return false;

    if (collection.children.length === 1 && collection.children[0] instanceof CurvePrimitive) {
      const cPrimitive = collection.children[0];
      if (cPrimitive instanceof LineSegment3d /* || cPrimitive instanceof PointString */)
        return this.dgnAppendCurvePrimitive(cPrimitive, false, is3d);  // never closed...
      if (cPrimitive instanceof LineString3d || cPrimitive instanceof Arc3d)
        return this.dgnAppendCurvePrimitive(cPrimitive, cPrimitive.startPoint().isExactEqual(cPrimitive.endPoint()), is3d);
    }
    // Not a simple case: may need to loop through array of children or navigate down curve tree
    // Skip check for invalidCurveCollection... not dealing with pointer based arrays or disconnect points
    this.gcAppendCurveCollection(collection);
    return true;
  }

  public dgnAppendGeometricPrimitive(gPrimitive: GeometricPrimitive, is3d: boolean): boolean {
    switch (gPrimitive.type) {
      case GeometryType.CurvePrimitive:
        return this.dgnAppendCurvePrimitive(gPrimitive.asCurvePrimitive, false, is3d);
      case GeometryType.CurveCollection:
        return this.dgnAppendCurveCollection(gPrimitive.asCurveCollection, is3d);
      case GeometryType.IndexedPolyface:
        return this.gcAppendPolyface(gPrimitive.asIndexedPolyface);
      case GeometryType.SolidPrimitive:
        return this.gcAppendSolidPrimitive(gPrimitive.asSolidPrimitive);
      case GeometryType.BsplineSurface:
        return this.gcAppendBsplineSurface(gPrimitive.asBsplineSurface);
      // case GeometryType.BRepEntity:
      // case GeometryType.TextString:
      // case GeometryType.Image:
      default:
        return false;
    }
  }

  public dgnAppendOperation(egOp: Operation) {
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

  public dgnAppendGeometryParams(elParams: GeometryParams, ignoreSubCategory: boolean, is3d: boolean) {
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
      basicSymbBuilder.addTransparency(fbb, elParams.transparency!);
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
      this.dgnAppendOperation(Operation.createNewItem(OpCode.BasicSymbology, fbb.asUint8Array()));
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
      this.dgnAppendOperation(Operation.createNewItem(OpCode.BasicSymbology, fbb.asUint8Array()));
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
      this.dgnAppendOperation(Operation.createNewItem(OpCode.LineStyleModifiers, fbb.asUint8Array()));
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

      this.dgnAppendOperation(Operation.createNewItem(OpCode.AreaFill, fbb.asUint8Array()));
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
      this.dgnAppendOperation(Operation.createNewItem(OpCode.Pattern, fbb.asUint8Array()));
    }

    // NEEDSWORK_WIP_MATERIAL - Not sure what we need to store per-geometry...
    //                          I assume we'll still need optional uv settings even when using sub-category material.
    //                          So we need a way to check for that case as we can't call GetMaterial
    //                          when !useMaterial because GeometryParams::Resolve hasn't been called...
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
      this.dgnAppendOperation(Operation.createNewItem(OpCode.Material, fbb.asUint8Array()));
    }
  }

  /** Packs an array of point2d into an array, with the boundary type, then wraps it in an operation and appends as a uInt8Array block */
  public dgnAppendPoint2dArray(points: Point2d[], boundary: number) {
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
    this.dgnAppendOperation(Operation.createNewItem(OpCode.PointPrimitive2d, arr));
  }

  public dgnAppendPoint3dArray(points: Point3d[], boundary: number) {
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
    this.dgnAppendOperation(Operation.createNewItem(OpCode.PointPrimitive, arr));
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
    this.dgnAppendOperation(Operation.createNewItem(OpCode.ArcPrimitive, arr));
  }

  public gcAppendCurvePrimitive(cPrimitive: CurvePrimitive): boolean {
    const buffer = BGFBBuilder.createFB(cPrimitive);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.dgnAppendOperation(Operation.createNewItem(OpCode.CurvePrimitive, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public gcAppendCurveCollection(collection: CurveCollection, opCode: OpCode = OpCode.CurveCollection): boolean {
    const buffer = BGFBBuilder.createFB(collection);
    if (!buffer)
      return false;

    if (buffer.bytes().length === 0)
      return false;

    this.dgnAppendOperation(Operation.createNewItem(opCode, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public gcAppendPolyface(polyface: IndexedPolyface, opCode: OpCode = OpCode.Polyface): boolean {
    const buffer = BGFBBuilder.createFB(polyface);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.dgnAppendOperation(Operation.createNewItem(opCode, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public gcAppendSolidPrimitive(sPrimitive: SolidPrimitive): boolean {
    const buffer = BGFBBuilder.createFB(sPrimitive);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.dgnAppendOperation(Operation.createNewItem(OpCode.SolidPrimitive, BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
  }

  public gcAppendBsplineSurface(bspline: BSplineSurface3d): boolean {
    const buffer = BGFBBuilder.createFB(bspline);
    if (!buffer)
      return false;

    if (0 === buffer.bytes().length)
      return false;

    this.dgnAppendOperation(Operation.createNewItem(OpCode.BsplineSurface,  BGFBBuilder.versionSignature, buffer.bytes(), buffer.position()));
    return true;
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
    this.dgnAppendOperation(Operation.createNewItem(OpCode.SubGraphicRange, arr));
  }

  // public appendBRepEntity()

  // public appendDgnGeometryPart()

  // public appendTextString()

  // public appendImageGraphic()
}

/** Reader class that returns geometry based on given Operations (which hold their own buffer) */
export class GSReader {
  public imodel: IModel;
  public iterator: Iterator;    // Will be used to parse a GeometryStream, while the reader itself takes care of the data decoding

  public constructor(imodel?: IModel) {
    if (imodel)
      this.imodel = imodel;
  }

  /** Read the header. Return undefined if unsuccessful */
  public static getHeader(egOp: Operation): Uint8Array | undefined { return (OpCode.Header === egOp.opCode) ? egOp.data : undefined; }

  /** Store the read Point2d's in the array given, and return the boundary type. Return undefined if unsuccessful. */
  public dgnGetPoint2dArray(egOp: Operation, pts: Point2d[]): number | undefined {
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
  public dgnGetPoint3dArray(egOp: Operation, pts: Point3d[]): number | undefined {
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
  public dgnGetArc3d(egOp: Operation, arc: Arc3d): number | undefined {
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
  public dgnGetRange3d(egOp: Operation): Range3d | undefined {
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
  public gcGetCurvePrimitive(egOp: Operation): CurvePrimitive | undefined {
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
  public gcGetCurveCollection(egOp: Operation): CurveCollection | undefined {
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
  public gcGetPolyface(egOp: Operation): IndexedPolyface | undefined {
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
  public gcGetSolidPrimitive(egOp: Operation): SolidPrimitive | undefined {
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
  public gcGetBsplineSurface(egOp: Operation): BSplineSurface3d | undefined {
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

  // public getImageGraphic

  /** Return the GeometricPrimitive read. Return undefined if unsuccessful. (May or may not use geometry-core serializers) */
  public dgnGetGeometricPrimitive(egOp: Operation): GeometricPrimitive | undefined {
    switch (egOp.opCode) {
      case OpCode.PointPrimitive2d:
      {
        const pts: Point2d[] = [];
        const boundary = this.dgnGetPoint2dArray(egOp, pts);
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
      case OpCode.PointPrimitive:
      {
        const pts: Point3d[] = [];
        const boundary = this.dgnGetPoint3dArray(egOp, pts);
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
      case OpCode.ArcPrimitive:
      {
        const arc: Arc3d = Arc3d.createUnitCircle();
        const boundary = this.dgnGetArc3d(egOp, arc);
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
      case OpCode.CurvePrimitive:
      {
        const curve = this.gcGetCurvePrimitive(egOp);
        if (!curve)
          return undefined;

        return GeometricPrimitive.createCurvePrimitiveRef(curve);
      }
      case OpCode.CurveCollection:
      {
        const curves = this.gcGetCurveCollection(egOp);
        if (!curves)
          return undefined;

        return GeometricPrimitive.createCurveCollectionRef(curves);
      }
      case OpCode.Polyface:
      {
        const polyface = this.gcGetPolyface(egOp);
        if (!polyface)
          return undefined;

        return GeometricPrimitive.createIndexedPolyfaceRef(polyface);
      }
      case OpCode.SolidPrimitive:
      {
        const solidPrimitive = this.gcGetSolidPrimitive(egOp);
        if (!solidPrimitive)
          return undefined;

        return GeometricPrimitive.createSolidPrimitiveRef(solidPrimitive);
      }
      case OpCode.BsplineSurface:
      {
        const bspline = this.gcGetBsplineSurface(egOp);
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
  public dgnGetGeometryParams(egOp: Operation, elParams: GeometryParams): boolean {
    let changed = false;

    switch (egOp.opCode) {
      case OpCode.BasicSymbology:
      {
        // !!!!!!!!!!!!!!!!!
        // NOTE: In the original native implementation, there were extra checks to check for the validity of the Id members, resolving them through the use of queries
        // otherwise. These checks are temporarily skipped, and we now enforce that whatever was originally stored to be returned in the same manner.

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
      case OpCode.AreaFill:
      {
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
      case OpCode.Pattern:
      {
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
            line.through = Point2d.create(through.x(), through.y());
          const offset = defLine.offset();
          if (offset)
            line.offset = Point2d.create(offset.x(), offset.y());

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
      case OpCode.Material:
      {
        const buffer = new flatbuffers.ByteBuffer(egOp.data);
        const ppfb = DgnFB.Material.getRootAsMaterial(buffer);

        // NEEDSWORK_WIP_MATERIAL - Set geometry specific material settings of GeometryParams...
        if (ppfb.useMaterial()) {
          const material = new Id64([ppfb.materialId().low, ppfb.materialId().high]);

          if (elParams.isMaterialFromSubCategoryAppearance() || (elParams.materialId && !material.equals(elParams.materialId))) {
            elParams.setMaterialId(material);
            changed = true;
          }
        }
        break;
      }
      case OpCode.LineStyleModifiers:
      {
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
