/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { describe, expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { BentleyGeometryFlatBuffer } from "../../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Cone } from "../../solid/Cone";
import { Sphere } from "../../solid/Sphere";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

describe("CrossPlatform", () => {
  interface TestCase {
    // fileNames[Platform][FileType] is an array of relative pathnames of FileType files written by Platform
    fileNames: string[][][],
  }
  enum Platform { Native = 0, TypeScript = 1 }
  enum FileType { FlatBuffer = 0, JSON = 1 }

  const root = "./src/test/data/crossPlatform/";
  const nativeRoot = `${root}native/`;
  const typeScriptRoot = `${root}typescript/`;

  const deserializeFirstGeom = (fileName: string, fileType: FileType): GeometryQuery | undefined => {
    let geom: GeometryQuery | GeometryQuery[] | undefined;
    if (FileType.FlatBuffer === fileType)
      geom = GeometryCoreTestIO.flatBufferFileToGeometry(fileName);
    else if (FileType.JSON === fileType)
      geom = GeometryCoreTestIO.jsonFileToGeometry(fileName);
    if (!geom)
      return undefined;
    if (!Array.isArray(geom))
      return geom;
    if (geom.length >= 1)
      return geom[0];
    return undefined;
  };

  const jsonIsContained = (subset: any, superset: any, matchValues: boolean = true): boolean => {
    if (subset == null) // i.e., is null or undefined
      return true;
    if (typeof subset !== "object" || typeof superset !== "object")
      return false;
    for (const key of Object.keys(subset)) {
      if (!superset.hasOwnProperty(key))
        return false;
      if (typeof subset[key] === "object") {
        if (!jsonIsContained(subset[key], superset[key], matchValues))
          return false;
      } else if (matchValues && subset[key] !== superset[key])
        return false;
    }
    return true;
  };

  // Verify that the typescript API can read flatbuffer and json files written by the typescript and native APIs.
  // Each test case consists of at least four files that encode the same single geometry: native-authored fb and json, typescript-authored fb and json
  // The same test exists in imodel-native geomlibs and operates on the same data files; these tests and data should be kept in sync.
  it("IndexedMeshAuxData", () => {
    const ck = new Checker();

    const testCases: TestCase[] = [];
    let testName = "indexedMesh-auxData";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-auxData2";  // inspired by Scientific Visualization sandbox
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`, `${nativeRoot}${testName}-size3.fb`, `${nativeRoot}${testName}-size4.fb`, `${nativeRoot}${testName}-size5.fb`], [`${nativeRoot}${testName}.imjs`, `${nativeRoot}${testName}-size3.imjs`, `${nativeRoot}${testName}-size4.imjs`, `${nativeRoot}${testName}-size5.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-fixedSize";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });

    // TODO: add other test cases

    for (let iTestCase = 0; iTestCase < testCases.length; ++iTestCase) {
      const geometry: GeometryQuery[] = [];

      // deserialize and collect all geometries
      for (const platform of [Platform.Native, Platform.TypeScript]) {
        for (const fileType of [FileType.FlatBuffer, FileType.JSON]) {
          for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) {
            const geom = deserializeFirstGeom(fileName, fileType);
            if (ck.testDefined(geom, `deserialized at least one geometry from ${fileName}`))
              geometry.push(geom);
          }
        }
      }

      // all TestCase geometries should be equivalent
      if (ck.testLE(4, geometry.length, "have at least four geometries to compare")) {
        for (let i = 1; i < geometry.length; ++i)
          ck.testTrue(geometry[0].isAlmostEqual(geometry[i]), `testCase[${iTestCase}]: geom0 compares to geom${i}`);
      }
    }

    expect(ck.getNumErrors()).toBe(0);
  });

  it("SkewSolidPrimitives", () => {
    const ck = new Checker();

    // NOTE: some old native JSON files are empty or trivial because old serialization code returned error
    const testCases: TestCase[] = [];
    for (const testName of ["sphere-nonuniform-scale", "sphere-skew-axes", "cone-elliptical-perp", "cone-elliptical-skew"])
      testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}-new.imjs`, `${nativeRoot}${testName}-old.imjs`]], [[`${typeScriptRoot}${testName}.fb`], [`${typeScriptRoot}${testName}-new.imjs`, `${typeScriptRoot}${testName}-old.imjs`]]] });

    // temp code to generate files
    if (false) {
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
    }

    for (let iTestCase = 0; iTestCase < testCases.length; ++iTestCase) {
      // all flatbuffer geometries should be equivalent
      const fbGeom: GeometryQuery[] = [];
      for (const platform of [Platform.Native, Platform.TypeScript]) {
        const fileType = FileType.FlatBuffer;
        for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) {
          const geom = deserializeFirstGeom(fileName, fileType);
          if (ck.testDefined(geom, `deserialized at least one FB geometry from ${fileName}`))
            fbGeom.push(geom);
        }
      }
      if (!ck.testLE(1, fbGeom.length, "have at least one FB geometry to compare"))
        continue;
      const geomToCompare = fbGeom[0]; // ASSUME correct
      for (let i = 1; i < fbGeom.length; ++i)
        ck.testTrue(geomToCompare.isAlmostEqual(fbGeom[i]), `testCase[${iTestCase}]: fb0 === fb${i}`);

      // all "new" json geometries should equate to geomToCompare
      for (const platform of [Platform.Native, Platform.TypeScript]) {
        const fileType = FileType.JSON;
        for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) {
          if (fileName.includes("-new.imjs")) {
            const geom = deserializeFirstGeom(fileName, fileType);
            if (ck.testDefined(geom, `deserialized at least one JSON geometry from ${fileName}`))
              ck.testTrue(geomToCompare.isAlmostEqual(geom), `${fileName} yields expected geometry`);
          }
        }
      }

      // verify each property of old JSON is present in new JSON
      for (const platform of [Platform.Native, Platform.TypeScript]) {
        const fileType = FileType.JSON;
        let oldJson, newJson: any;
        for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) {
          const jsonString = fs.readFileSync(fileName, "utf8");
          if (fileName.includes("-new.imjs")) {
            ck.testUndefined(newJson, `${fileName} extraneous new JSON file encountered`);
            newJson = jsonString.length > 0 ? JSON.parse(jsonString) : undefined;
          } else if (fileName.includes("-old.imjs")) {
            ck.testUndefined(oldJson, `${fileName} extraneous old JSON file encountered`);
            oldJson = jsonString.length > 0 ? JSON.parse(jsonString) : undefined;
          }
        }
        // We already checked geometry, so don't check property values, which can be different,
        // e.g., scale can be distributed differently between frame axes and radii.
        if (ck.testDefined(newJson, `test case[${iTestCase}][${platform}] has valid JSON`))
          ck.testTrue(jsonIsContained(oldJson, newJson, false), `testCase[${iTestCase}][${platform}]: oldJson should be subset of newJson`);
      }
    }

    expect(ck.getNumErrors()).toBe(0);
  });

});
