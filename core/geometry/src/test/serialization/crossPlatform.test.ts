/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { describe, expect, it } from "vitest";
import { Matrix3d } from "../../core-geometry";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { BentleyGeometryFlatBuffer } from "../../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Cone } from "../../solid/Cone";
import { Sphere } from "../../solid/Sphere";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("CrossPlatform", () => {
  // fileNames[Platform][FileType] are names of files of given type written by the given platform
  interface TestCase { fileNames: string[][][] }
  enum Platform { Native = 0, TypeScript = 1 }
  enum FileType { FlatBuffer = 0, JSON = 1 }

  const root = "./src/test/data/crossPlatform/";
  const nativeRoot = `${root}native/`;
  const typeScriptRoot = `${root}typescript/`;

  // Verify that the typescript API can read flatbuffer and json files written by the typescript and native APIs.
  // Each test case consists of at least four files that encode the same single geometry: native-authored fb and json, typescript-authored fb and json
  // The same test exists in imodel-native geomlibs and operates on the same data files; these tests and data should be kept in sync.
  it("Equivalence", () => {
    const ck = new Checker();

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

  it("SolidPrimitives", () => {
    const ck = new Checker(true, true);

    const testCases: TestCase[] = [];
    for (const testName of ["sphere-nonuniform-scale", "sphere-skew-axes", "cone-elliptical-perp", "cone-elliptical-skew"])
      testCases.push({ fileNames: [[[`${nativeRoot}${testName}-new.fb`, `${nativeRoot}${testName}-old.fb`], [`${nativeRoot}${testName}-new.imjs`, `${nativeRoot}${testName}-old.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}-new.imjs`, `${typeScriptRoot}${testName}-old.imjs`]]] });

    // temp code to generate files
    const sphere0 = Sphere.createFromAxesAndScales(Point3d.createZero(), undefined, 1, 2, 3);
    const sphere1 = Sphere.createFromAxesAndScales(Point3d.createZero(), Matrix3d.createColumns(Vector3d.create(1, 1, 0.5), Vector3d.create(-1, 0.3, 0.4), Vector3d.create(0.1, 0, 1)), 1, 1, 1);
    const cone0 = Cone.createBaseAndTarget(Point3d.createZero(), Point3d.create(0, 0, 1), Vector3d.create(0.1, 0.1), Vector3d.create(-0.2, 0.2), 0.1, 0.2, true);
    const cone1 = Cone.createBaseAndTarget(Point3d.createZero(), Point3d.create(0, 0, 1), Vector3d.create(0.1, 0.2), Vector3d.create(-0.1, 0.2), 0.1, 0.2, true);
    const serialize = (geom: GeometryQuery | undefined, fileName: string) => {
      if (ck.testDefined(geom, "valid geometry")) {
        const fbBytes = BentleyGeometryFlatBuffer.geometryToBytes(geom, true);
        if (ck.testDefined(fbBytes, "exported to flatbuffer"))
          GeometryCoreTestIO.writeBytesToFile(fbBytes, `c:\\tmp\\typescript\\${fileName}.fb`);
        const json = IModelJson.Writer.toIModelJson(geom);
        if (ck.testDefined(json, "exported to json"))
          fs.writeFileSync(`c:\\tmp\\typescript\\${fileName}.imjs`, JSON.stringify(json));
      }
    };
    serialize(sphere0, "sphere-nonuniform-scale-new");
    serialize(sphere1, "sphere-skew-axes-new");
    serialize(cone0, "cone-elliptical-perp-new");
    serialize(cone1, "cone-elliptical-skew-new");

    // TODO:
    // fix native json serialization
    // fix native fb serialization -- needs fixing??
    // create old TS json/fb files
    // create new/old native json/fb files
    // move files to root for native/TS repos
    // add code here to verify for each testCase set:
    // * old.imjs files deserialize to same geometry A
    // * all new.imjs/fb files deserialize to the same geometry B
    // * A !== B
    // * new json files are a superset of old json files

    expect(ck.getNumErrors()).toBe(0);
  });

});
