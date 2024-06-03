/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

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

    expect(ck.getNumErrors()).equals(0);
  });
});
