/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { Arc3d } from "../curve/Arc3d";
import { CurveLocationDetail, CurveLocationDetailPair } from "../curve/CurveLocationDetail";
import { GeometryQuery } from "../curve/GeometryQuery";
import { CurveChainWireOffsetContext } from "../curve/internalContexts/PolygonOffsetContext";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { Geometry } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { UVSurface } from "../geometry3d/GeometryHandler";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { Range2d, Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedPolyface, Polyface } from "../polyface/Polyface";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { BentleyGeometryFlatBuffer } from "../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../serialization/IModelJsonSchema";
import { prettyPrint } from "./testFunctions";

// Methods (called from other files in the test suite) for doing I/O of tests files.
export class GeometryCoreTestIO {
  /** For debugging: set to true to enable output to console via wrapped methods. */
  public static enableConsole: boolean = false;
  /** For debugging: set to true to enable saveGeometry output. */
  public static enableSave: boolean = false;
  /** For debugging: set to true to also run longer tests */
  public static enableLongTests: boolean = false;
  /** For debugging: the location of json files output by saveGeometry. */
  public static outputRootDirectory = "./src/test/output";
  /** Wrapper for console.log */
  public static consoleLog(message?: any, ...optionalParams: any[]): void {
    if (this.enableConsole)
      console.log(message, ...optionalParams); // eslint-disable-line no-console
  }
  /** Wrapper for console.log -- bypasses enableConsole */
  public static consoleLogGo(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams); // eslint-disable-line no-console
  }
  /** Wrapper for console.time */
  public static consoleTime(label?: string): void {
    if (!this.enableConsole)
      return;
    console.time(label);  // eslint-disable-line no-console
  }
  /** Wrapper for console.timeEnd */
  public static consoleTimeEnd(label?: string): void {
    if (!this.enableConsole)
      return;
    console.timeEnd(label); // eslint-disable-line no-console
  }
  public static makeOutputDir(subDirectoryName?: string): string {
    let path = GeometryCoreTestIO.outputRootDirectory;
    if (!fs.existsSync(path))
      fs.mkdirSync(path);
    if (subDirectoryName !== undefined) {
      path = `${path}/${subDirectoryName}`;
      if (!fs.existsSync(path))
        fs.mkdirSync(path);
    }
    return path;
  }
  /** Output geometry as json for debugging */
  public static saveGeometry(geometry: any, directoryName: string | undefined, fileName: string) {
    if (!this.enableSave)
      return;

    const path = this.makeOutputDir(directoryName);
    let fullPath = `${path}/${fileName}`;
    if (fileName.search(`\\.imjs$`) === -1)   // tricky: escape the escape char for the regex
      fullPath = `${fullPath}.imjs`;

    this.consoleLog(`saveGeometry:: ${fullPath}`);

    const imjs = IModelJson.Writer.toIModelJson(geometry);
    fs.writeFileSync(fullPath, prettyPrint(imjs));
  }
  /** For each property of data: save the value in a file name `${propertyName}.json` */
  public static savePropertiesAsSeparateFiles(directoryName: string | undefined, data: { [key: string]: any }) {
    if (!GeometryCoreTestIO.enableSave)
      return;
    const path = this.makeOutputDir(directoryName);
    for (const property in data) {
      if (data.hasOwnProperty(property)) {
        const filename = `${path}/${property}.imjs`;
        fs.writeFileSync(filename, JSON.stringify(data[property])); // prettyPrint(data[property]));
      }
    }
  }

  // write bytes to binary file
  public static writeBytesToFile(bytes: Uint8Array, fullFilePath: string) {
    if (!this.enableSave)
      return;
    fs.writeFileSync(fullFilePath, bytes, { encoding: "binary" });
  }

  // read bytes from binary file
  public static readBytesFromFile(fullPathName: string): Uint8Array | undefined {
    const buf = fs.readFileSync(fullPathName);
    return buf.length > 0 ? new Uint8Array(buf) : undefined;
  }

  // write bytes to text file (like native GTestFileOps::WriteByteArrayToTextFile)
  public static writeByteArrayToTextFile(bytes: Uint8Array, directoryName?: string, nameB?: string, nameC?: string, extension?: string) {
    if (!this.enableSave)
      return;
    let filename = this.makeOutputDir(directoryName);
    if (nameB)
      filename = filename.concat(`/${nameB}`);
    if (nameC)
      filename = filename.concat(`/${nameC}`);
    if (extension)
      filename = filename.concat(`.${extension}`);

    const maxBytesOnLine = 120;
    let bytesOnLine = 0;

    let text: string = "";
    text = text.concat("[\n");
    for (let i = 0; i < bytes.length; ++i) {
      const byte = bytes[i];
      const byteStr = `${byte}`;
      const newBytes = byteStr.length;
      if (newBytes + 1 + bytesOnLine > maxBytesOnLine) {
        text = text.concat("\n");
        bytesOnLine = 0;
      }
      text = text.concat(byteStr);
      if (i + 1 !== bytes.length)
        text = text.concat(",");
      bytesOnLine += newBytes + 1;
    }
    text = text.concat("]\n");
    fs.writeFileSync(filename, text);
  }

  /**
   * Append the geometry to the collection, e.g., for output by saveGeometry.
   * Also try to move the geometry by dx,dy,dz.
   */
  public static captureGeometry(
    collection: GeometryQuery[],
    newGeometry: GeometryQuery | GeometryQuery[] | undefined,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (!newGeometry)
      return;
    if (newGeometry instanceof GeometryQuery) {
      if (Geometry.hypotenuseSquaredXYZ(dx, dy, dz) !== 0)
        newGeometry.tryTranslateInPlace(dx, dy, dz);
      collection.push(newGeometry);
      return;
    }
    if (Array.isArray(newGeometry)) {
      for (const g of newGeometry)
        this.captureGeometry(collection, g, dx, dy, dz);
    }
  }
  /** Create and capture a loop object from a (single) sequence of points . */
  public static createAndCaptureLoop(
    collection: GeometryQuery[],
    points: IndexedXYZCollection | Point3d[] | undefined,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (!points || points.length === 0)
      return;
    if (points.length <= 2) {
      // const linestring = LineString3d.create(points);
      // this.createAndCaptureXYMarker(collection, 0, linestring.packedPoints.getPoint3dArray(), dx, dy, dz);
      this.captureGeometry(collection, LineString3d.create(points), dx, dy, dz);
    }
    this.captureGeometry(collection, Loop.createPolygon(points), dx, dy, dz);
  }
  /** Create and capture loop object(s) from an array of point sequences. */
  public static createAndCaptureLoops(
    collection: GeometryQuery[],
    points: IndexedXYZCollection | IndexedXYZCollection[] | Point3d[][] | undefined,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (points instanceof IndexedXYZCollection) {
      this.createAndCaptureLoop(collection, points, dx, dy, dz);
      return;
    }
    if (!points || points.length === 0)
      return;
    for (const loop of points)
      this.createAndCaptureLoop(collection, loop, dx, dy, dz);
  }
  /**
   * Clone the geometry and append to collection, e.g., for output by saveGeometry.
   * Also try to move the cloned geometry by dx,dy,dz. The original geometry is not moved.
   */
  public static captureCloneGeometry(
    collection: GeometryQuery[],
    newGeometry: GeometryQuery | GeometryQuery[] | IndexedXYZCollection | Point3d[] | Point3d[][] | IndexedXYZCollection[] | undefined,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (!newGeometry)
      return;
    if (newGeometry instanceof GeometryQuery) {
      const g1 = newGeometry.clone();
      if (g1)
        GeometryCoreTestIO.captureGeometry(collection, g1, dx, dy, dz);
      return;
    }
    if (newGeometry instanceof IndexedXYZCollection) {
      const linestring = LineString3d.create(newGeometry);
      this.captureGeometry(collection, linestring, dx, dy, dz);
      return;
    }
    if (Array.isArray(newGeometry) && newGeometry.length > 0) {
      if (newGeometry[0] instanceof Point3d) {
        const linestring = LineString3d.create(newGeometry);
        this.captureGeometry(collection, linestring, dx, dy, dz);
        return;
      }
      for (const g of newGeometry)
        this.captureCloneGeometry(collection, g as GeometryQuery, dx, dy, dz);
    }
  }
  /**
   * Create a circle (or many circles) given center and radius. Save the arcs in collection, shifted by [dx,dy,dz]
   * @param collection growing array of geometry
   * @param center single or multiple center point data
   * @param radius radius of circles
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static createAndCaptureXYCircle(
    collection: GeometryQuery[],
    center: Point3d | Point3d[],
    radius: number,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (Array.isArray(center)) {
      for (const c of center)
        this.createAndCaptureXYCircle(collection, c, radius, dx, dy, dz);
      return;
    }
    if (!Geometry.isSameCoordinate(0, radius)) {
      const newGeometry = Arc3d.createXY(center, radius);
      newGeometry.tryTranslateInPlace(dx, dy, dz);
      collection.push(newGeometry);
    }
  }
  /**
   * Create a circle in each sector of the mesh.
   * * centers are placed along line to centroid
   * * Hence unexpected results for non-convex facets.
   * @param collection growing array of geometry
   * @param polyface mesh to annotate.
   * @param radius radius of circles
   * @param lines true to draw lines from circle to circle
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static createAndCaptureSectorMarkup(
    collection: GeometryQuery[],
    polyface: Polyface,
    radius: number,
    lines: boolean = false,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    const visitor = polyface.createVisitor(0);
    const xyz = Point3d.create();
    const centers = [];
    for (visitor.reset(); visitor.moveToNextFacet();) {
      centers.length = 0;
      const centroid = PolygonOps.centroidAreaNormal(visitor.point)!;
      for (let i = 0; i < visitor.point.length; i++) {
        visitor.point.getPoint3dAtUncheckedPointIndex(i, xyz);
        const distanceToCentroid = xyz.distance(centroid.getOriginRef());
        const fraction = 1.5 * radius / distanceToCentroid;
        centers.push(xyz.interpolate(fraction, centroid.getOriginRef()));
      }
      this.createAndCaptureXYCircle(collection, centers, radius, dx, dy, dz);
      if (lines) {
        centers.push(centers[0]);
        this.captureGeometry(collection, LineString3d.create(centers), dx, dy, dz);
      }
    }
  }
  /**
   * Create a marker (or many markers) given center and size  Save in collection, shifted by [dx,dy,dz]
   * * marker = 0 is a circle
   * * marker = n (for n <= 10) is an n sided polygon, with an added stroke from the center to the first point.
   * * marker = -n (negative number) is n lines from the center to the n points of the n-sided polygon
   * @param collection growing array of geometry
   * @param center single or multiple center point data
   * @param a size of the marker
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static createAndCaptureXYMarker(
    collection: GeometryQuery[],
    markerId: number,
    center: Point3d | Point3d[],
    a: number,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (Array.isArray(center)) {
      for (const c of center)
        if (markerId === 0)
          this.createAndCaptureXYCircle(collection, c, a, dx, dy, dz);
        else
          this.createAndCaptureXYMarker(collection, markerId, c, a, dx, dy, dz);
      return;
    }
    const x = center.x + dx;
    const y = center.y + dy;
    const z = center.z + dz;
    const n = Math.abs(markerId);
    if (markerId > 0 && n <= 10) {
      const linestring = LineString3d.create();
      const radiansStep = Math.PI * 2 / n;
      linestring.addPointXYZ(x, y, z);
      linestring.addPointXYZ(x + a, y, z);
      for (let i = 1; i < n; i++) {
        const radians = i * radiansStep;
        const u = a * Math.cos(radians);
        const v = a * Math.sin(radians);
        linestring.addPointXYZ(x + u, y + v, z);
      }
      linestring.addPointXYZ(x + a, y, z);
      collection.push(linestring);
    } else if (markerId < 0 && -10 <= n) {
      const linestring = LineString3d.create();
      const radiansStep = Math.PI * 2 / n;
      linestring.addPointXYZ(x, y, z);
      for (let i = 0; i < n; i++) {
        const radians = i * radiansStep;
        const u = a * Math.cos(radians);
        const v = a * Math.sin(radians);
        linestring.addPointXYZ(x + u, y + v, z);
        linestring.addPointXYZ(x, y, z);
      }
      collection.push(linestring);
    } else
      this.createAndCaptureXYCircle(collection, center, a, dx, dy, dz);
  }
  /**
   * Create transformed edges of a range.
   * * For 3d range, capture all the edges with various linestrings.
   * * For 2d range, capture single linestring loop.
   * @param collection growing array of geometry
   * @param range Range
   * @param placement range-to-world transform, applied to range points before shift
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static captureTransformedRangeEdges(
    collection: GeometryQuery[],
    range?: Range2d | Range3d,
    placement?: Transform,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (range !== undefined && !range.isNull) {
      if (range instanceof Range3d) {
        const corners = range.corners();
        if (placement)
          placement.multiplyPoint3dArrayInPlace(corners);
        if (!Geometry.isSameCoordinate(range.high.z, range.low.z))
          this.captureGeometry(collection, LineString3d.createIndexedPoints(corners, [0, 1, 3, 2, 0, 4, 5, 7, 6, 4, 2, 6, 3, 7, 1, 5]), dx, dy, dz);
        else
          this.captureGeometry(collection, LineString3d.createIndexedPoints(corners, [0, 1, 3, 2, 0]), dx, dy, dz);
      } else if (range instanceof Range2d) {
        const corners = range.corners3d(true, 0);
        if (placement)
          placement.multiplyPoint3dArrayInPlace(corners);
        this.captureGeometry(collection, LineString3d.create(corners), dx, dy, dz);
      }
    }
  }
  /**
   * Create edges of a range.
   * * For 3d range, capture all the edges with various linestrings.
   * * For 2d range, capture single linestring loop.
   * @param collection growing array of geometry
   * @param range Range
   * @param dx x shift
   * @param dy y shift
   * @param dz z shift
   */
  public static captureRangeEdges(
    collection: GeometryQuery[], range?: Range2d | Range3d | Range2d[] | Range3d[], dx: number = 0, dy: number = 0, dz: number = 0,
  ) {
    if (Array.isArray(range)) {
      for (const r of range)
        this.captureTransformedRangeEdges(collection, r, undefined, dx, dy, dz);
    } else
      this.captureTransformedRangeEdges(collection, range, undefined, dx, dy, dz);
  }
  public static showMomentData(
    collection: GeometryQuery[],
    momentData?: MomentData,
    xyOnly: boolean = false,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (momentData) {
      const momentData1 = MomentData.inertiaProductsToPrincipalAxes(momentData.origin, momentData.sums);
      if (momentData1) {
        const unitX = momentData1.localToWorldMap.matrix.columnX();
        const unitY = momentData1.localToWorldMap.matrix.columnY();
        const unitZ = momentData1.localToWorldMap.matrix.columnZ();
        const rx = momentData1.radiusOfGyration.x;
        const ry = momentData1.radiusOfGyration.y;
        const rz = momentData1.radiusOfGyration.z;
        this.captureGeometry(collection,
          LineString3d.create([
            momentData1.origin,
            momentData1.origin.plusScaled(unitX, 2.0 * rz),
            momentData1.origin.plusScaled(unitY, rz),
            momentData1.origin,
            momentData1.origin.plusScaled(unitZ, 3.0 * rz)]), dx, dy, dz);
        this.captureGeometry(
          collection,
          Arc3d.create(momentData1.origin, unitX.scale(rz), unitY.scale(rz), AngleSweep.createStartEndDegrees(0, 355)),
          dx,
          dy,
          dz,
        );
        if (!xyOnly) {
          this.captureGeometry(collection, Arc3d.create(momentData1.origin, unitY.scale(rx), unitZ.scale(rx)), dx, dy, dz);
          this.captureGeometry(collection, Arc3d.create(momentData1.origin, unitZ.scale(ry), unitX.scale(ry)), dx, dy, dz);
        }
      }
    }
  }
  public static captureMesh(
    collection: GeometryQuery[],
    patch: UVSurface,
    numX: number,
    numY: number,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    const builder = PolyfaceBuilder.create();
    builder.addUVGridBody(patch, numX, numY);
    this.captureGeometry(collection, builder.claimPolyface(), dx, dy, dz);
  }
  public static captureCurveLocationDetails(
    collection: GeometryQuery[],
    data: CurveLocationDetail | CurveLocationDetailPair | CurveLocationDetail[] | CurveLocationDetailPair[],
    markerSize: number,
    dx: number = 0,
    dy: number = 0,
    dz: number = 0,
  ) {
    if (Array.isArray(data)) {
      for (const item of data) {
        this.captureCurveLocationDetails(collection, item, markerSize, dx, dy, dz);
      }
    } else if (data instanceof CurveLocationDetail) {
      if (data.hasFraction1) {
        if (data.curve) {
          const partialCurve = data.curve.clonePartialCurve(data.fraction, data.fraction1!);
          if (partialCurve) {
            const curveB = CurveChainWireOffsetContext.createSingleOffsetPrimitiveXY(partialCurve, 0.6 * markerSize);
            this.captureGeometry(collection, curveB, dx, dy, dz);
          }
        }
      } else {
        this.createAndCaptureXYMarker(collection, 0, data.point, markerSize, dx, dy, dz);
      }
    } else if (data instanceof CurveLocationDetailPair) {
      this.captureCurveLocationDetails(collection, data.detailA, markerSize, dx, dy, dz);
      this.captureCurveLocationDetails(collection, data.detailB, markerSize * 0.75, dx, dy, dz);
    }
  }
  /** Draw the scaled columns and origin to depict e.g., a Frenet frame. */
  public static captureTransformAsFrame(collection: GeometryQuery[], frame: Transform, radius: number, axisLength: number = 1, x?: number, y?: number, z?: number): void {
    const origin = Arc3d.createCenterNormalRadius(frame.getOrigin(), frame.matrix.columnZ(), radius);
    const xAxis = LineSegment3d.create(frame.getOrigin(), frame.getOrigin().plusScaled(frame.matrix.columnX().normalizeWithDefault(0, 0, 0), axisLength));
    const yAxis = LineSegment3d.create(frame.getOrigin(), frame.getOrigin().plusScaled(frame.matrix.columnY().normalizeWithDefault(0, 0, 0), axisLength));
    const zAxis = LineSegment3d.create(frame.getOrigin(), frame.getOrigin().plusScaled(frame.matrix.columnZ().normalizeWithDefault(0, 0, 0), axisLength));
    this.captureGeometry(collection, [origin, xAxis, yAxis, zAxis], x, y, z);
  }

  /** Read a flatbuffer file and interpret as GeometryQuery(s) */
  public static flatBufferFileToGeometry(filePath: string): GeometryQuery | GeometryQuery[] | undefined {
    const bytes = GeometryCoreTestIO.readBytesFromFile(filePath);
    if (bytes && bytes.length > 0)
      return BentleyGeometryFlatBuffer.bytesToGeometry(bytes, true);
    return undefined;
  }

  /** Read an imjs file and interpret as GeometryQuery(s) */
  public static jsonFileToGeometry(filePath: string): GeometryQuery | GeometryQuery[] | undefined {
    const json = fs.readFileSync(filePath, "utf8");
    const parsed = IModelJson.Reader.parse(JSON.parse(json));
    if (parsed instanceof GeometryQuery)
      return parsed as GeometryQuery;
    if (Array.isArray(parsed) && parsed.length > 0)
      return parsed as GeometryQuery[];
    return undefined;
  }

  /** Read imjs file and return the first IndexedPolyface found. */
  public static jsonFileToIndexedPolyface(filePath: string): IndexedPolyface | undefined {
    const geometry = this.jsonFileToGeometry(filePath);
    if (geometry instanceof IndexedPolyface)
      return geometry;
    if (Array.isArray(geometry)) {
      for (const mesh of geometry)
        if (mesh instanceof IndexedPolyface)
          return mesh;
    }
    return undefined;
  }
}
