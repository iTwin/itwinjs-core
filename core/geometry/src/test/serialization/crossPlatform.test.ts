/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import { describe, expect, it } from "vitest";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { IndexedPolyfaceWalker } from "../../polyface/IndexedPolyfaceWalker";
import { IndexedPolyface } from "../../polyface/Polyface";
import { BentleyGeometryFlatBuffer } from "../../serialization/BentleyGeometryFlatBuffer";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { SerializationHelpers } from "../../serialization/SerializationHelpers";
import { Cone } from "../../solid/Cone";
import { Sphere } from "../../solid/Sphere";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// Verify that the typescript API can read flatbuffer and json files written by the typescript and native APIs.
// Each test case consists of at least four files that encode the same single geometry: native-authored fb and json, typescript-authored fb and json
// The same tests exist in imodel-native geomlibs and operate on the same files; these tests and files should be kept in sync.
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

  // A file may contain multiple geometries. Deserialize only the first.
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

  const serialize = (ck: Checker, geom: GeometryQuery | undefined, fileName: string) => {
    if (ck.testDefined(geom, "valid geometry")) {
      const fbBytes = BentleyGeometryFlatBuffer.geometryToBytes(geom, true);
      if (ck.testDefined(fbBytes, "exported to flatbuffer"))
        GeometryCoreTestIO.writeBytesToFile(fbBytes, `c:\\tmp\\typescript\\${fileName}.fb`);
      const json = IModelJson.Writer.toIModelJson(geom);
      if (ck.testDefined(json, "exported to json"))
        fs.writeFileSync(`c:\\tmp\\typescript\\${fileName}.imjs`, JSON.stringify(json));
    }
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

  it("EquivalentFormats", () => {
    const ck = new Checker();

    const testCases: TestCase[] = [];
    let testName = "indexedMesh-auxData";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-auxData2";  // inspired by Scientific Visualization sandbox
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`, `${nativeRoot}${testName}-size3.fb`, `${nativeRoot}${testName}-size4.fb`, `${nativeRoot}${testName}-size5.fb`], [`${nativeRoot}${testName}.imjs`, `${nativeRoot}${testName}-size3.imjs`, `${nativeRoot}${testName}-size4.imjs`, `${nativeRoot}${testName}-size5.imjs`]], [[`${typeScriptRoot}${testName}-new.fb`, `${typeScriptRoot}${testName}-old.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });
    testName = "indexedMesh-fixedSize";
    testCases.push({ fileNames: [[[`${nativeRoot}${testName}.fb`], [`${nativeRoot}${testName}.imjs`]], [[`${typeScriptRoot}${testName}.fb`], [`${typeScriptRoot}${testName}.imjs`]]] });

    // TODO: add future testcases where all formats deserialize to the same geometry

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
      serialize(ck, sphere0, "sphere-nonuniform-scale-new");
      serialize(ck, sphere1, "sphere-skew-axes-new");
      serialize(ck, cone0, "cone-elliptical-perp-new");
      serialize(ck, cone1, "cone-elliptical-skew-new");
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
          if (fileName.endsWith("-new.imjs")) {
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
          if (fileName.endsWith("-new.imjs")) {
            ck.testUndefined(newJson, `${fileName} extraneous new JSON file encountered`);
            newJson = jsonString.length > 0 ? JSON.parse(jsonString) : undefined;
          } else if (fileName.endsWith("-old.imjs")) {
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

  it("IndexedMeshTopo", () => {
    const ck = new Checker();

    // TODO: when edgeMateIndex support added to Native, uncomment additional files
    const testCases: TestCase[] = [];
    testCases.push({ fileNames: [
      [[`${nativeRoot}indexedMeshTopo-fixed-old.fb`, `${nativeRoot}indexedMeshTopo-variable-old.fb` /* , `${nativeRoot}indexedMeshTopo-fixed-new.fb`, `${nativeRoot}indexedMeshTopo-variable-new.fb` */], [`${nativeRoot}indexedMeshTopo-fixed-old.imjs`, `${nativeRoot}indexedMeshTopo-variable-old.imjs` /* , `${nativeRoot}indexedMeshTopo-fixed-new.imjs`, `${nativeRoot}indexedMeshTopo-variable-new.imjs` */]],
      [[`${typeScriptRoot}indexedMeshTopo-old.fb`, `${typeScriptRoot}indexedMeshTopo-new.fb`], [`${typeScriptRoot}indexedMeshTopo-old.imjs`, `${typeScriptRoot}indexedMeshTopo-new.imjs`]],
    ] });

    // temp code to generate files (remember to set `enableSave` flag in Checker ctor)
    if (false) {
      const mesh = IndexedPolyface.create();
      const vertices = [[0,0,0.7664205912849231], [0,0.5,0.48180614748985123], [0,0.25,0.802582585192784], [0.5,0,0.43491424436272463], [0.25,0,0.8188536774560378], [0,0.75,0.33952742318739915], [0.75,0,0.25206195068490395], [0.25,0.5,0.504569375013316], [0,1,0.2703371615911343], [1,0,0.10755755225803061], [0.25,0.75,0.2724132516081212], [0.5,0.25,0.5381121104277191], [0.5,0.5,0.3257620892806842], [0.5,0.75,0.04371942681056798], [0.25,1,0.2222400805896964], [0.25,0.25,1.1652833229746615], [1,0.25,0.23021761065562], [0.75,0.25,0.5893585652638186], [0.5,1,0.14597916468688915], [0.75,0.75,0.11596980253736251], [0.75,0.5,0.40804791637969084], [1,0.5,0.16102556400617096], [0.75,1,0.08104741694308121], [1,0.75,0.050360274157937215], [1,1,0.03586959238610449]];
      const oneBasedIndices = new Int32Array([1,5,16,3,0,5,4,12,16,0,4,7,18,12,0,7,10,17,18,0,3,16,8,2,0,16,12,13,8,0,12,18,21,13,0,18,17,22,21,0,2,8,11,6,0,8,13,14,11,0,13,21,20,14,0,21,22,24,20,0,6,11,15,9,0,11,14,19,15,0,14,20,23,19,0,20,24,25,23,0]);
      for (const v of vertices) mesh.addPointXYZ(v[0], v[1], v[2]);
      SerializationHelpers.announceZeroBasedIndicesFromSignedOneBasedIndices(oneBasedIndices, 1, (i, v) => mesh.addPointIndex(i, v), () => mesh.terminateFacet(false));
      IndexedPolyfaceWalker.buildEdgeMateIndices(mesh);
      serialize(ck, mesh, "indexedMeshTopo-new");
    }

    for (let iTestCase = 0; iTestCase < testCases.length; ++iTestCase) {
      let refGeom: GeometryQuery | undefined;
      let refGeomWithTopo: GeometryQuery | undefined;
      for (const platform of [Platform.Native, Platform.TypeScript]) if (!refGeom || !refGeomWithTopo)
          for (const fileType of [FileType.FlatBuffer, FileType.JSON]) if (!refGeom || !refGeomWithTopo)
              for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) if (!refGeom || !refGeomWithTopo) {
                const geom = deserializeFirstGeom(fileName, fileType);
                if (geom && geom instanceof IndexedPolyface) {
                  if (!refGeomWithTopo && geom.data.edgeMateIndex)
                    refGeomWithTopo = geom;
                  if (!refGeom && !geom.data.edgeMateIndex)
                    refGeom = geom;
                }
              }

      if (ck.testDefined(refGeom, "found ref geom") && ck.testDefined(refGeomWithTopo, "found ref geom with topo"))
        for (const platform of [Platform.Native, Platform.TypeScript])
            for (const fileType of [FileType.FlatBuffer, FileType.JSON])
                for (const fileName of testCases[iTestCase].fileNames[platform][fileType]) {
                  const geom = deserializeFirstGeom(fileName, fileType);
                  if (ck.testDefined(geom, "deserialized geom") && geom instanceof IndexedPolyface) {
                    if (fileName.includes("-new."))
                      ck.testTrue(refGeomWithTopo.isAlmostEqual(geom), `testCase[${iTestCase}]: ${fileName} encodes expected geom + topo`);
                    else
                      ck.testTrue(refGeom.isAlmostEqual(geom), `testCase[${iTestCase}]: ${fileName} encodes expected geom`);
                  }
                }
    }

    expect(ck.getNumErrors()).toBe(0);
  });
});
