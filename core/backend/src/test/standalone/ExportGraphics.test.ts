/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as fs from "fs";
import { Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import {
  Code, ColorDef, DbResult, FillDisplay, GeometryClass, GeometryParams, GeometryPartProps, GeometryStreamBuilder, GeometryStreamProps,
  ImageSourceFormat, IModel, LineStyle, PhysicalElementProps, Point2dProps, TextureMapProps, TextureMapUnits,
} from "@itwin/core-common";
import {
  Angle, Box, GeometryQuery, GrowableXYArray, GrowableXYZArray, LineSegment3d, LineString3d, Loop, Point3d, PolyfaceBuilder, Range3d, Sphere, StrokeOptions, Vector3d,
} from "@itwin/core-geometry";
import {
  ExportGraphics, ExportGraphicsInfo, ExportGraphicsMeshVisitor, ExportGraphicsOptions, GeometricElement, LineStyleDefinition, PhysicalObject,
  RenderMaterialElement, SnapshotDb, Texture,
} from "../../core-backend";
import { GeometryPart } from "../../Element";
import { ExportLinesInfo, ExportPartInfo, ExportPartInstanceInfo, ExportPartLinesInfo } from "../../ExportGraphics";
import { IModelTestUtils } from "../IModelTestUtils";

describe("exportGraphics", () => {
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
    return iModel.elements.insertElement(elementProps);
  }

  function insertRenderMaterialWithTexture(name: string, textureId: Id64String, patternScale?: Point2dProps, patternScaleMode?: TextureMapUnits): Id64String {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const props: TextureMapProps = { TextureId: textureId, pattern_offset: [0.0, 0.0] };
    if (patternScale)
      props.pattern_scale = patternScale;
    if (patternScaleMode)
      props.pattern_scalemode = patternScaleMode;
    return RenderMaterialElement.insert(iModel, IModel.dictionaryId, name, { paletteName: "test-palette", patternMap: props });
  }

  function insertRenderMaterial(name: string, colorDef: ColorDef): Id64String {
    const colors = colorDef.colors;
    return RenderMaterialElement.insert(iModel, IModel.dictionaryId, name, {
      paletteName: "test-palette",
      color: [colors.r / 255, colors.g / 255, colors.b / 255],
      transmit: colors.t / 255,
    });
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
    // Cube with one material attached to two faces and another material attached to other four faces
    const testBrepData: string = JSON.parse(
      fs.readFileSync(IModelTestUtils.resolveAssetFile("brep-face-symb.json"), { encoding: "utf8" }),
    ).data;
    builder.appendBRepData({
      data: testBrepData,
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

  it("resolves material face symbology correctly", () => {
    const materialColor0 = ColorDef.fromString("honeydew").withTransparency(80);
    const materialId0 = insertRenderMaterial("test-material-0", materialColor0);

    const materialColor1 = ColorDef.fromString("wheat").withTransparency(240);
    const materialId1 = insertRenderMaterial("test-material-1", materialColor1);

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = ColorDef.fromString("peachPuff"); // line color should be superceded by material color
    builder.appendGeometryParamsChange(geometryParams);
    const testBrepData: string = JSON.parse(
      fs.readFileSync(IModelTestUtils.resolveAssetFile("brep-face-symb.json"), { encoding: "utf8" }),
    ).data;
    builder.appendBRepData({
      // Cube with one material attached to two faces and another material attached to other four faces
      data: testBrepData,
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

  let textureIdString: undefined | string;
  function getTextureId(): string {
    if (textureIdString !== undefined)
      return textureIdString;
    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
    // bottom right pixel.  The rest of the square is red.
    const pngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217,
      74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252,
      97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65,
      84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0,
      0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
    return textureIdString = Texture.insertTexture(iModel, IModel.dictionaryId, "test-texture", ImageSourceFormat.Png, pngData);
  }

  it("handles materials with textures", () => {
    const textureId = getTextureId();
    const materialId = insertRenderMaterialWithTexture("test-material-2", textureId);
    const elementColor = ColorDef.fromString("aquamarine");

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.materialId = materialId;
    geometryParams.lineColor = elementColor; // element color should still come through with no material color set
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
    assert.strictEqual(infos[0].textureId, textureId);
    assert.strictEqual(infos[0].color, elementColor.tbgr);
  });

  it("creates meshes with expected parameters", () => {
    const makeTriangle = (data: Float32Array, i0: number, i1: number, i2: number, dim: 2 | 3): number[] => {
      const tri: number[] = [];
      for (const i of [i0, i1, i2])
        for (let j = 0; j < dim; ++j)
          tri.push(data[dim * i + j]);
      return tri;
    };

    const makeFacet = (builder: PolyfaceBuilder, xyz: Float32Array, normals: Float32Array, uv: Float32Array, i0: number, i1: number, i2: number) => {
      builder.addFacetFromGrowableArrays(
        GrowableXYZArray.create(makeTriangle(xyz, i0, i1, i2, 3)),
        GrowableXYZArray.create(makeTriangle(normals, i0, i1, i2, 3)),
        GrowableXYArray.create(makeTriangle(uv, i0, i1, i2, 2)),
        undefined, // no colors
      );
    };

    const negateV = (param: number, index: number): number => {
      return (index % 2) ? 1 - param : param;
    };

    const unNegateV = (param: number, index: number): number => {
      return (index % 2) ? 2 - param : param;
    };

    /** return 2x2 array of uvParams: [vNegate][meters] given raw uv and the [1][1] entry */
    const mutateUV = (uvRaw: Float32Array, uvVNegatedMeters: Float32Array): Float32Array[][] => {
      const uvArray: Float32Array[][] = [[],[]];
      uvArray[1].push(Float32Array.from(uvRaw, negateV));
      uvArray[1].push(uvVNegatedMeters);
      for (let i = 0; i < 2; ++i)
        uvArray[0].push(Float32Array.from(uvArray[1][i], unNegateV));
      return uvArray;
    };

    const materials: Id64String[][] = [["",""],["",""]];
    const getMaterial = (vNegate: boolean, meters: boolean): Id64String => {
      const i = vNegate ? 1 : 0;
      const j = meters ? 1 : 0;
      if (materials[i][j] !== "")
        return materials[i][j];
      const matName = `test-material-${vNegate ? `vScaleMinus1` : `vScale1`}-${meters ? `meters` : `relative`}`;
      const matScale = vNegate ? [1, -1] : [1, 1];
      const matUnits = meters ? TextureMapUnits.Meters : TextureMapUnits.Relative;
      return materials[i][j] = insertRenderMaterialWithTexture(matName, getTextureId(), matScale, matUnits);
    };

    const triangleBuilder = PolyfaceBuilder.create();
    triangleBuilder.options.needParams = triangleBuilder.options.needNormals = true;
    const triangleIndices = new Int32Array([0, 1, 2]);
    const triangleXYZ = new Float32Array([1, 0, 1, 0, 0, -1, -1, 0, 1]);
    const triangleNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const triangleUV = new Float32Array([1, 1, 0, 0, 0, 1]);
    const triangleUVScaled = new Float32Array([2, 1 - Math.sqrt(5), 0, 1, 0, 1 - Math.sqrt(5)]);
    for (let i = 0; i < triangleIndices.length; i += 3)
      makeFacet(triangleBuilder, triangleXYZ, triangleNormals, triangleUV, triangleIndices[i], triangleIndices[i + 1], triangleIndices[i + 2]);
    const triangle = triangleBuilder.claimPolyface();
    const triangleParams = mutateUV(triangleUV, triangleUVScaled);

    const cubeBuilder = PolyfaceBuilder.create();
    cubeBuilder.options.needParams = cubeBuilder.options.needNormals = true;
    const cubeIndices = new Int32Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7, 8, 9, 10, 10, 9, 11, 12, 13, 14, 14, 13, 15, 16, 17, 18, 18, 17, 19, 20, 21, 22, 22, 21, 23]);
    const cubeXYZ = new Float32Array([-1, 1, -1, -1, 1, 1, 1, 1, -1, 1, 1, 1, 1, 1, 1, -1, 1, 1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, -1, -1, -1, 1, 1, 1, -1, 1, 1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, 1, 1, -1, -1, -1, -1, 1, -1, -1]);
    const cubeNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
    const cubeUV = new Float32Array([0.875, 0.5, 0.875, 0.25, 0.625, 0.5, 0.625, 0.25, 0.625, 0.25, 0.625, 0, 0.375, 0.25, 0.375, 0, 0.625, 1, 0.625, 0.75, 0.375, 1, 0.375, 0.75, 0.375, 0.5, 0.375, 0.25, 0.125, 0.5, 0.125, 0.25, 0.625, 0.5, 0.625, 0.25, 0.375, 0.5, 0.375, 0.25, 0.625, 0.75, 0.625, 0.5, 0.375, 0.75, 0.375, 0.5]);
    const cubeUVScaled = new Float32Array([5.25, -3, 5.25, -1, 3.75, -3, 3.75, -1, 3.75, -1, 3.75, 1, 2.25, -1, 2.25, 1, 3.75, -7, 3.75, -5, 2.25, -7, 2.25, -5, 2.25, -3, 2.25, -1, 0.75, -3, 0.75, -1, 3.75, -3, 3.75, -1, 2.25, -3, 2.25, -1, 3.75, -5, 3.75, -3, 2.25, -5, 2.25, -3]);
    for (let i = 0; i < cubeIndices.length; i += 3)
      makeFacet(cubeBuilder, cubeXYZ, cubeNormals, cubeUV, cubeIndices[i], cubeIndices[i + 1], cubeIndices[i + 2]);
    const cube = cubeBuilder.claimPolyface();
    const cubeParams = mutateUV(cubeUV, cubeUVScaled);

    const testUVParamExport = (geomId: Id64String, expectedParams: Float32Array) => {
      const infos: ExportGraphicsInfo[] = [];
      const exportGraphicsOptions: ExportGraphicsOptions = {
        elementIdArray: [geomId],
        onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      };
      const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
      assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
      assert.strictEqual(infos.length, 1);
      assert.strictEqual(infos[0].mesh.params.length, expectedParams.length);
      assert.deepStrictEqual(infos[0].mesh.params, expectedParams, "exported params as expected");
    };

    const testMeshWithTexture = (geom: GeometryQuery, expectedUV: Float32Array, material: string) => {
      const streamBuilder = new GeometryStreamBuilder();
      const geometryParams = new GeometryParams(seedCategory);
      geometryParams.materialId = material;
      streamBuilder.appendGeometryParamsChange(geometryParams);
      streamBuilder.appendGeometry(geom);
      const geomId = insertPhysicalElement(streamBuilder.geometryStream);
      testUVParamExport(geomId, expectedUV);
    };

    const testMesh = (geom: GeometryQuery, expectedParams: Float32Array[][]) => {
      for (const vNegate of [false, true])
        for (const meters of [false, true])
          testMeshWithTexture(geom, expectedParams[vNegate ? 1 : 0][meters ? 1 : 0], getMaterial(vNegate, meters));
    };

    testMesh(triangle, triangleParams);
    testMesh(cube, cubeParams);
  });

  it("export elements from local bim file", () => {
    // edit these values to run
    const outBimFileName: string = "out.bim"; // will be written to core\backend\lib\cjs\test\output\ExportGraphics
    const inBimFilePathName: string = "";     // e.g., 'd:\\foo.bim'
    const elementIds: Id64Array = [];         // e.g., ["0x2000000000c", "0x2000000000a"]

    if (outBimFileName !== "" && inBimFilePathName !== "" && elementIds.length > 0) {
      const testFileName = IModelTestUtils.prepareOutputFile("ExportGraphics", outBimFileName);
      const myIModel = IModelTestUtils.createSnapshotFromSeed(testFileName, inBimFilePathName);
      const infos: ExportGraphicsInfo[] = [];
      const exportGraphicsOptions: ExportGraphicsOptions = {
        elementIdArray: elementIds,
        onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      };
      if (DbResult.BE_SQLITE_OK === myIModel.exportGraphics(exportGraphicsOptions)) {
        // examine infos here
      }
      myIModel.close();
    }
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

  it("creates line graphics as expected", () => {
    const elementColor = ColorDef.fromString("blanchedAlmond");
    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.lineColor = elementColor;
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(LineString3d.createPoints([Point3d.createZero(), Point3d.create(1, 0, 0)]));

    const newId = insertPhysicalElement(builder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const lineInfos: ExportLinesInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
      onLineGraphics: (lineInfo: ExportLinesInfo) => lineInfos.push(lineInfo),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 0);
    assert.strictEqual(lineInfos.length, 1);
    assert.strictEqual(lineInfos[0].color, elementColor.tbgr);
    assert.deepStrictEqual(Array.from(lineInfos[0].lines.indices), [0, 1]);
    assert.deepStrictEqual(Array.from(lineInfos[0].lines.points), [0, 0, 0, 1, 0, 0]);
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

    assert.deepStrictEqual(Array.from(infos[0].mesh.indices), [0, 1, 2, 1, 0, 3]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.points), [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
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

  it("applies chordTol", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const newId = insertPhysicalElement(builder.geometryStream);

    const coarseInfos: ExportGraphicsInfo[] = [];
    iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => coarseInfos.push(info),
      chordTol: 1,
    });

    const fineInfos: ExportGraphicsInfo[] = [];
    iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => fineInfos.push(info),
      chordTol: 0.001,
    });

    assert.strictEqual(coarseInfos.length, 1);
    assert.strictEqual(fineInfos.length, 1);
    assert.isTrue(coarseInfos[0].mesh.indices.length < fineInfos[0].mesh.indices.length);
  });

  it("applies angleTol", () => {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 1));
    const newId = insertPhysicalElement(builder.geometryStream);

    const coarseInfos: ExportGraphicsInfo[] = [];
    iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => coarseInfos.push(info),
      angleTol: 30 * Angle.radiansPerDegree,
    });

    const fineInfos: ExportGraphicsInfo[] = [];
    iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => fineInfos.push(info),
      angleTol: 15 * Angle.radiansPerDegree,
    });

    assert.strictEqual(coarseInfos.length, 1);
    assert.strictEqual(fineInfos.length, 1);
    assert.isTrue(coarseInfos[0].mesh.indices.length < fineInfos[0].mesh.indices.length);
  });

  it("applies decimationTol", () => {
    const strokeOptions = StrokeOptions.createForCurves();
    strokeOptions.chordTol = 0.001;
    const polyfaceBuilder = PolyfaceBuilder.create(strokeOptions);
    polyfaceBuilder.addSphere(Sphere.createCenterRadius(Point3d.createZero(), 1));

    const gsBuilder = new GeometryStreamBuilder();
    gsBuilder.appendGeometry(polyfaceBuilder.claimPolyface());
    const newId = insertPhysicalElement(gsBuilder.geometryStream);

    const noDecimationInfos: ExportGraphicsInfo[] = [];
    const noDecimationStatus = iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => noDecimationInfos.push(info),
    });

    assert.strictEqual(noDecimationStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(noDecimationInfos.length, 1);

    const decimationInfos: ExportGraphicsInfo[] = [];
    const decimationStatus = iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => decimationInfos.push(info),
      decimationTol: 0.1,
    });

    assert.strictEqual(decimationStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(decimationInfos.length, 1);
    assert.isTrue(decimationInfos[0].mesh.indices < noDecimationInfos[0].mesh.indices);
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

  it("applies minBRepFeatureSize", () => {
    const builder = new GeometryStreamBuilder();
    // 4x4x4m slab with a ~1x1x1cm slab cut out of it.
    const testBrep: { data: string } = JSON.parse(
      fs.readFileSync(IModelTestUtils.resolveAssetFile("brep-small-feature.json"), { encoding: "utf8" }),
    );
    builder.appendBRepData(testBrep);
    const newId = insertPhysicalElement(builder.geometryStream);

    const noMinSizeInfos: ExportGraphicsInfo[] = [];
    const noMinSizeStatus = iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => noMinSizeInfos.push(info),
    });
    assert.strictEqual(noMinSizeStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(noMinSizeInfos.length, 1);

    const minSizeInfos: ExportGraphicsInfo[] = [];
    const minSizeStatus = iModel.exportGraphics({
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => minSizeInfos.push(info),
      minBRepFeatureSize: 0.1,
    });
    assert.strictEqual(minSizeStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(minSizeInfos.length, 1);

    assert.strictEqual(minSizeInfos[0].mesh.indices.length, 36); // should be a simple cube
    assert.isTrue(minSizeInfos[0].mesh.indices.length < noMinSizeInfos[0].mesh.indices.length);
  });

  it("applies minLineStyleComponentSize", () => {
    const partBuilder = new GeometryStreamBuilder();
    const partParams = new GeometryParams(Id64.invalid); // category won't be used

    // Create line style with small component - logic copied from line style tests in GeometryStream.test.ts
    partParams.fillDisplay = FillDisplay.Always;
    partBuilder.appendGeometryParamsChange(partParams);
    partBuilder.appendGeometry(Loop.create(LineString3d.create(Point3d.create(0.1, 0, 0), Point3d.create(0, -0.05, 0), Point3d.create(0, 0.05, 0), Point3d.create(0.1, 0, 0))));
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const geomPartId = iModel.elements.insertElement(partProps);

    const pointSymbolData = LineStyleDefinition.Utils.createPointSymbolComponent(iModel, { geomPartId }); // base and size will be set automatically...
    assert.isTrue(undefined !== pointSymbolData);

    const strokePointData = LineStyleDefinition.Utils.createStrokePointComponent(iModel, { descr: "TestArrowHead", lcId: 0, lcType: LineStyleDefinition.ComponentType.Internal, symbols: [{ symId: pointSymbolData!.compId, strokeNum: -1, mod1: LineStyleDefinition.SymbolOptions.CurveEnd }] });
    assert.isTrue(undefined !== strokePointData);

    const compoundData = LineStyleDefinition.Utils.createCompoundComponent(iModel, { comps: [{ id: strokePointData.compId, type: strokePointData.compType }, { id: 0, type: LineStyleDefinition.ComponentType.Internal }] });
    assert.isTrue(undefined !== compoundData);

    const styleId = LineStyleDefinition.Utils.createStyle(iModel, IModel.dictionaryId, "TestArrowStyle", compoundData);
    assert.isTrue(Id64.isValidId64(styleId));

    const builder = new GeometryStreamBuilder();
    const geometryParams = new GeometryParams(seedCategory);
    geometryParams.styleInfo = new LineStyle.Info(styleId);
    builder.appendGeometryParamsChange(geometryParams);
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(10, 10, 0)));
    const elementId = insertPhysicalElement(builder.geometryStream);

    // Should include everything with no minimum component size
    const noMinInfos: ExportGraphicsInfo[] = [];
    const noMinLineInfos: ExportLinesInfo[] = [];
    let exportStatus = iModel.exportGraphics({
      elementIdArray: [elementId],
      onGraphics: (info: ExportGraphicsInfo) => noMinInfos.push(info),
      onLineGraphics: (lineInfo: ExportLinesInfo) => noMinLineInfos.push(lineInfo),
    });
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(noMinInfos.length, 1);
    assert.strictEqual(noMinLineInfos.length, 1);
    assert.strictEqual(noMinInfos[0].mesh.indices.length, 3);
    assert.strictEqual(noMinLineInfos[0].lines.indices.length, 2);

    // Should filter out arrow shape with large minimum component size
    const largeMinInfos: ExportGraphicsInfo[] = [];
    const largeMinLineInfos: ExportLinesInfo[] = [];
    exportStatus = iModel.exportGraphics({
      elementIdArray: [elementId],
      onGraphics: (info: ExportGraphicsInfo) => largeMinInfos.push(info),
      onLineGraphics: (lineInfo: ExportLinesInfo) => largeMinLineInfos.push(lineInfo),
      minLineStyleComponentSize: 0.5,
    });
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(largeMinInfos.length, 0);
    assert.strictEqual(largeMinLineInfos.length, 1);
    assert.strictEqual(largeMinLineInfos[0].lines.indices.length, 2);

    // Should include arrow shape with small minimum component size
    const smallMinInfos: ExportGraphicsInfo[] = [];
    const smallMinLineInfos: ExportLinesInfo[] = [];
    exportStatus = iModel.exportGraphics({
      elementIdArray: [elementId],
      onGraphics: (info: ExportGraphicsInfo) => smallMinInfos.push(info),
      onLineGraphics: (lineInfo: ExportLinesInfo) => smallMinLineInfos.push(lineInfo),
      minLineStyleComponentSize: 0.01,
    });
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(smallMinInfos.length, 1);
    assert.strictEqual(smallMinLineInfos.length, 1);
    assert.strictEqual(smallMinInfos[0].mesh.indices.length, 3);
    assert.strictEqual(smallMinLineInfos[0].lines.indices.length, 2);
  });

  it("applies GeometryPart transforms as expected", () => {
    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Loop.createPolygon([Point3d.createZero(), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0)]));
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const partId = iModel.elements.insertElement(partProps);

    const partInstanceBuilder = new GeometryStreamBuilder();
    partInstanceBuilder.appendGeometryPart3d(partId, Point3d.create(7, 8, 9));
    const partInstanceId = insertPhysicalElement(partInstanceBuilder.geometryStream);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [partInstanceId],
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

    assert.deepStrictEqual(Array.from(infos[0].mesh.indices), [0, 1, 2, 1, 0, 3]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.points), [8, 8, 9, 7, 9, 9, 7, 8, 9, 8, 9, 9]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    assert.deepStrictEqual(Array.from(infos[0].mesh.params), [1, 0, 0, 1, 0, 0, 1, 1]);
  });

  it("exposes instances through partInstanceArray and exportPartGraphics", () => {
    const partBuilder = new GeometryStreamBuilder();
    partBuilder.appendGeometry(Loop.createPolygon([Point3d.createZero(), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0), Point3d.create(0, 1, 0)]));
    const partProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: IModel.dictionaryId,
      code: Code.createEmpty(),
      geom: partBuilder.geometryStream,
    };
    const partId = iModel.elements.insertElement(partProps);

    const partInstanceBuilder = new GeometryStreamBuilder();
    partInstanceBuilder.appendGeometryPart3d(partId, Point3d.create(7, 8, 9));
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

    assert.strictEqual(partInstanceArray[0].partId, partId);
    assert.strictEqual(partInstanceArray[0].partInstanceId, partInstanceId);
    assert.isDefined(partInstanceArray[0].transform);
    assert.deepStrictEqual(Array.from(partInstanceArray[0].transform!), [1, 0, 0, 7, 0, 1, 0, 8, 0, 0, 1, 9]);

    const partInfos: ExportPartInfo[] = [];
    const exportPartStatus = iModel.exportPartGraphics({
      elementId: partInstanceArray[0].partId,
      displayProps: partInstanceArray[0].displayProps,
      onPartGraphics: (partInfo) => partInfos.push(partInfo),
    });

    assert.strictEqual(exportPartStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(partInfos.length, 1);

    // The ordering of these values is arbitrary, but should be consistent between runs.
    // Baselines may need to be updated if native GeomLibs is refactored, but:
    //   * Lengths of all fields should remain the same
    //   * Actual point, normal and param values should remain the same
    assert.strictEqual(partInfos[0].mesh.indices.length, 6);
    assert.strictEqual(partInfos[0].mesh.points.length, 12);
    assert.strictEqual(partInfos[0].mesh.normals.length, 12);
    assert.strictEqual(partInfos[0].mesh.params.length, 8);

    assert.deepStrictEqual(Array.from(partInfos[0].mesh.indices), [0, 1, 2, 1, 0, 3]);
    assert.deepStrictEqual(Array.from(partInfos[0].mesh.points), [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0]);
    assert.deepStrictEqual(Array.from(partInfos[0].mesh.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    assert.deepStrictEqual(Array.from(partInfos[0].mesh.params), [1, 0, 0, 1, 0, 0, 1, 1]);
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

  it("creates output for mesh without zero blocking", () => {
    const meshWithoutBlocking: GeometryStreamProps = JSON.parse(`[{
      "indexedMesh": {
        "numPerFace": 3,
        "expectedClosure": 0,
        "point": [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0]
        ],
        "pointIndex": [1, 2, 3, 1, 3, 4],
        "normal": [[0, 0, 1]],
        "normalIndex": [1, 1, 1, 1, 1, 1]
      }
    }]`);
    const newId = insertPhysicalElement(meshWithoutBlocking);

    const infos: ExportGraphicsInfo[] = [];
    const exportGraphicsOptions: ExportGraphicsOptions = {
      elementIdArray: [newId],
      onGraphics: (info: ExportGraphicsInfo) => infos.push(info),
    };

    const exportStatus = iModel.exportGraphics(exportGraphicsOptions);
    assert.strictEqual(exportStatus, DbResult.BE_SQLITE_OK);
    assert.strictEqual(infos.length, 1);
    assert.strictEqual(infos[0].elementId, newId);
    assert.strictEqual(infos[0].mesh.indices.length, 6);
  });

});
