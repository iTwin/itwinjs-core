/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { assert } from "chai";
import { GSReader, GSWriter, GSCollection, GeometryStream } from "../common/geometry/GeometryStream";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { Path } from "@bentley/geometry-core/lib/curve/CurveChain";
import { Cone } from "@bentley/geometry-core/lib/solid/Cone";
import { Sample } from "@bentley/geometry-core/lib/serialization/GeometrySamples";
// import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
// import { PolyfaceBuilder } from "@bentley/geometry-core/lib/polyface/PolyfaceBuilder";
// import { IndexedPolyface } from "@bentley/geometry-core/lib/polyface/Polyface";
import { IModelDb } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { GeometricElement3dProps } from "../backend/Element";
import { Code } from "../common/Code";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { GeometricPrimitive, GeometryType, Placement3d, ElementAlignedBox3d } from "../common/geometry/Primitives";

describe ("GeometricPrimitive", () => {
    it("Create", () => {

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
      const solidPrimitve = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, dz), radius, radius, true);
      elmGeom = GeometricPrimitive.createSolidPrimitiveClone(solidPrimitve!);
      assert.isTrue(GeometryType.SolidPrimitive === elmGeom.type, "Correctly stored SolidPrimitve in GeometricPrimitive");
      assert.isFalse(elmGeom.isWire(), "SolidPrimitive is not wire");
      assert.isFalse(elmGeom.isSheet(), "SolidPrimitive is not sheet");
      assert.isTrue(elmGeom.isSolid(), "SolidPrimitive is solid");
      // Clone SolidPrimitive
      elmGeomC = elmGeom.clone();
      const getAsSolidPrimitive = elmGeomC.asSolidPrimitive;
      assert.isTrue(getAsSolidPrimitive instanceof Cone, "GeometricPrimitive correctly returned SolidPrimitve data");
      assert.isFalse(getAsSolidPrimitive === solidPrimitve, "SolidPrimitive stored as deep copy in GeometricPrimitive");
      assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
      assert.isTrue(getAsSolidPrimitive!.isAlmostEqual(solidPrimitve!), "SolidPrimitive and its clone are equal");

      // BsplineSurface
      /*
      const a  = 1000 / 3.0;
      const surface = Sample.createXYGridBsplineSurface(a, a, 5, 4);
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
      */
      /*
      // Polyface
      const builder = PolyfaceBuilder.create();
      builder.addCone(solidPrimitve!);
      const polyface = builder.claimPolyface();
      elmGeom = GeometricPrimitive.createIndexedPolyfaceClone(polyface);
      assert.isTrue(GeometryType.IndexedPolyface === elmGeom.type, "Correctly stored Polyface in GeometricPrimitive");
      assert.isFalse(elmGeom.isWire(), "Polyface is not wire");
      assert.isFalse(elmGeom.isSheet(), "Polyface is sheet");
      assert.isTrue(elmGeom.isSolid(), "Polyface is not solid");
      // Clone Polyface
      elmGeomC = elmGeom.clone();
      const getAsPolyface = elmGeomC.asIndexedPolyface;
      assert.isTrue(getAsPolyface instanceof IndexedPolyface, "GeometricPrimitive correctly returned Polyface data");
      assert.isFalse(getAsPolyface === polyface, "Polyface stored as deep copy in GeometricPrimitive");
      assert.isTrue(elmGeom.type === elmGeomC.type, "GeometricPrimitive clone type matches");
      assert.isTrue(getAsPolyface!.isAlmostEqual(polyface!), "Polyface and its clone are equal");
      */
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

  it("FromBytes", () => {
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

  it ("Base64Encoding", async () => {
    const geomArray: Arc3d[] = [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ];

    const gsWriter = new GSWriter();

    for (const geom of geomArray) {
      gsWriter.dgnAppendArc3d(geom, 2);
    }

    const geometryStream = new GeometryStream(gsWriter.outputReference());

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
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1))),
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
