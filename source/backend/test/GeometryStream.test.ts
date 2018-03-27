/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import {
  Path, BSplineSurface3d, IndexedPolyface, Point3d, Vector3d, YawPitchRollAngles,
  PolyfaceBuilder, Arc3d, Cone, AngleSweep, PointString3d,
} from "@bentley/geometry-core";
import { Sample } from "@bentley/geometry-core/lib/serialization/GeometrySamples";
import { Id64, Guid } from "@bentley/bentleyjs-core";
import {
  GeometricPrimitive, GeometryType, Code, Placement3d, ElementAlignedBox3d, GeometricElement3dProps, GeometryStreamProps, GeometryPartProps, IModel,
} from "@bentley/imodeljs-common";
import { IModelTestUtils } from "./IModelTestUtils";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { DictionaryModel, IModelDb } from "../backend";

describe("GeometricPrimitive", () => {
  it("should be able to create GeometricPrimitives from various geometry", () => {

    // CurvePrimitive
    const arc = Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI));
    let elmGeom = GeometricPrimitive.createCurvePrimitiveClone(arc!);
    assert.isTrue(GeometryType.CurvePrimitive === elmGeom.type, "Correctly stored CurvePrimitive in GeometricPrimitive");
    assert.isTrue(elmGeom.isWire(), "CurvePrimitive is wire");
    assert.isFalse(elmGeom.isSheet(), "CurvePrimitive is not sheet");
    assert.isFalse(elmGeom.isSolid(), "CurvePrimitive is not solid");
    // Clone CurvePrimitive
    let elmGeomC = elmGeom.clone();
    const getAsCurvePrimitive = elmGeomC.asCurvePrimitive;
    assert.isTrue(getAsCurvePrimitive instanceof Arc3d, "GeometricPrimitive correctly returned CurvePrimitive data");
    assert.isFalse(getAsCurvePrimitive === arc, "CurvePrimitive stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeomC.type === elmGeom.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsCurvePrimitive!.isAlmostEqual(arc!), "CurvePrimitive and its clone are equal");

    // CurveCollection
    const loops = Sample.createSimplePaths(true);
    const curveCollection = loops[2];   // <-- Is a loop containing 4 LineSegments
    elmGeom = GeometricPrimitive.createCurveCollectionClone(curveCollection);
    assert.isTrue(elmGeom.type === GeometryType.CurveCollection, "Correctly stored CurveCollection in GeometricPrimitive");
    assert.isTrue(elmGeom.isWire(), "CurveCollection is wire");
    assert.isFalse(elmGeom.isSheet(), "CurveCollection is not sheet");
    assert.isFalse(elmGeom.isSolid(), "CurveCollection is not solid");
    // Clone CurveCollection
    elmGeomC = elmGeom.clone();
    const getAsCurveCollection = elmGeomC.asCurveCollection;
    assert.isTrue(getAsCurveCollection instanceof Path, "GeometricPrimitive correctly returned CurveCollection data");
    assert.isFalse(getAsCurveCollection === curveCollection, "CurveCollection stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsCurveCollection!.isAlmostEqual(curveCollection!), "CurveCollection and its clone are equal");

    // SolidPrimitive
    const dz = 3.0;
    const radius = 1.5;
    const solidPrimitive = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, dz), radius, radius, true);
    elmGeom = GeometricPrimitive.createSolidPrimitiveClone(solidPrimitive!);
    assert.isTrue(GeometryType.SolidPrimitive === elmGeom.type, "Correctly stored SolidPrimitive in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "SolidPrimitive is not wire");
    assert.isFalse(elmGeom.isSheet(), "SolidPrimitive is not sheet");
    assert.isTrue(elmGeom.isSolid(), "SolidPrimitive is solid");
    // Clone SolidPrimitive
    elmGeomC = elmGeom.clone();
    const getAsSolidPrimitive = elmGeomC.asSolidPrimitive;
    assert.isTrue(getAsSolidPrimitive instanceof Cone, "GeometricPrimitive correctly returned SolidPrimitive data");
    assert.isFalse(getAsSolidPrimitive === solidPrimitive, "SolidPrimitive stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsSolidPrimitive!.isAlmostEqual(solidPrimitive!), "SolidPrimitive and its clone are equal");

    // BsplineSurface
    const surface = BSplineSurface3d.createUniformKnots([Point3d.create(0, 0), Point3d.create(1, 1)], 1, 1, 1);
    elmGeom = GeometricPrimitive.createBsplineSurfaceClone(surface!);
    assert.isTrue(GeometryType.BsplineSurface === elmGeom.type, "Correctly stored BsplineSurface in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "BsplineSurface is not wire");
    assert.isTrue(elmGeom.isSheet(), "BsplineSurface is sheet");
    assert.isFalse(elmGeom.isSolid(), "BsplineSurface is not solid");
    // Clone BsplineSurface
    elmGeomC = elmGeom.clone();
    const getAsBspline = elmGeomC.asBsplineSurface;
    assert.isTrue(getAsBspline instanceof BSplineSurface3d, "GeometricPrimitive correctly returned BsplineSurface data");
    assert.isFalse(getAsBspline === surface, "BsplineSurface stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsBspline!.isAlmostEqual(surface!), "BsplineSurface and its clone are equal");

    // Polyface
    const builder = PolyfaceBuilder.create();
    builder.addCone(solidPrimitive!);
    const polyface = builder.claimPolyface();
    elmGeom = GeometricPrimitive.createIndexedPolyfaceClone(polyface);
    assert.isTrue(GeometryType.IndexedPolyface === elmGeom.type, "Correctly stored Polyface in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "Polyface is not wire");
    assert.isTrue(elmGeom.isSheet(), "Polyface is sheet");
    assert.isFalse(elmGeom.isSolid(), "Polyface is not solid");
    // Clone Polyface
    elmGeomC = elmGeom.clone();
    const getAsPolyface = elmGeomC.asIndexedPolyface;
    assert.isTrue(getAsPolyface instanceof IndexedPolyface, "GeometricPrimitive correctly returned Polyface data");
    assert.isFalse(getAsPolyface === polyface, "Polyface stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsPolyface!.isAlmostEqual(polyface!), "Polyface and its clone are equal");

    // PointString
    const localPoints3dBuf: Point3d[] = [Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(0, 1, 0)];
    const pointString = PointString3d.create(localPoints3dBuf);
    elmGeom = GeometricPrimitive.createPointStringClone(pointString!);
    assert.isTrue(GeometryType.PointString === elmGeom.type, "Correctly stored PointString3d in GeometricPrimitive");
    assert.isFalse(elmGeom.isWire(), "PointString is not wire");
    assert.isFalse(elmGeom.isSheet(), "PointString is not sheet");
    assert.isFalse(elmGeom.isSolid(), "PointString is not solid");
    // Clone PointString
    elmGeomC = elmGeom.clone();
    const getAsPointString = elmGeomC.asPointString;
    assert.isTrue(getAsPointString instanceof PointString3d, "GeometricPrimitive correctly returned PointString data");
    assert.isFalse(getAsPointString === pointString, "Pointstring stored as deep copy in GeometricPrimitive");
    assert.isTrue(elmGeomC.type === elmGeom.type, "GeometricPrimitive clone type matches");
    assert.isTrue(getAsPointString!.isAlmostEqual(pointString!), "PointString and its clone are equal");

    // BRepEntity...

    // TextString...
  });
});

describe("GeometryStream", () => {
  let imodel: IModelDb;

  before(() => {
    imodel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it.skip("json encoding and decoding roundtrip of GeometryPart", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const geometryStream: GeometryStreamProps = [];

    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }

    // tslint:disable-next-line:no-debugger
    // debugger;

    const dictionary: DictionaryModel = imodel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    const partProps: GeometryPartProps = {
      classFullName: "BisCore:GeometryPart",
      iModel: imodel,
      model: dictionary,
      code: Code.createEmpty(),
      geom: geometryStream,
      bbox: new ElementAlignedBox3d(0, 0, 0, 0, 0, 0),
    };

    const testPart = imodel.elements.createElement(partProps);
    const partId = imodel.elements.insertElement(testPart);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElement({ id: partId, wantGeometry: true });
    assert.isDefined(value.geom);
  });

  it.skip("json encoding and decoding roundtrip of arcs", async () => {
    // Set up element to be placed in iModel
    const seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const geometryStream: GeometryStreamProps = [];

    for (const geom of geomArray) {
      const arcData = GeomJson.Writer.toIModelJson(geom);
      geometryStream.push(arcData);
    }

    // tslint:disable-next-line:no-debugger
    // debugger;

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: geometryStream,
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(0, 0, 0, 0, 0, 0)),
    };

    const testElem = imodel.elements.createElement(elementProps);
    const newId = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = imodel.elements.getElement({ id: newId, wantGeometry: true });
    assert.isDefined(value.geom);

    const geomArrayOut: Arc3d[] = [];
    for (const entry of value.geom) {
      assert.isDefined(entry.arc);
      const geometryQuery = GeomJson.Reader.parse(entry);
      assert.isTrue(geometryQuery instanceof Arc3d, "GeometricPrimitive correctly returned Arc3d data");
      if (geometryQuery !== undefined)
        geomArrayOut.push(geometryQuery);
    }

    assert.equal(geomArrayOut.length, geomArray.length, "All elements extracted from buffer");
    for (let i = 0; i < geomArrayOut.length; i++) {
      assert.isTrue(geomArrayOut[i].isAlmostEqual(geomArray[i]));
    }
  });
});

/* WIP: waiting for geometry stream refactor
describe("GeometryBuilder", () => {
  let imodel: IModelDb;
  let seedElement: Element;
  let ellipse: Arc3d;
  let curveCollection: ParityRegion;
  let cylinder: SolidPrimitive;
  let surface: BSplineSurface3d;
  let polyface: IndexedPolyface;
  let polyPoints: Point3d[];

  before(() => {
    imodel = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    // Used to get information of imodel container
    seedElement = imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    ellipse = Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI))!;
    curveCollection = Sample.createSimpleParityRegions()[0];
    cylinder = Cone.createAxisPoints(Point3d.create(0, 0.34, 0), Point3d.create(0, 0, 1030.0), 1.5, 1.5, true)!;
    surface = Sample.createXYGridBsplineSurface(4, 6, 3, 4)!;
    polyface = IndexedPolyface.create(false, false, false);
    polyPoints = [
      Point3d.create(0, 0),
      Point3d.create(1.589, 5.687),
      Point3d.create(-5.89, -2),
      Point3d.create(86, 1.00001),
      Point3d.create(100, -100),
      Point3d.create(867.5309, 1.01010101),
      Point3d.create(5.87, 0),
    ];
    for (const point of polyPoints)
      polyface.addPoint(point);
    for (let i = 0; i < 5; i++) {
      polyface.addPointIndex(i);
      polyface.addPointIndex(i + 1);
      polyface.addPointIndex(i + 2);
      polyface.terminateFacet();
    }
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("should be able to create GeometricElement3d from various geometry (preserved during round trip testing to native code)", () => {

    // Create an element that will take in the GeometryStream and placement
    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: undefined,
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(0, 0, 0, 1, 1, 1)),
    };

    const geomElement = imodel.elements.createElement(elementProps);

    // Set up builder
    const builder = GeometryStreamBuilder.fromCategoryIdAndOrigin3d(seedElement.category, Point3d.create(0, 0, 0));
    assert.isDefined(builder, "Builder is successfully created");
    if (!builder)
      return;

    // Make appendages
    assert.isTrue(builder.appendCurvePrimitive(ellipse), "Successfully appended CurvePrimitive using builder");
    assert.isTrue(builder.appendCurveCollection(curveCollection), "Successfully appended CurveCollection using builder");
    assert.isTrue(builder.appendSolidPrimitive(cylinder), "Successfully appended SolidPrimitive using builder");
    assert.isTrue(builder.appendBsplineSurface(surface), "BsplineSurface successfully appended using builder");
    assert.isTrue(builder.appendPolyface(polyface), "Successfully appended polyface using builder");

    // Update the element
    assert.isTrue(geomElement.updateFromGeometryStreamBuilder(builder), "Successfully updated element given a builder");
    const insert3d = imodel.elements.insertElement(geomElement);
    assert.isTrue(insert3d.isValid(), "Successfully inserted GeometricElement3d resulting from a GeometryBuilder's GeometryStream");

    // Extract back out of iModel and parse
    const returned3d = imodel.elements.getElement(insert3d);
    assert.isDefined(returned3d.geom, "Returned element has GeometryStream");

    const collection = new OpCodeIterator(returned3d.geom.geomStream);
    const reader = new OpCodeReader();
    let item: any;
    const elParams = new GeometryParams(new Id64());
    while (collection.isValid) {
      if (collection.operation!.isGeometryOp()) {
        item = reader.getGeometricPrimitive(collection.operation!);
        assert.isDefined(item, "Item extracted into GeometricPrimitive");
      } else {
        item = reader.getGeometryParams(collection.operation!, elParams);
        assert.isTrue(item, "Item extracted into GeometryParams");
      }
      collection.nextOp();
    }
  });

  it("should be able to make appendages to GeometricElement2d, with an exception of 3d geometry", () => {

    const builder = GeometryStreamBuilder.fromCategoryIdAndOrigin2d(seedElement.category, Point2d.create());
    assert.isDefined(builder, "Builder is successfully created");
    if (!builder)
      return;

    // CurvePrimitive
    const ellipse2d = Arc3d.create(Point3d.create(1, 2, 0), Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI));
    assert.isTrue(builder.appendCurvePrimitive(ellipse2d!), "Successfully appended CurvePrimitive using builder");

    // 3d should not be appended
    const cylinder3d = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 3.0), 1.5, 1.5, true);
    assert.isFalse(builder.appendSolidPrimitive(cylinder3d!), "3d SolidPrimitive is NOT appended using 2d builder");
  });

  // spell-checker: disable

  it("geometry stream built in JS should be deserialized properly in C++", () => {
    const builder = GeometryStreamBuilder.fromCategoryIdAndOrigin3d(seedElement.category, Point3d.create(0, 0, 0));
    assert.isDefined(builder, "Builder is successfully created");
    if (!builder)
      return;
    assert.isTrue(builder.appendCurvePrimitive(ellipse), "Successfully appended CurvePrimitive using builder");
    assert.isTrue(builder.appendCurveCollection(curveCollection), "Successfully appended CurveCollection using builder");
    assert.isTrue(builder.appendSolidPrimitive(cylinder), "Successfully appended SolidPrimitive using builder");
    assert.isTrue(builder.appendBsplineSurface(surface), "BsplineSurface successfully appended using builder");
    assert.isTrue(builder.appendPolyface(polyface), "Successfully appended polyface using builder");

    // Prepare arguments for C++
    const pts = surface.copyPoints();
    const json: any = {
      geom: builder.getGeometryStreamRef().toJSON(),
      bsurfacePts: pts,
      numSurfacePts: pts.length,
      polyPts: polyPoints,
      numPolyPts: polyPoints.length,
      outFileName: path.join(KnownTestLocations.outputDir, "myDb.bim"),
    };

    const cppResult = imodel.executeTest("deserializeGeometryStream", json);
    const jsonCompare = new DeepCompare();
    assert.isTrue(jsonCompare.compare({ returnValue: true }, cppResult));
  });
  */

  /* WIP: waiting for geometry stream refactor
  it("geometry stream built in C++ should be deserialized properly in TS", () => {
    const pts = surface.copyPoints();
    const json: any = {
      bsurfacePts: pts,
      numSurfacePts: pts.length,
      polyPts: polyPoints,
      numPolyPts: polyPoints.length,
      outFileName: path.join(KnownTestLocations.outputDir, "testDb.bim"),
    };
    const cppResult = imodel.executeTest("buildKnownGeometryStream", json);
    assert.isTrue(cppResult.hasOwnProperty("geom"), "Successfully obtained geometry stream back from C++");
    const stream = GeometryStream.fromJSON(cppResult.geom);
    assert.isDefined(stream, "Geometry stream is defined");
    const collection = new OpCodeIterator(stream!.geomStream);
    const reader = new OpCodeReader();
    while (collection.isValid) {
      const geomType = collection.operation!.opCode;
      if (!collection.operation!.isGeometryOp()) {
        collection.nextOp();
        continue;
      }
      const geomPrim = reader.getGeometricPrimitive(collection.operation!);
      assert.isDefined(geomPrim, "Successfully extracted a geometric primitive");
      switch (geomType) {
        case OpCode.ArcPrimitive: {
          const cppCurve = geomPrim!.asCurvePrimitive!;
          assert.isTrue(ellipse.isAlmostEqual(cppCurve));
          break;
        }
        case OpCode.CurveCollection: {
          const cppCurveVec = geomPrim!.asCurveCollection!;
          assert.isTrue(curveCollection.isAlmostEqual(cppCurveVec));
          break;
        }
        case OpCode.SolidPrimitive: {
          const cppSolid = geomPrim!.asSolidPrimitive!;
          assert.isTrue(cylinder.isAlmostEqual(cppSolid));
          break;
        }
        case OpCode.BsplineSurface: {
          const cppSurface = geomPrim!.asBsplineSurface!;
          assert.isTrue(surface.isAlmostEqual(cppSurface));
          break;
        }
        case OpCode.Polyface: {
          const cppPolyface = geomPrim!.asIndexedPolyface!;
          assert.isTrue(polyface.isAlmostEqual(cppPolyface));
          break;
        }
        default: {
          assert.isTrue(false, "Unexpected opcode to test");
        }
      }
      collection.nextOp();
    }
  });
});
*/
