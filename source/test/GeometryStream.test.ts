/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { assert } from "chai";
import { GSReader, GSWriter, Iterator, GeometryStream } from "../common/geometry/GeometryStream";
import { Point3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { IModelDb } from "../backend/IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { GeometricElement3dProps } from "../backend/Element";
import { Code } from "../common/Code";
import { Id64, Guid } from "@bentley/bentleyjs-core/lib/Id";
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

    const iter = Iterator.create(buff);
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
      const iterator = Iterator.create(value.geom.geomStream);

      const geomArrayOut: Arc3d[] = [];
      do {
        const geomOut = Arc3d.createXY(Point3d.create(0, 0, 0), 1);
        gsReader.dgnGetArc3d(iterator.operation, geomOut);
        if (geomOut) {
          assert.isTrue(geomOut instanceof Arc3d, "Expect Arc3d out");
          if (geomOut instanceof Arc3d)
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
