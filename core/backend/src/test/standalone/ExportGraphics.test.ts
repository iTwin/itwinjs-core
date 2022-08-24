/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import {
  Code, ColorDef, DbResult, GeometryClass, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamProps, IModel,
  PhysicalElementProps,
} from "@itwin/core-common";
import { Box, LineString3d, Loop, Point3d, Range3d, Sphere, Vector3d } from "@itwin/core-geometry";
import {
  ExportGraphics, ExportGraphicsInfo, ExportGraphicsMeshVisitor, ExportGraphicsOptions, GeometricElement, PhysicalObject, RenderMaterialElement,
  SnapshotDb,
} from "../../core-backend";
import { GeometryPart } from "../../Element";
import { ExportLinesInfo, ExportPartInfo, ExportPartInstanceInfo, ExportPartLinesInfo } from "../../ExportGraphics";
import { IModelTestUtils } from "../IModelTestUtils";

// Created in MicroStation, then dumped for use here.
// This is a slab with two different face symbologies: one assigned to 2 faces, the other assigned to 4 faces
const BREP_WITH_FACE_ATTACHMENT = "encoding=base64;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";

describe.only("exportGraphics", () => {
  let iModel: SnapshotDb;
  let seedModel: Id64String;
  let seedCategory: Id64String;

  function insertPhysicalElement(geometryStream: GeometryStreamProps): Id64String {
    const elementProps: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: seedModel,
      category: seedCategory,
      code: Code.createEmpty(),
      geom: geometryStream,
    };
    const newId = iModel.elements.insertElement(elementProps);
    iModel.saveChanges();
    return newId;
  }

  function insertRenderMaterial(name: string, colorDef: ColorDef): Id64String {
    const colors = colorDef.colors;
    const matParams: RenderMaterialElement.Params = {
      paletteName: "test-palette",
      color: [colors.r / 255, colors.g / 255, colors.b / 255],
      transmit: colors.t / 255,
    };

    return RenderMaterialElement.insert(iModel, IModel.dictionaryId, name, matParams);
  }

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ExportGraphics", "ExportGraphicsTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

    // Get known model/category from seed element a la GeometryStream.test.ts
    const seedElement = iModel.elements.getElement<GeometricElement>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    seedModel = seedElement.model;
    seedCategory = seedElement.category;
  });

  after(() => {
    iModel.close();
  });

  it("resolves element color correctly", () => {
    const elementColor = ColorDef.fromString("cadetBlue");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = elementColor;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const geometricElementId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [geometricElementId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].elementId, geometricElementId);
    assert.strictEqual(infos[0].color, elementColor.tbgr);
  });

  it("resolves material color and transparency correctly", () => {
    const materialColor = ColorDef.fromString("honeydew").withTransparency(80);
    const materialId = insertRenderMaterial("test-material", materialColor);

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = ColorDef.fromString("rebeccaPurple"); // line color should be superceded by material color
    geometryParams.materialId = materialId;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const geometricElementId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [geometricElementId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].elementId, geometricElementId);
    assert.strictEqual(infos[0].materialId, materialId);
    assert.strictEqual(infos[0].color, materialColor.tbgr);
    assert.isUndefined(infos[0].textureId);
  });

  it("resolves color face symbology correctly", () => {
    const color0 = ColorDef.fromString("sienna");
    const color1 = ColorDef.fromString("plum");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = ColorDef.fromString("peachPuff"); // line color should be superceded by face color
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendBRepData({
      // Cube with one material attached to two faces and another material attached to other four faces
      data: BREP_WITH_FACE_ATTACHMENT,
      faceSymbology: [
        { color: color0.toJSON() },
        { color: color1.toJSON() },
      ],
    });
    const geometricElementId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [geometricElementId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    // 4 faces of slab have color1, 2 faces have color0.
    // Triangulated, should split into info with 24 indices and info with 12 indices.
    assert.strictEqual(infos.length, 2);
    assert.strictEqual(infos[0].elementId, geometricElementId);
    assert.strictEqual(infos[0].mesh.indices.length, 24);
    assert.strictEqual(infos[0].color, color1.tbgr);
    assert.strictEqual(infos[1].elementId, geometricElementId);
    assert.strictEqual(infos[1].mesh.indices.length, 12);
    assert.strictEqual(infos[1].color, color0.tbgr);
  });

  // Skipping due to https://github.com/iTwin/itwinjs-core/issues/4184
  it.skip("resolves material face symbology correctly", () => {
    const materialColor0 = ColorDef.fromString("honeydew").withTransparency(80);
    const materialId0 = insertRenderMaterial("test-material-0", materialColor0);

    const materialColor1 = ColorDef.fromString("wheat").withTransparency(240);
    const materialId1 = insertRenderMaterial("test-material-1", materialColor1);

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = ColorDef.fromString("peachPuff"); // line color should be superceded by material color
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendBRepData({
      // Cube with one material attached to two faces and another material attached to other four faces
      data: BREP_WITH_FACE_ATTACHMENT,
      faceSymbology: [
        { materialId: materialId0 },
        { materialId: materialId1 },
      ],
    });
    const geometricElementId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [geometricElementId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 2);
    // 4 faces of slab have material1, 2 faces have material0.
    // Triangulated, should split into info with 24 indices and info with 12 indices.
    assert.strictEqual(infos.length, 2);
    assert.strictEqual(infos[0].elementId, geometricElementId);
    assert.strictEqual(infos[0].mesh.indices.length, 24);
    assert.strictEqual(infos[0].color, materialColor1.tbgr);
    assert.strictEqual(infos[1].elementId, geometricElementId);
    assert.strictEqual(infos[1].mesh.indices.length, 12);
    assert.strictEqual(infos[1].color, materialColor0.tbgr);
  });

  it("creates meshes with vertices shared as expected", () => {
    const builder = new GeometryStreamBuilder();
    // 1, 1, 1 box
    const box = Box.createDgnBox(Point3d.createZero(), Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), Point3d.create(0, 0, 1), 1, 1, 1, 1, true);
    assert.isDefined(box);
    builder.appendGeometry(box!);
    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    // exportGraphics is expected to compress vertices to share them where point, normal and param are all equal.
    // So, given a triangulated box, the two vertices along the diagonal should be shared inside the face (where the normal matches)
    // but not across any of the neighboring perpendicular faces.
    // For a box, 6 faces with 4 unique vertices each made up of 3 (xyz) values means we should expect points.length === 72
    // Without compression, we'd expect to see points.length === 108
    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    const numUniqueVertices = 24;
    assert.strictEqual(infos[0].mesh.points.length, numUniqueVertices * 3);
    assert.strictEqual(infos[0].mesh.normals.length, numUniqueVertices * 3);
    assert.strictEqual(infos[0].mesh.params.length, numUniqueVertices * 2);
  });

  it("process multiple elements in one call", () => {
    const builder0 = new GeometryStreamBuilder();
    builder0.appendGeometry(Loop.createPolygon([Point3d.createZero(), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0)]));
    const id0 = insertPhysicalElement(builder0.geometryStream);

    const builder1 = new GeometryStreamBuilder();
    builder1.appendGeometry(Loop.createPolygon([Point3d.createZero(), Point3d.create(-1, 0, 0), Point3d.create(-1, -1, 0), Point3d.create(0, -1, 0)]));
    const id1 = insertPhysicalElement(builder1.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [id0, id1],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 2);
    // Sorting since output order is arbitrary
    assert.deepStrictEqual([infos[0].elementId, infos[1].elementId].sort(), [id0, id1].sort());
  });

  it("produces expected indices, points, normals, params in smoketest", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Loop.createPolygon([Point3d.createZero(), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0)]));
    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);

    // The ordering of these values is arbitrary, but should be consistent between runs.
    // Baselines may need to be updated if native GeomLibs is refactored, but:
    //   * Lengths of all fields should remain the same
    //   * Actual point, normal and param values should remain the same
    assert.strictEqual(infos[0].mesh.indices.length, 6);
    assert.strictEqual(infos[0].mesh.points.length, 12);
    assert.strictEqual(infos[0].mesh.normals.length, 12);
    assert.strictEqual(infos[0].mesh.params.length, 8);

    assert.deepStrictEqual(Array.from(infos[0].mesh.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.indices), [0, 1, 2, 1, 0, 3]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.points), [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.params), [1, 0, 0, 1, 0, 0, 1, 1]);
  });

  it("sets two-sided flag correctly for closed geometry", () => {
    const builder = new GeometryStreamBuilder();
    const box = Box.createDgnBox(Point3d.createZero(), Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), Point3d.create(0, 0, 1), 1, 1, 1, 1, true);
    assert.isDefined(box);
    builder.appendGeometry(box!);
    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.isFalse(infos[0].mesh.isTwoSided);
  });

  it("sets two-sided flag correctly for open geometry", () => {
    const builder = new GeometryStreamBuilder();
    const quad = Loop.createPolygon([Point3d.createZero(), Point3d.create(2, 0, 0), Point3d.create(2, 2, 0), Point3d.create(0, 2, 0)]);
    builder.appendGeometry(quad);
    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.isTrue(infos[0].mesh.isTwoSided);
  });

  it("applies maxEdgeLength", () => {
    const builder = new GeometryStreamBuilder();
    const quad = Loop.createPolygon([Point3d.createZero(), Point3d.create(2, 0, 0), Point3d.create(2, 2, 0), Point3d.create(0, 2, 0)]);
    builder.appendGeometry(quad);
    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      maxEdgeLength: 1,
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.isTrue(infos[0].mesh.indices.length > 6); // not validating particulars of subdivision, just that the option is applied
  });

  it("handles single geometryClass in GeometryStream", () => {
    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const newId = insertPhysicalElement(builder.geometryStream);

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

  it("handles multiple geometryClass in GeometryStream", () => {
    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);

    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));

    geometryParams.geometryClass = GeometryClass.Primary;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true)!);

    const newId = insertPhysicalElement(builder.geometryStream);

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

  it("handles geometryClass in lines", () => {
    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);

    geometryParams.geometryClass = GeometryClass.Construction;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(LineString3d.createPoints([Point3d.createZero(), Point3d.create(1, 0, 0)]));

    const newId = insertPhysicalElement(builder.geometryStream);

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

  it("handles geometryClass defined in parts", () => {
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
    const partInstanceId = insertPhysicalElement(partInstanceBuilder.geometryStream);

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

  it("handles geometryClass defined outside parts", () => {
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
    const partInstanceGeometryParams = new GeometryParams(seedCategory);
    partInstanceGeometryParams.geometryClass = GeometryClass.Construction;
    partInstanceBuilder.appendGeometryParamsChange(partInstanceGeometryParams);
    partInstanceBuilder.appendGeometryPart3d(partId);
    const partInstanceId = insertPhysicalElement(partInstanceBuilder.geometryStream);

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

  it("handles geometryClass for lines in parts", () => {
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
    const partInstanceId = insertPhysicalElement(partInstanceBuilder.geometryStream);

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

  it("converts to IndexedPolyface", () => {
    const box = Box.createRange(Range3d.create(Point3d.createZero(), Point3d.create(1.0, 1.0, 1.0)), true);
    assert.isFalse(undefined === box);

    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(box!);

    const newId = insertPhysicalElement(builder.geometryStream);

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
  it("ExportMeshGraphicsVisitor", () => {
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
