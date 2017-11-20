/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console no-string-literal */

import { assert } from "chai";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";
import { AngleSweep } from "@bentley/geometry-core/lib/Geometry";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { Cone } from "@bentley/geometry-core/lib/solid/Cone";
import { Sample } from "@bentley/geometry-core/lib/serialization/GeometrySamples";
import { PolyfaceBuilder } from "@bentley/geometry-core/lib/polyface/PolyfaceBuilder";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
import { IModelDb } from "../backend/IModelDb";
import { GSReader, GSWriter, GSCollection, GeometryStream, GeometryBuilder } from "../common/geometry/GeometryStream";
import { GeometryParams } from "../common/geometry/GeometryProps";
import { IModelTestUtils } from "./IModelTestUtils";
import { GeometricElement3dProps } from "../backend/Element";
import { Category } from "../backend/Category";
import { Code } from "../common/Code";
import { Placement3d, ElementAlignedBox3d } from "../common/geometry/Primitives";

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

describe ("GeometryBuilder", () => {
  let imodel: IModelDb;

  before(async () => {
    imodel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it ("CreateElement3d", async () => {

    // Used to get information of imodel container
    const seedElement = await imodel.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

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
      placement: new Placement3d(Point3d.create(), YawPitchRollAngles.createDegrees(0, 0, 0), new ElementAlignedBox3d(Point3d.create(0, 0, 0), Point3d.create(1, 1, 1))),
    };

    const geomElement = imodel.elements.createElement(elementProps);

    // Set up builder and make appendages

    const builder = GeometryBuilder.createCategoryOrigin3d(seedElement.category, Point3d.create(0, 0, 0));
    assert.isDefined(builder, "Builder is successfully created");
    if (!builder)
      return;

    // CurvePrimitive
    const ellipse = Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI));
    assert.isTrue(builder.appendCurvePrimitive(ellipse!), "Successfully appended CurvePrimitive using builder");

    // CurveCollection
    const curveCollection = Sample.createSimpleParityRegions()[0];
    assert.isTrue(builder.appendCurveCollection(curveCollection), "Successfully appended CurveCollection using builder");

    // SolidPrimitive
    const cylinder = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 3.0), 1.5, 1.5, true);
    assert.isTrue(builder.appendSolidPrimitive(cylinder!), "Successfully appended SolidPrimitve using builder");

    // GeometryParams
    const elemDisplayParams = GeometryParams.createDefaults();
    elemDisplayParams.setCategoryId(seedElement.category);
    elemDisplayParams.setWeight(2);
    assert.isTrue(builder.appendGeometryParams(elemDisplayParams), "Successfully appended GeometryParams using builder");

    // SubCategory
    const defaultCategoryId = IModelTestUtils.getSpatialCategoryIdByName(imodel, "DefaultCategory");
    const defaultSubCategoryId = Category.getDefaultSubCategoryId(defaultCategoryId);
    const testReturn = await imodel.elements.getElement(defaultSubCategoryId);
    assert.isTrue(testReturn.id.isValid(), "Element successfully received back");
    assert.isTrue(builder.appendSubCategoryId(defaultSubCategoryId), "SubCategory Id reference successfully appended using builder");

    // BsplineSurface
    const surface = BSplineSurface3d.createUniformKnots([Point3d.create(0, 0), Point3d.create(1, 1)], 1, 1, 1);
    assert.isTrue(builder.appendBsplineSurface(surface!), "BsplineSurface successfully appended using builder");

    // Polyface
    const polyBuilder = PolyfaceBuilder.create();
    polyBuilder.addCone(cylinder!);
    const polyface = polyBuilder.claimPolyface();
    assert.isTrue(builder.appendPolyface(polyface), "Successfully appended polyface using builder");

    // BRepEntity

    // TextString

    assert.isTrue(geomElement.updateFromGeometryBuilder(builder), "Successfully updated element given a builder");
    const insert3d = imodel.elements.insertElement(geomElement);
    assert.isTrue(insert3d.isValid(), "Successfully inserted GeometricElement3d resulting from a GeometryBuilder's GeometryStream");

    // Extract back out of iModel
    const returned3d = await imodel.elements.getElement(insert3d);
    assert.isDefined(returned3d.geom, "Returned element has GeometryStream");

    const collection = new GSCollection(returned3d.geom.geomStream);
    const reader = new GSReader();
    const itemArr: any[] = [];
    const elParams = GeometryParams.createDefaults();
    while (collection.isValid) {
      let item: any;
      if (collection.operation.isGeometryOp()) {
        item = reader.dgnGetGeometricPrimitive(collection.operation);
        assert.isDefined(item, "Item extracted into GeometricPrimitive");
        itemArr.push(item);
      } else {
        item = reader.dgnGetGeometryParams(collection.operation, elParams);
        assert.isTrue(item, "Item extracted into GeometryParams");
        itemArr.push(elParams);
      }
      collection.nextOp();
    }
  });
});
