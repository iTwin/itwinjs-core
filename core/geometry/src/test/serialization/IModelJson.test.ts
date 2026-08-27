/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import { BSplineCurve3dBase } from "../../bspline/BSplineCurve";
import { BSplineSurface3d, UVSelect } from "../../bspline/BSplineSurface";
import { Arc3d } from "../../curve/Arc3d";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { UnionRegion } from "../../curve/UnionRegion";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { IndexedPolyface } from "../../polyface/Polyface";
import { DeepCompare } from "../../serialization/DeepCompare";
import { Sample } from "../GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Box } from "../../solid/Box";
import { RuledSweep } from "../../solid/RuledSweep";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { testGeometryQueryRoundTrip } from "./FlatBuffer.test";

// cspell:word geomlibs
// cspell:word BSIJSON

// directory containing imjs files produced by native geomlibs tests:
const iModelJsonNativeSamplesDirectory = "./src/test/data/iModelJsonSamples/fromNative/";
// directory containing imjs files produced by prior executions of this test file:
const iModelJsonSamplesDirectory = "./src/test/data/iModelJsonSamples/fromGC/";
// Output folder typically not tracked by git... make directory if not there
const iModelJsonOutputSubFolder = "iModelJsonSamples";

function deepAlmostEqual(g0: any, g1: any): boolean {
  if (Array.isArray(g0) && Array.isArray(g1)) {
    if (g0.length !== g1.length)
      return false;
    for (let i = 0; i < g0.length; i++) {
      if (!deepAlmostEqual(g0[i], g1[i]))
        return false;
    }
    return true;
  } else if (g0 instanceof GeometryQuery && g1 instanceof GeometryQuery) {
    return g0.isAlmostEqual(g1);
  }
  return false;
}

/** For each property P of the json value:  save the value as a new member of the array counter.P
 */
function saveJson(jsv: object, counter: { [key: string]: any }) {
  if (typeof jsv === "object" && typeof jsv !== "function" && !Array.isArray(jsv)) {
    for (const property in jsv) {
      if (jsv.hasOwnProperty(property)) {
        // const key = "sampleData_" + property;
        const key = property;
        // Add property to counter if not already there
        if (!counter.hasOwnProperty(key))
          counter[key] = [];
        counter[key].push(jsv);
      }
    }
  }
}

const allIModelJsonSamples: { [key: string]: any } = {};
// if geometry, apply dx,dy,dz.
// If array, apply dy and multiple of x shift to each member
function applyShifts(g: any, dx: number, dy: number): any {
  if (Array.isArray(g)) {
    let i = 0;
    for (const g1 of g) {
      applyShifts(g1, i * dx, dy);
      i++;
    }
    return g;
  }

  if (g instanceof GeometryQuery) {
    g.tryTranslateInPlace(dx, dy, 0);
  }
  return g;
}
function exerciseIModelJSon(ck: Checker, g: any, doParse: boolean = false, noisy: boolean = false) {
  if (Array.isArray(g)) {
    for (const g1 of g)
      exerciseIModelJSon(ck, g1, doParse, noisy);
    return;
  }

  if (g instanceof GeometryQuery) {
    const imData = IModelJson.Writer.toIModelJson(g);
    saveJson(imData, allIModelJsonSamples);
    if (noisy)
      GeometryCoreTestIO.consoleLog(prettyPrint(imData));
    if (doParse) {
      const g1 = IModelJson.Reader.parse(imData) as GeometryQuery;
      if (!g1 || !g.isAlmostEqual(g1)) {
        ck.announceError("IModelJson round trip error", g, prettyPrint(imData), prettyPrint(g1));
        IModelJson.Reader.parse(imData);
        GeometryCoreTestIO.consoleLog("*********** round trip data *********");
        GeometryCoreTestIO.consoleLog(prettyPrint(g));
        GeometryCoreTestIO.consoleLog(prettyPrint(imData));
        GeometryCoreTestIO.consoleLog(prettyPrint(g1));
        g.isAlmostEqual(g1);
        GeometryCoreTestIO.consoleLog("=====================================");

        const imData1 = IModelJson.Writer.toIModelJson(g);
        const g2 = IModelJson.Reader.parse(imData1) as GeometryQuery;
        g.isAlmostEqual(g2);
      }
      if (noisy)
        GeometryCoreTestIO.consoleLog("Round Trip", prettyPrint(g1));
    }
    return;
  }

}

function exerciseIModelJSonArray(ck: Checker, g: any[], doParse: boolean = false, noisy: boolean = false) {
  const writer = new IModelJson.Writer();
  const imData = writer.emit(g);
  saveJson(imData, allIModelJsonSamples);
  if (noisy)
    GeometryCoreTestIO.consoleLog(prettyPrint(imData));
  if (doParse) {
    const g1 = IModelJson.Reader.parse(imData) as any[];
    if (ck.testTrue(Array.isArray(g1), "[] returns as array", g1)) {
      if (ck.testExactNumber(g.length, g1.length, "Array lengths", g, g1)) {
        for (let i = 0; i < g.length; i++) {
          ck.testTrue(g[i].isAlmostEqual(g1[i]), g[i], g1[i]);
          if (noisy)
            GeometryCoreTestIO.consoleLog("Round Trip", prettyPrint(g1[i]));
        }
      }
    }
  }
}
//
// IModelJsonSamples workflow:
// * Each execution of it("CreateIModelJsCreateIModelJsonSamplesonSamples") constructs GeometryQuery objects and saves them in the test output
//            path     test/output/IModelJsonSamples
// * a copy of those is saved in path     test/IModelJsonSamples
// * Each execution of it("ReadIModelJson") reads tht saved files in test/IModelJsonSamples, converts to GeometryQuery, converts that back to
//     json and does a deep compare of the before/after json
//

describe("CreateIModelJsonSamples", () => {
  it("GeometryQueryToIModelJS", () => {
    const ck = new Checker();
    const numSample = 3;
    ck.testUndefined(IModelJson.Writer.toIModelJson(undefined), "IModelJsonWriter(undefined)");

    exerciseIModelJSon(ck, Sample.createLineStrings(), true, false);
    exerciseIModelJSon(ck, Sample.createSmoothCurvePrimitives(numSample), true, false);
    exerciseIModelJSon(ck, CoordinateXYZ.create(Point3d.create(11, 7, 5)), true, false);

    exerciseIModelJSon(ck, Sample.createSimplePaths(), true, false);
    exerciseIModelJSon(ck, Sample.createSimpleLoops(), true, false);
    exerciseIModelJSon(ck, Sample.createSimpleParityRegions(), true, false);

    exerciseIModelJSon(ck, Sample.createSpheres(), true, false);
    exerciseIModelJSon(ck, Sample.createCones(), true, false);
    exerciseIModelJSon(ck, Sample.createBoxes(), true, false);
    exerciseIModelJSon(ck, Sample.createTorusPipes(), true, false);
    exerciseIModelJSon(ck, Sample.createSimpleLinearSweeps(), true, false);
    exerciseIModelJSon(ck, Sample.createSimpleRotationalSweeps(), true, false);
    exerciseIModelJSon(ck, Sample.createRuledSweeps(), true, false);

    exerciseIModelJSon(ck, applyShifts(Sample.createBsplineCurves(true), 10, 0), true, false);
    exerciseIModelJSon(ck, applyShifts(Sample.createBspline3dHCurves(), 10, 10), true, false);
    exerciseIModelJSon(ck, Sample.createXYGridBsplineSurface(4, 3, 3, 2)!, true, false);
    exerciseIModelJSon(ck, Sample.createWeightedXYGridBsplineSurface(4, 3, 3, 2, 1.0, 1.1, 0.9, 1.0)!, true, false);
    exerciseIModelJSon(ck, Sample.createSimpleIndexedPolyfaces(1), true, false);
    exerciseIModelJSon(ck, Sample.createSimplePointStrings(), true, false);
    exerciseIModelJSon(ck, Sample.createSimpleTransitionSpirals(), true, false);
    // exerciseIModelJSon(ck, Sample.createSimpleIndexedPolyfaces(3), true, true);
    GeometryCoreTestIO.savePropertiesAsSeparateFiles(iModelJsonOutputSubFolder, allIModelJsonSamples);
    exerciseIModelJSonArray(ck, Sample.createSmoothCurvePrimitives(numSample), true, false);

    // GeometryCoreTestIO.consoleLog(allIModelJsonSamples);
    expect(ck.getNumErrors()).toBe(0);

  });
  // exercise the secondary ArcBy3Points property, with various point formats . ..
  it("ArcByStartMiddleEnd", () => {
    const ck = new Checker();
    const json = {
      arc: [[3, 1, 0], Point3d.create(3, 3, 0), { x: 1, y: 3, z: 0 }],
    };
    // exercise variant point from json:
    const point0 = Point3d.fromJSON(json.arc[0]);
    const point1 = Point3d.fromJSON(json.arc[1]);
    const point2 = Point3d.fromJSON(json.arc[2]);
    const arc = IModelJson.Reader.parse(json);
    if (ck.testPointer(arc, "arc by 3 points") && arc instanceof Arc3d) {
      const point10 = arc.fractionToPoint(0.0);
      const point12 = arc.fractionToPoint(1.0);
      ck.testPoint3d(point0, point10, "start point");
      ck.testPoint3d(point2, point12, "end point");
      ck.testCoordinate(arc.center.distance(point0), arc.center.distance(point1));
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  // make a mesh with identical normals present redundantly.
  // This was incorrectly compressed by the reader.
  it("MeshWithDuplicateNormals", () => {
    const ck = new Checker();
    const mesh = IndexedPolyface.create(true, false, false, true);
    mesh.data.point.pushXYZ(0, 0, 0);
    mesh.data.point.pushXYZ(1, 0, 0);
    mesh.data.point.pushXYZ(0, 1, 0);
    mesh.data.pointIndex.push(0, 1, 2);
    mesh.data.edgeVisible.push(true, true, true);
    mesh.addNormalXYZ(0, 0, 1);
    mesh.addNormal(Vector3d.create(0, 0, 1));    // in bug state, this reuses the first normal
    mesh.addNormalXYZ(0, 0, 1);
    mesh.addNormalIndex(0);
    mesh.addNormalIndex(1);
    mesh.addNormalIndex(2);
    mesh.terminateFacet();
    ck.testExactNumber(mesh.data.pointIndex.length, 3);
    ck.testExactNumber(mesh.data.point.length, 3);
    ck.testExactNumber(mesh.data.normal!.length, 3);
    ck.testExactNumber(mesh.data.normalIndex!.length, 3);
    mesh.expectedClosure = 1;
    ck.testExactNumber(1, mesh.expectedClosure, "expectedClosure property accessors");
    const meshJson = IModelJson.Writer.toIModelJson(mesh);
    const meshB = IModelJson.Reader.parse(meshJson);
    ck.testTrue(mesh.isAlmostEqual(meshB), "confirm json round trip");
  });
  /* reread the files from several known sources */
  it("ReadIModelJson", () => {
    const ck = new Checker();
    const compareObj = new DeepCompare();
    const skipList = ["xyVectors", "readme", "README"];
    const expectedJsonMismatchList = ["indexedMesh.numPerFace.",  // the mesh flips to zero-terminated
      "cone.imjs",                // cone can change to cylinder
      "box.minimal.imjs",         // minimal box gets remaining fields populated
    ];
    const expectedFBMismatchList = ["point.imjs", // CoordinateXYZ is not implemented in writeGeometryQueryAsFBVariantGeometry...
    ];
    // read imjs files from various places -- some produced by native, some by core-geometry ...
    for (const sourceDirectory of [iModelJsonSamplesDirectory, iModelJsonNativeSamplesDirectory]) {
      const items = fs.readdirSync(sourceDirectory);
      let numItems = 0;
      let numValuePassed = 0;

      for (const i of items) {
        const currFile = sourceDirectory + i;
        // skip known non-round-trip files ...
        let isFiltered = false;
        for (const candidate of skipList)
          if (currFile.lastIndexOf(candidate) >= 0) { isFiltered = true; break; }
        if (isFiltered) continue;
        Checker.noisy.printJSONFailure = true;
        const data = fs.readFileSync(currFile, "utf8");
        if (Checker.noisy.reportRoundTripFileNames)
          GeometryCoreTestIO.consoleLog(currFile);
        let jsonObject1;
        if (data.length > 0) {
          jsonObject1 = JSON.parse(data);
        } else {
          continue;
        }
        if (jsonObject1 as object) {
          numItems++;
          const geometryQuery1 = IModelJson.Reader.parse(jsonObject1);
          const jsonObject2 = IModelJson.Writer.toIModelJson(geometryQuery1);
          if (compareObj.compare(jsonObject1, jsonObject2)) {
            if (Checker.noisy.printJSONSuccess) { GeometryCoreTestIO.consoleLog(`PASS: ${i}`); }
            numValuePassed++;
          } else {
            const jsonObject3 = IModelJson.Writer.toIModelJson(geometryQuery1);
            const geometryQuery3 = IModelJson.Reader.parse(jsonObject3);
            if (deepAlmostEqual(geometryQuery1, geometryQuery3)) {
              isFiltered = false;
              for (const candidate of expectedJsonMismatchList)
                if (currFile.lastIndexOf(candidate) >= 0) { isFiltered = true; break; }
              GeometryCoreTestIO.consoleLog("%s json round trip mismatch (geometry matches):", isFiltered ? "Expected" : "Warning: Unexpected", currFile);
              if (!isFiltered) {
                GeometryCoreTestIO.consoleLog("jsonObject1:", prettyPrint(jsonObject1));
                GeometryCoreTestIO.consoleLog("jsonObject3:", prettyPrint(jsonObject3));
              }
            } else {
              ck.announceError("imjs => GeometryQuery => imjs round trip failure", currFile);
              GeometryCoreTestIO.consoleLog("jsonObject1:", prettyPrint(jsonObject1));
              GeometryCoreTestIO.consoleLog("jsonObject2:", prettyPrint(jsonObject2));
              if (Checker.noisy.printJSONFailure) { GeometryCoreTestIO.consoleLog(`FAIL: ${i}`); GeometryCoreTestIO.consoleLog(compareObj.errorTracker); }
            }
          }
          // test geometry roundtrip thru flatbuffer (and IMJS again)
          isFiltered = false;
          for (const candidate of expectedFBMismatchList)
            if (currFile.lastIndexOf(candidate) >= 0) { isFiltered = true; break; }
          if (isFiltered) continue;
          testGeometryQueryRoundTrip(ck, geometryQuery1);
        }
      }
      if (Checker.noisy.printJSONSuccess) {
        GeometryCoreTestIO.consoleLog(` imjs => geometry files from ${sourceDirectory}`);
        GeometryCoreTestIO.consoleLog(`*************** ${numValuePassed} files passed out of ${numItems} checked`);
      }
    }
    ck.checkpoint("BSIJSON.ParseIMJS");
    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("BoxProps", () => {
  type BoxProps = IModelJson.BoxProps;

  function parseBox(props: BoxProps): Box | undefined {
    return IModelJson.Reader.parseBox(props);
  }

  function expectBoxOrigin(inputProps: BoxProps, expectedOrigin: number): void {
    const box = parseBox(inputProps)!;
    expect(box).toBeDefined();
    expect(box.getBaseOrigin().x).toBe(expectedOrigin);
  }

  it("accepts either origin or baseOrigin", () => {
    expectBoxOrigin({ origin: [3, 2, 1], baseX: 10 }, 3);
    expectBoxOrigin({ baseOrigin: [4, 5, 6], baseX: 5 } as BoxProps, 4);
  });

  it("prefers origin if both origin and baseOrigin are specified", () => {
    expectBoxOrigin({
      origin: [5, 5, 5],
      baseOrigin: [6, 6, 6],
      baseX: 7,
    }, 5);
  });

  it("requires either origin or baseOrigin", () => {
    expect(parseBox({ baseX: 123 } as BoxProps)).toBeUndefined();
  });

  it("outputs both origin and baseOrigin", () => {
    const box = parseBox({ origin: [1, 2, 3], baseX: 4 })!;
    expect(box).toBeDefined();

    const solidProps = new IModelJson.Writer().handleBox(box);
    const props = solidProps.box!;
    expect(props).toBeDefined();

    expect(props.origin).toBeDefined();
    const origin = Point3d.fromJSON(props.origin);
    expect(origin.x).toBe(1);
    expect(origin.y).toBe(2);
    expect(origin.z).toBe(3);

    expect(props.baseOrigin).toBeDefined();
    const baseOrigin = Point3d.fromJSON(props.baseOrigin);
    expect(baseOrigin?.x).toBe(1);
    expect(baseOrigin?.y).toBe(2);
    expect(baseOrigin?.z).toBe(3);
  });
});

// These unit tests are designed to fail at compilation if previous incorrect TypeScript type definitions
// are reintroduced in core/geometry/src/serialization/IModelJsonSchema.ts.
describe("IModelJsonSchemaWrongTypeDefinitions", () => {
  it("BSplineSurfaceProps", () => {
    const ck = new Checker();
    const props: IModelJson.BSplineSurfaceProps = {
      orderU: 3,
      orderV: 3,
      points: [
        [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
        [[0, 1, 0], [1, 1, 1], [2, 1, 0]],
        [[0, 2, 0], [1, 2, 0], [2, 2, 0]],
      ],
      uKnots: [0, 0, 1, 1],
      vKnots: [0, 0, 1, 1],
    };
    ck.testExactNumber(3, props.points.length, "points has 3 rows");
    ck.testExactNumber(3, props.points[0].length, "row 0 has 3 control points");
    ck.testExactNumber(3, props.points[0][0].length, "control point has 3 coordinates");
    ck.testExactNumber(4, props.uKnots.length, "uKnots has 4 entries");
    ck.testExactNumber(4, props.vKnots.length, "vKnots has 4 entries");

    const surface = IModelJson.Reader.parse({ bsurf: props });
    if (ck.testTrue(surface instanceof BSplineSurface3d, "parsed geometry is a BSplineSurface3d")) {
      const surf = surface as BSplineSurface3d;
      ck.testExactNumber(3, surf.numPolesUV(UVSelect.uDirection), "surface has 3 poles in u");
      ck.testExactNumber(3, surf.numPolesUV(UVSelect.vDirection), "surface has 3 poles in v");
      ck.testExactNumber(9, surf.numPolesTotal(), "surface has 9 total poles");
      ck.testExactNumber(3, surf.orderUV(UVSelect.uDirection), "surface has orderU 3");
      ck.testExactNumber(3, surf.orderUV(UVSelect.vDirection), "surface has orderV 3");
      ck.testExactNumber(4, surf.knots[UVSelect.uDirection].knots.length, "surface has 4 u knots");
      ck.testExactNumber(4, surf.knots[UVSelect.vDirection].knots.length, "surface has 4 v knots");
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("BcurveProps", () => {
    const ck = new Checker();
    const props: IModelJson.BcurveProps = {
      points: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]],
      knots: [0, 0, 0, 1, 1, 1],
      order: 4,
    };
    ck.testExactNumber(4, props.points.length, "points has 4 control points");
    ck.testExactNumber(6, props.knots.length, "knots has 6 entries");

    const curve = IModelJson.Reader.parse({ bcurve: props });
    if (ck.testTrue(curve instanceof BSplineCurve3dBase, "parsed geometry is a BSplineCurve3dBase")) {
      const bcurve = curve as BSplineCurve3dBase;
      ck.testExactNumber(4, bcurve.numPoles, "curve has 4 poles");
      ck.testExactNumber(4, bcurve.order, "curve has order 4");
      ck.testExactNumber(6, bcurve.knotsRef.length, "curve has 6 knots");
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("CurveCollectionProps", () => {
    // cspell:word bagof
    const ck = new Checker();
    const seg1: IModelJson.CurvePrimitiveProps = { lineSegment: [[0, 0, 0], [1, 0, 0]] };
    const seg2: IModelJson.CurvePrimitiveProps = { lineSegment: [[1, 0, 0], [2, 0, 0]] };

    const pathProps: IModelJson.CurveCollectionProps = { path: [seg1, seg2] };
    const bagOfCurvesProps1: IModelJson.CurveCollectionProps = { bagOfCurves: [seg1, seg2] };
    const bagOfCurvesProps2: IModelJson.CurveCollectionProps = { bagOfCurves: [seg1, { path: [seg1, seg2] }] };
    ck.testExactNumber(2, pathProps.path!.length, "path has 2 primitives");
    ck.testExactNumber(2, bagOfCurvesProps1.bagOfCurves!.length, "bagOfCurves1 has 2 primitive members");
    ck.testExactNumber(2, bagOfCurvesProps2.bagOfCurves!.length, "bagOfCurves2 has 2 members (1 primitive, 1 nested collection)");

    const parsedPath = IModelJson.Reader.parse(pathProps);
    if (ck.testTrue(parsedPath instanceof Path, "parsed path is a Path")) {
      const path = parsedPath as Path;
      ck.testExactNumber(2, path.children.length, "path has 2 children");
      ck.testTrue(path.children[0] instanceof LineSegment3d, "path child 0 is a LineSegment3d");
      ck.testTrue(path.children[1] instanceof LineSegment3d, "path child 1 is a LineSegment3d");
    }

    const parsedBag1 = IModelJson.Reader.parse(bagOfCurvesProps1);
    if (ck.testTrue(parsedBag1 instanceof BagOfCurves, "parsed bagOfCurves1 is a BagOfCurves")) {
      const bag = parsedBag1 as BagOfCurves;
      ck.testExactNumber(2, bag.children.length, "bagOfCurves1 has 2 children");
      ck.testTrue(bag.children[0] instanceof LineSegment3d, "bagOfCurves1 child 0 is a LineSegment3d");
      ck.testTrue(bag.children[1] instanceof LineSegment3d, "bagOfCurves1 child 1 is a LineSegment3d");
    }

    const parsedBag2 = IModelJson.Reader.parse(bagOfCurvesProps2);
    if (ck.testTrue(parsedBag2 instanceof BagOfCurves, "parsed bagOfCurves2 is a BagOfCurves")) {
      const bag = parsedBag2 as BagOfCurves;
      ck.testExactNumber(2, bag.children.length, "bagOfCurves2 has 2 children");
      ck.testTrue(bag.children[0] instanceof LineSegment3d, "bagOfCurves2 child 0 is a LineSegment3d");
      if (ck.testTrue(bag.children[1] instanceof Path, "bagOfCurves2 child 1 is a nested Path")) {
        const nestedPath = bag.children[1] as Path;
        ck.testExactNumber(2, nestedPath.children.length, "nested Path has 2 children");
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("PlanarRegionProps", () => {
    const ck = new Checker();
    const seg1: IModelJson.CurvePrimitiveProps = { lineSegment: [[0, 0, 0], [1, 0, 0]] };
    const seg2: IModelJson.CurvePrimitiveProps = { lineSegment: [[1, 0, 0], [1, 1, 0]] };
    const seg3: IModelJson.CurvePrimitiveProps = { lineSegment: [[1, 1, 0], [0, 0, 0]] };

    const loopProps: IModelJson.PlanarRegionProps = { loop: [seg1, seg2, seg3] };
    const parityProps: IModelJson.PlanarRegionProps = {
      parityRegion: [{ loop: [seg1, seg2, seg3] }, { loop: [seg1, seg2, seg3] }],
    };
    const unionProps: IModelJson.PlanarRegionProps = { unionRegion: [loopProps, loopProps] };

    ck.testExactNumber(3, loopProps.loop!.length, "loop has 3 primitives");
    ck.testExactNumber(2, parityProps.parityRegion!.length, "parityRegion has 2 loops");
    ck.testExactNumber(3, parityProps.parityRegion![0].loop.length, "inner loop has 3 primitives");
    ck.testExactNumber(2, unionProps.unionRegion!.length, "unionRegion has 2 regions");

    const parsedLoop = IModelJson.Reader.parse(loopProps);
    if (ck.testTrue(parsedLoop instanceof Loop, "parsed loop is a Loop")) {
      const loop = parsedLoop as Loop;
      ck.testExactNumber(3, loop.children.length, "loop has 3 children");
      for (let i = 0; i < loop.children.length; ++i)
        ck.testTrue(loop.children[i] instanceof LineSegment3d, `loop child ${i} is a LineSegment3d`);
    }

    const parsedParity = IModelJson.Reader.parse(parityProps);
    if (ck.testTrue(parsedParity instanceof ParityRegion, "parsed parityRegion is a ParityRegion")) {
      const parity = parsedParity as ParityRegion;
      ck.testExactNumber(2, parity.children.length, "parityRegion has 2 loops");
      for (let i = 0; i < parity.children.length; ++i) {
        if (ck.testTrue(parity.children[i] instanceof Loop, `parityRegion child ${i} is a Loop`))
          ck.testExactNumber(3, parity.children[i].children!.length, `parityRegion loop ${i} has 3 primitives`);
      }
    }

    const parsedUnion = IModelJson.Reader.parse(unionProps);
    if (ck.testTrue(parsedUnion instanceof UnionRegion, "parsed unionRegion is a UnionRegion")) {
      const union = parsedUnion as UnionRegion;
      ck.testExactNumber(2, union.children.length, "unionRegion has 2 loops");
      for (let i = 0; i < union.children.length; ++i)
        ck.testTrue(union.children[i] instanceof Loop, `unionRegion child ${i} is a Loop`);
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("RuledSweepProps", () => {
    const ck = new Checker();
    const seg1: IModelJson.CurvePrimitiveProps = { lineSegment: [[0, 0, 0], [1, 0, 0]] };
    const seg2: IModelJson.CurvePrimitiveProps = { lineSegment: [[1, 0, 0], [1, 1, 0]] };
    const seg3: IModelJson.CurvePrimitiveProps = { lineSegment: [[1, 1, 0], [0, 0, 0]] };
    const contour1: IModelJson.CurveCollectionProps = { loop: [seg1, seg2, seg3] };
    const contour2: IModelJson.CurveCollectionProps = { loop: [seg1, seg2, seg3] };

    const props: IModelJson.RuledSweepProps = { contour: [contour1, contour2] };
    ck.testExactNumber(2, props.contour.length, "contour has 2 cross-sections");

    const parsed = IModelJson.Reader.parse({ ruledSweep: props });
    if (ck.testTrue(parsed instanceof RuledSweep, "parsed geometry is a RuledSweep")) {
      const sweep = parsed as RuledSweep;
      const contours = sweep.sweepContoursRef();
      ck.testExactNumber(2, contours.length, "sweep has 2 contours");
      for (let i = 0; i < contours.length; ++i) {
        if (ck.testTrue(contours[i].curves instanceof Loop, `contour ${i} is a Loop`))
          ck.testExactNumber(3, contours[i].curves.children!.length, `contour ${i} loop has 3 primitives`);
      }
    }
    expect(ck.getNumErrors()).toBe(0);
  });

  it("IndexedMeshProps", () => {
    const ck = new Checker();
    const props: IModelJson.IndexedMeshProps = {
      point: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
      normal: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
      param: [[0, 0], [1, 0], [0, 1], [1, 1]],
      color: [0xff0000, 0x00ff00, 0x0000ff, 0xffffff],
      pointIndex: [1, 2, 3, 0, 1, 3, 4, 0],
      paramIndex: [1, 2, 3, 0, 1, 3, 4, 0],
      normalIndex: [1, 2, 3, 0, 1, 3, 4, 0],
      colorIndex: [1, 2, 3, 0, 1, 3, 4, 0],
      edgeMateIndex: [-1, -1, -1, -1, -1, -1, -1, -1],
    };
    ck.testExactNumber(4, props.point.length, "point has 4 vertices");
    ck.testExactNumber(4, props.normal!.length, "normal has 4 entries");
    ck.testExactNumber(4, props.param!.length, "param has 4 entries");
    ck.testExactNumber(4, props.color!.length, "color has 4 entries");
    ck.testExactNumber(8, props.pointIndex.length, "pointIndex has 8 entries");
    ck.testExactNumber(8, props.paramIndex!.length, "paramIndex has 8 entries");
    ck.testExactNumber(8, props.normalIndex!.length, "normalIndex has 8 entries");
    ck.testExactNumber(8, props.colorIndex!.length, "colorIndex has 8 entries");
    ck.testExactNumber(8, props.edgeMateIndex!.length, "edgeMateIndex has 8 entries");

    const parsed = IModelJson.Reader.parse({ indexedMesh: props });
    if (ck.testTrue(parsed instanceof IndexedPolyface, "parsed geometry is an IndexedPolyface")) {
      const mesh = parsed as IndexedPolyface;
      ck.testExactNumber(4, mesh.pointCount, "mesh has 4 points");
      ck.testExactNumber(4, mesh.normalCount, "mesh has 4 normals");
      ck.testExactNumber(4, mesh.paramCount, "mesh has 4 params");
      ck.testExactNumber(4, mesh.colorCount, "mesh has 4 colors");
      ck.testExactNumber(2, mesh.facetCount, "mesh has 2 facets");
    }
    expect(ck.getNumErrors()).toBe(0);
  });
});

describe("ParseCurveCollections", () => {
  it("BSplinePathRegression", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const inputs = IModelJson.Reader.parse(JSON.parse(fs.readFileSync("./src/test/data/curve/pathWithBSplines.imjs", "utf8"))) as Path[];
    if (ck.testDefined(inputs, "inputs successfully parsed")) {
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, inputs);
      for (const input of inputs) {
        ck.testExactNumber(7, input.children.length, "path has expected number of children");
        ck.testExactNumber(3, input.children.filter((child: CurvePrimitive): boolean => { return child instanceof BSplineCurve3dBase; }).length, "path has expected number of B-spline curve children");
      }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "ParseCurveCollection", "BSplinePathRegression");
    expect(ck.getNumErrors()).toBe(0);
  });
});
