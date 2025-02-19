/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

import * as fs from "fs";
import { BentleyGeometryFlatBuffer } from "../../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { IndexedPolyfaceWalker } from "../../polyface/IndexedPolyfaceWalker";
import { IndexedPolyface } from "../../polyface/Polyface";
import { SerializationHelpers } from "../../serialization/SerializationHelpers";

describe("CrossPlatform", () => {
  // Verify that the typescript API can read flatbuffer and json files written by the typescript and native APIs.
  // Each test case consists of at least four files that encode the same single geometry: native-authored fb and json, typescript-authored fb and json
  // The same test exists in native geomlibs and operates on the same data files; these tests and data should be kept in sync.
  it("Equivalence", () => {
    const ck = new Checker();

    // fileNames[Platform][FileType] are names of files of given type written by the given platform
    interface TestCase { fileNames: string[][][] }
    enum Platform { Native = 0, TypeScript = 1 }
    enum FileType { FlatBuffer = 0, JSON = 1 }

    const root = "./src/test/data/crossPlatform/";
    const nativeRoot = `${root}native/`;
    const typeScriptRoot = `${root}typescript/`;

    const testCases: TestCase[] = [];
    let testName = "indexedMesh-auxData";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-auxData2";  // inspired by Scientific Visualization sandbox
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`, `${nativeRoot}${testName}-size3.fb`, `${nativeRoot}${testName}-size4.fb`, `${nativeRoot}${testName}-size5.fb`], [`${nativeRoot}${testName}.imjs`, `${nativeRoot}${testName}-size3.imjs`, `${nativeRoot}${testName}-size4.imjs`, `${nativeRoot}${testName}-size5.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-fixedSize";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });

    // TODO: add other test cases

    const geometry: GeometryQuery[] = [];
    const pushFirstDeserializedGeom = (fileName: string, fileType: FileType) => {
      const geom = FileType.FlatBuffer === fileType ? GeometryCoreTestIO.flatBufferFileToGeometry(fileName) : GeometryCoreTestIO.jsonFileToGeometry(fileName);
      if (ck.testDefined(geom, `deserialized ${fileName}`)) {
        let toPush: GeometryQuery | undefined;
        if (Array.isArray(geom)) {
          if (ck.testLE(1, geom.length, `deserialized at least one geometry from ${fileName}`))
            toPush = geom[0];
        } else {
          toPush = geom;
        }
        if (toPush)
          geometry.push(toPush);
      }
    };

    for (let iTestCase = 0; iTestCase < testCases.length; ++iTestCase) {
      geometry.length = 0;
      for (const platform of [Platform.Native, Platform.TypeScript]) {
        for (const fileType of [FileType.FlatBuffer, FileType.JSON]) {
          for (const fileName of testCases[iTestCase].fileNames[platform][fileType])
            pushFirstDeserializedGeom(fileName, fileType);
        }
      }
      if (ck.testLE(4, geometry.length, "have at least four geometries to compare")) {
        for (let i = 1; i < geometry.length; ++i)
          ck.testTrue(geometry[0].isAlmostEqual(geometry[i]), `testCase[${iTestCase}]: geom0 compares to geom${i}`);
      }
    }

    expect(ck.getNumErrors()).toBe(0);
  });

  it("TestCaseCtor", () => {
    const ck = new Checker(true, true);

    const mesh = IndexedPolyface.create();
    const vertices = [[0,0,0.7664205912849231], [0,0.5,0.48180614748985123], [0,0.25,0.802582585192784], [0.5,0,0.43491424436272463], [0.25,0,0.8188536774560378], [0,0.75,0.33952742318739915], [0.75,0,0.25206195068490395], [0.25,0.5,0.504569375013316], [0,1,0.2703371615911343], [1,0,0.10755755225803061], [0.25,0.75,0.2724132516081212], [0.5,0.25,0.5381121104277191], [0.5,0.5,0.3257620892806842], [0.5,0.75,0.04371942681056798], [0.25,1,0.2222400805896964], [0.25,0.25,1.1652833229746615], [1,0.25,0.23021761065562], [0.75,0.25,0.5893585652638186], [0.5,1,0.14597916468688915], [0.75,0.75,0.11596980253736251], [0.75,0.5,0.40804791637969084], [1,0.5,0.16102556400617096], [0.75,1,0.08104741694308121], [1,0.75,0.050360274157937215], [1,1,0.03586959238610449]];
    const oneBasedIndices = new Int32Array([1,5,16,3,0,5,4,12,16,0,4,7,18,12,0,7,10,17,18,0,3,16,8,2,0,16,12,13,8,0,12,18,21,13,0,18,17,22,21,0,2,8,11,6,0,8,13,14,11,0,13,21,20,14,0,21,22,24,20,0,6,11,15,9,0,11,14,19,15,0,14,20,23,19,0,20,24,25,23,0]);
    for (const v of vertices) mesh.addPointXYZ(v[0], v[1], v[2]);
    SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(oneBasedIndices, 1, (i, v) => mesh.addPointIndex(i, v), () => mesh.terminateFacet(false));

    if (ck.testDefined(mesh, "created mesh")) {
      IndexedPolyfaceWalker.buildEdgeMateIndices(mesh);

      const fbBytes = BentleyGeometryFlatBuffer.geometryToBytes(mesh, true);
      if (ck.testDefined(fbBytes, "exported to flatbuffer"))
        GeometryCoreTestIO.writeBytesToFile(fbBytes, "c:\\tmp\\typescript\\indexedMesh-topo-new.fb");

      const json = IModelJson.Writer.toIModelJson(mesh);
      fs.writeFileSync("c:\\tmp\\typescript\\indexedMesh-topo-new.imjs", JSON.stringify(json));
    }
    expect(ck.getNumErrors()).toBe(0);
  });
});
