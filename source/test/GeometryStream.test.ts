/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console no-string-literal */

import { assert } from "chai";
import { SolidPrimitive } from "@bentley/geometry-core/lib/solid/SolidPrimitive";
import { Path, ParityRegion } from "@bentley/geometry-core/lib/curve/CurveChain";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { GeometricPrimitive, GeometryType } from "../common/geometry/Primitives";
import { Point2d, Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { Cone } from "@bentley/geometry-core/lib/solid/Cone";
import { Sample } from "@bentley/geometry-core/lib/serialization/GeometrySamples";
import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";
import { PolyfaceBuilder } from "@bentley/geometry-core/lib/polyface/PolyfaceBuilder";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { IModelDb } from "../backend/IModelDb";
import { GSReader, GSWriter, GSCollection, GeometryBuilder, GeometryStream, OpCode } from "../common/geometry/GeometryStream";
import { GeometryParams } from "../common/geometry/GeometryProps";
import { IModelTestUtils } from "./IModelTestUtils";
import { Element } from "../backend/Element";
import { Code } from "../common/Code";
import { Placement3d, ElementAlignedBox3d } from "../common/geometry/Primitives";
import { GeometricElement3dProps } from "../common/ElementProps";

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

    // BRepEntity...

    // TextString...
  });
});

describe("GeometryStream", () => {
  let imodel: IModelDb;

  before(async () => {
    imodel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("should be able to read in stream using byte buffer", () => {
    const arr32bit: number[] = [
      1, 8, 1, 0,
      4, 48, 28, 1310744,
      12, 8, 0, 0,
      7, 24, 16777216, 2,
      8, 256, 5, 320,
      12, 786440, 458760, 8,
      16777216, 4, 12, 0,
      0, 0, 0, 0,
      0, 2099539146, 1076071199, 0,
      -1125122048, 0, 0, 2099539146,
      1076071199, -837249175, 1074924715, 0,
      0, -526004288, -1076210538, -837249173,
      1074924715, 0, 0, -526004096,
      -1076210538, 1712228141, 1075597413, 0,
      0, -1492607736, 1076709760, 1712228129,
      1075597413, 0, 0, -1492607734,
      1076709760, 1211391374, 1076291115, 0,
      0, -382107631, 1075996128, 1211391376,
      1076291115, 0, 0, -382107630,
      1075996128, 109798378, 1076801367, 0,
      0, 1931761296, 1075349626, 109798384,
      1076801367, 0, 0, 1931761284,
      1075349626, -761229254, 1076255798, 0,
      0, -1577083760, 1074188002, -761229250,
      1076255798, 0, 0, 0,
    ];

    const buff = new ArrayBuffer(arr32bit.length * 4);
    const view = new Uint32Array(buff);
    for (let i = 0; i < arr32bit.length; i++)
      view[i] = arr32bit[i];

    const iter = new GSCollection(buff);
    const geometry: any[] = [];
    const gsReader = new GSReader();
    do {
      const geom = gsReader.dgnGetGeometricPrimitive(iter.operation);
      if (geom)
        geometry.push(geom.data);
    } while (iter.nextOp());
  });

  it("base64 encoding and decoding should parallel that of native code", async () => {
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const gsWriter = new GSWriter();

    for (const geom of geomArray) {
      gsWriter.dgnAppendArc3d(geom, 2);
    }

    const geometryStream = gsWriter.outputGSRef();

    // Set up element to be placed in iModel
    const seedElement = await imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      id: new Id64(),
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: geometryStream,
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(0, 0, 0, 1, 1, 1)),
    };

    const testElem = imodel.elements.createElement(elementProps);
    const id = imodel.elements.insertElement(testElem);
    imodel.saveChanges();

    // Extract and test value returned
    const value = await imodel.elements.getElement(id);
    assert.isDefined(value.geom);

    if (value.geom) {
      const gsReader = new GSReader();
      const iterator = new GSCollection(value.geom.geomStream);

      const geomArrayOut: Arc3d[] = [];
      do {
        const geomOut = Arc3d.createXY(Point3d.create(0, 0, 0), 1);
        const success = gsReader.dgnGetArc3d(iterator.operation, geomOut);
        assert.isTrue(success !== undefined, "Expect Arc3d out");
        if (success) {
          geomArrayOut.push(geomOut);
        }
      } while (iterator.nextOp());
      assert.equal(geomArrayOut.length, geomArray.length, "All elements extracted from buffer");

      for (let i = 0; i < geomArrayOut.length; i++) {
        assert.isTrue(geomArrayOut[i].isAlmostEqual(geomArray[i]));
      }
    }
  });
});

describe("GeometryBuilder", () => {
  let imodel: IModelDb;
  let seedElement: Element;
  let ellipse: Arc3d;
  let curveCollection: ParityRegion;
  let cylinder: SolidPrimitive;
  let surface: BSplineSurface3d;
  let polyface: IndexedPolyface;

  before(async () => {
    imodel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    // Used to get information of imodel container
    seedElement = await imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    ellipse =  Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI))!;
    curveCollection = Sample.createSimpleParityRegions()[0];
    cylinder = Cone.createAxisPoints(Point3d.create(0, 0.34, 0), Point3d.create(0, 0, 1030.0), 1.5, 1.5, true)!;
    surface = Sample.createXYGridBsplineSurface(4, 6, 3, 4)!;
    const polyBuilder = PolyfaceBuilder.create();
    polyBuilder.addCone(cylinder as Cone);
    polyface = polyBuilder.claimPolyface();
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("should be able to create GeometricElement3d from various geometry (preserved during round trip testing to native code)", async () => {

    // Create an element that will take in the GeometryStream and placement
    const elementProps: GeometricElement3dProps = {
      classFullName: "Generic:PhysicalObject",
      iModel: imodel,
      model: seedElement.model,
      category: seedElement.category,
      id: new Id64(),
      code: Code.createEmpty(),
      federationGuid: new Guid(true),
      userLabel: "UserLabel-" + 1,
      geom: undefined,
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(0, 0, 0, 1, 1, 1)),
    };

    const geomElement = imodel.elements.createElement(elementProps);

    // Set up builder
    const builder = GeometryBuilder.createCategoryOrigin3d(seedElement.category, Point3d.create(0, 0, 0));
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
    assert.isTrue(geomElement.updateFromGeometryBuilder(builder), "Successfully updated element given a builder");
    const insert3d = imodel.elements.insertElement(geomElement);
    assert.isTrue(insert3d.isValid(), "Successfully inserted GeometricElement3d resulting from a GeometryBuilder's GeometryStream");

    // Extract back out of iModel and parse
    const returned3d = await imodel.elements.getElement(insert3d);
    assert.isDefined(returned3d.geom, "Returned element has GeometryStream");

    const collection = new GSCollection(returned3d.geom.geomStream);
    const reader = new GSReader();
    let item: any;
    const elParams = GeometryParams.createDefaults();
    while (collection.isValid) {
      if (collection.operation.isGeometryOp()) {
        item = reader.dgnGetGeometricPrimitive(collection.operation);
        assert.isDefined(item, "Item extracted into GeometricPrimitive");
      } else {
        item = reader.dgnGetGeometryParams(collection.operation, elParams);
        assert.isTrue(item, "Item extracted into GeometryParams");
      }
      collection.nextOp();
    }
  });

  it("should be able to make appendages to GeometricElement2d, with an exception of 3d geometry", async () => {

    const builder = GeometryBuilder.createCategoryOrigin2d(seedElement.category, Point2d.create());
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

  it ("geometry stream built in JS should be deserialized properly in C++", () => {
    const builder = GeometryBuilder.createCategoryOrigin3d(seedElement.category, Point3d.create(0, 0, 0));
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
    };

    const cppResult = imodel.elements.executeTestById(4, json);
    const jsonCompare = new DeepCompare();
    assert.isTrue(jsonCompare.compare({returnValue : true}, cppResult));
  });

  it ("geometry stream built in C++ should be deserialized properly in TS", () => {
    const pts = surface.copyPoints();
    const json: any = {
      bsurfacePts: pts,
      numSurfacePts: pts.length,
    };
    const cppResult = imodel.elements.executeTestById(5, json);
    assert.isTrue(cppResult.hasOwnProperty("geom"), "Successfully obtained geometry stream back from C++");
    const stream = GeometryStream.fromJSON(cppResult.geom);
    assert.isDefined(stream, "Geometry stream is defined");
    const collection = new GSCollection(stream!.geomStream);
    while (collection.isValid) {
      const geomType = collection.operation.opCode;
      if (!collection.operation.isGeometryOp()) {
        collection.nextOp();
        continue;
      }
      const geomPrim = collection.getGeometry();
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
          /*
          const cppPolyface = geomPrim!.asIndexedPolyface!;
          assert.isTrue(polyface.isAlmostEqual(cppPolyface));
          */
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
