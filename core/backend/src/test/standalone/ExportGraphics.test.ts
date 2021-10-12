/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Box, LineString3d, Point3d, Range3d, Sphere } from "@itwin/core-geometry";
import { Code, ColorDef, DbResult, GeometryClass, GeometryParams, GeometryPartProps, GeometryStreamBuilder, IModel, PhysicalElementProps } from "@itwin/core-common";
import { ExportLinesInfo, ExportPartInfo, ExportPartInstanceInfo, ExportPartLinesInfo } from "../../ExportGraphics";
import {
  ExportGraphics, ExportGraphicsInfo, ExportGraphicsMeshVisitor, ExportGraphicsOptions, GeometricElement, PhysicalObject, SnapshotDb,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometryPart } from "../../Element";

function saveNewElementFromBuilder(builder: GeometryStreamBuilder, seedElement: GeometricElement, iModel: SnapshotDb): Id64String {
  const elementProps: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: seedElement.model,
    category: seedElement.category,
    code: Code.createEmpty(),
    geom: builder.geometryStream,
  };
  const newId = iModel.elements.insertElement(elementProps);
  iModel.saveChanges();
  return newId;
}

describe("exportGraphics", () => {
  let iModel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    iModel.close();
  });

  it("handles single geometryClass in GeometryStream", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedElement.category);
    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const newId = saveNewElementFromBuilder(builder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].geometryClass, GeometryClass.Construction);
  });

  it("handles multiple geometryClass in GeometryStream", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedElement.category);

    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));

    geometryParams.geometryClass = GeometryClass.Primary;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true)!);

    const newId = saveNewElementFromBuilder(builder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      chordTol: 0.01,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 2);

    // Sphere is construction, box is primary. Output order is arbitrary, use mesh size to figure out which is which.
    if (infos[0].mesh.indices.length > 36) {
      assert.strictEqual(infos[0].geometryClass, GeometryClass.Construction);
      assert.strictEqual(infos[1].geometryClass, GeometryClass.Primary);
    } else {
      assert.strictEqual(infos[0].geometryClass, GeometryClass.Primary);
      assert.strictEqual(infos[1].geometryClass, GeometryClass.Construction);
    }
  });

  it("handles geometryClass in lines", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedElement.category);

    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(LineString3d.createPoints([Point3d.createZero(), Point3d.create(1, 0, 0)]));

    const newId = saveNewElementFromBuilder(builder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const lineInfos: ExportLinesInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      onLineGraphics: (lineInfo: ExportLinesInfo) => lineInfos.push(lineInfo),
      chordTol: 0.01,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 0);
    assert.strictEqual(lineInfos.length, 1);
    assert.strictEqual(lineInfos[0].geometryClass, GeometryClass.Construction);
  });

  it("handles geometryClass defined in parts", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partBuilder = new GeometryStreamBuilder();
    const partGeometryParams = new GeometryParams(Id64.invalid); // category unused for GeometryPart
    partGeometryParams.geometryClass = GeometryClass.Construction;
    partBuilder.appendGeometryParamsChange(partGeometryParams);
    partBuilder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const partId = iModel.elements.insertElement(partProps);
    iModel.saveChanges();

    const partInstanceBuilder = new GeometryStreamBuilder();
    partInstanceBuilder.appendGeometryPart3d(partId);
    const partInstanceId = saveNewElementFromBuilder(partInstanceBuilder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const partInstanceArray: ExportPartInstanceInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [partInstanceId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      partInstanceArray,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 0);
    assert.strictEqual(partInstanceArray.length, 1);

    const partInfos: ExportPartInfo[] = [];
    const exportPartStatus = iModel.exportPartGraphics({
      elementId: partInstanceArray[0].partId,
      displayProps: partInstanceArray[0].displayProps,
      onPartGraphics: (info: ExportPartInfo) => partInfos.push(info),
    });
    assert.strictEqual(exportPartStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(partInfos.length, 1);
    assert.strictEqual(partInfos[0].geometryClass, GeometryClass.Construction);
  });

  it("handles geometryClass defined outside parts", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const partId = iModel.elements.insertElement(partProps);
    iModel.saveChanges();

    const partInstanceBuilder = new GeometryStreamBuilder();
    const partInstanceGeometryParams = new GeometryParams(seedElement.category);
    partInstanceGeometryParams.geometryClass = GeometryClass.Construction;
    partInstanceBuilder.appendGeometryParamsChange(partInstanceGeometryParams);
    partInstanceBuilder.appendGeometryPart3d(partId);
    const partInstanceId = saveNewElementFromBuilder(partInstanceBuilder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const partInstanceArray: ExportPartInstanceInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [partInstanceId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      partInstanceArray,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 0);
    assert.strictEqual(partInstanceArray.length, 1);
    assert.strictEqual(partInstanceArray[0].displayProps.geometryClass, GeometryClass.Construction);

    const partInfos: ExportPartInfo[] = [];
    const exportPartStatus = iModel.exportPartGraphics({
      elementId: partInstanceArray[0].partId,
      displayProps: partInstanceArray[0].displayProps,
      onPartGraphics: (info: ExportPartInfo) => partInfos.push(info),
    });
    assert.strictEqual(exportPartStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(partInfos.length, 1);
    assert.strictEqual(partInfos[0].geometryClass, GeometryClass.Construction);
  });

  it("handles geometryClass for lines in parts", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const partBuilder = new GeometryStreamBuilder();
    const partGeometryParams = new GeometryParams(Id64.invalid); // category unused for GeometryPart
    partGeometryParams.geometryClass = GeometryClass.Construction;
    partBuilder.appendGeometryParamsChange(partGeometryParams);
    partBuilder.appendGeometry(LineString3d.createPoints([Point3d.createZero(), Point3d.create(1, 0, 0)]));

    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const partId = iModel.elements.insertElement(partProps);
    iModel.saveChanges();

    const partInstanceBuilder = new GeometryStreamBuilder();
    partInstanceBuilder.appendGeometryPart3d(partId);
    const partInstanceId = saveNewElementFromBuilder(partInstanceBuilder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const partInstanceArray: ExportPartInstanceInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [partInstanceId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      partInstanceArray,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 0);
    assert.strictEqual(partInstanceArray.length, 1);

    const partInfos: ExportPartInfo[] = [];
    const partLineInfos: ExportPartLinesInfo[] = [];
    const exportPartStatus = iModel.exportPartGraphics({
      elementId: partInstanceArray[0].partId,
      displayProps: partInstanceArray[0].displayProps,
      onPartGraphics: (info: ExportPartInfo) => partInfos.push(info),
      onPartLineGraphics: (info: ExportPartLinesInfo) => partLineInfos.push(info),
    });
    assert.strictEqual(exportPartStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(partInfos.length, 0);
    assert.strictEqual(partLineInfos.length, 1);
    assert.strictEqual(partLineInfos[0].geometryClass, GeometryClass.Construction);
  });

  it("converts to IndexedPolyface", async () => {
    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    const box = Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true);
    assert.isFalse(undefined === box);

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(box!);

    const newId = saveNewElementFromBuilder(builder, seedElement, iModel);

    const infos: ExportGraphicsInfo[] = [];
    const onGraphics = (info: ExportGraphicsInfo) => {
      infos.push(info);
    };
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].color, ColorDef.white.tbgr);
    assert.strictEqual(infos[0].mesh.indices.length, 36);
    assert.strictEqual(infos[0].elementId, newId);
    assert.strictEqual(infos[0].geometryClass, GeometryClass.Primary);
    const polyface = ExportGraphics.convertToIndexedPolyface(infos[0].mesh);
    assert.strictEqual(polyface.facetCount, 12);
    assert.strictEqual(polyface.data.pointCount, 24);
    assert.strictEqual(polyface.data.normalCount, 24);
    assert.strictEqual(polyface.data.paramCount, 24);
  });

  //
  //
  //    2---3      6
  //    | \ |     | \
  //    0---1    4---5
  //
  it("ExportMeshGraphicsVisitor", async () => {
    const numPoints = 7;
    const numFacets = 3;
    const pointData = [0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 2, 0, 2, 0, 0, 4, 0, 0, 3, 2, 0];
    const paramData = [0, 0, 1, 0, 0, 2, 1, 2, 2, 0, 4, 0, 3, 2];
    const normalData = new Float32Array(pointData.length);
    const a0 = 2.0;
    const a1 = 3.0;
    const b0 = -2.0;
    const b1 = 5.0;
    // make normals functionally related to point coordinates . . . not good normals, but good for tests
    let paramCursor = 0;
    for (let i = 0; i < pointData.length; i++) {
      normalData[i] = a1 * pointData[i] + a0;
      if ((i + 1) % 3 !== 0)
        paramData[paramCursor++] = b0 + b1 * pointData[i];
    }
    const smallMesh = {
      points: new Float64Array(pointData),
      params: new Float32Array(paramData),
      // normals have one-based index as z ..
      normals: new Float32Array(normalData),
      indices: new Int32Array([0, 1, 2, 2, 1, 3, 4, 5, 6]),
      isTwoSided: true,
    };
    const knownArea = 4.0;
    assert.isTrue(smallMesh.points.length === 3 * numPoints);
    assert.isTrue(smallMesh.normals.length === 3 * numPoints);
    assert.isTrue(smallMesh.params.length === 2 * numPoints);
    assert.isTrue(smallMesh.indices.length === 3 * numFacets);
    const visitor = ExportGraphicsMeshVisitor.create(smallMesh, 0);
    assert.isDefined(visitor.paramIndex, "paramIndex defined");
    assert.isDefined(visitor.paramIndex, "paramIndex defined");
    let numFacetsA = 0;
    let indexCursor = 0;
    let areaSum = 0.0;
    while (visitor.moveToNextFacet()) {
      numFacetsA++;
      assert.isTrue(visitor.point.length === 3);
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.pointIndex[0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.pointIndex[1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.pointIndex[2]);
      const areaVector = visitor.point.crossProductIndexIndexIndex(0, 1, 2)!;
      areaSum += areaVector.magnitude() * 0.5;
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.paramIndex![0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.paramIndex![1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.paramIndex![2]);
      assert.isTrue(smallMesh.indices[indexCursor] === visitor.normalIndex![0]);
      assert.isTrue(smallMesh.indices[indexCursor + 1] === visitor.normalIndex![1]);
      assert.isTrue(smallMesh.indices[indexCursor + 2] === visitor.normalIndex![2]);
      for (let k = 0; k < 3; k++) {
        const point = visitor.point.getPoint3dAtUncheckedPointIndex(k);
        const normal = visitor.normal!.getPoint3dAtUncheckedPointIndex(k);
        const param = visitor.param!.getPoint2dAtUncheckedPointIndex(k);
        for (let j = 0; j < 3; j++) {
          assert.isTrue(a0 + a1 * point.at(j) === normal.at(j));
        }
        for (let j = 0; j < 2; j++) {
          assert.isTrue(b0 + b1 * point.at(j) === (j === 0 ? param.x : param.y));
        }
      }
      indexCursor += 3;
    }
    assert.isTrue(Math.abs(knownArea - areaSum) < 1.0e-13);
    assert.isTrue(numFacetsA === numFacets, "facet count");
  });
});
