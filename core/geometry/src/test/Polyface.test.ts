/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IndexedPolyface, Polyface } from "../polyface/Polyface";
import { PolyfaceQuery } from "../polyface/PolyfaceQuery";
import { Sample } from "../serialization/GeometrySamples";
import { PolyfaceBuilder } from "../polyface/PolyfaceBuilder";
import { GeometryQuery } from "../curve/CurvePrimitive";
import { Point2d, Point3d, Vector3d } from "../PointVector";
import { RotMatrix } from "../Transform";
import { Transform } from "../Transform";
import { Range3d } from "../Range";
import { SolidPrimitive } from "../solid/SolidPrimitive";
import { LineString3d } from "../curve/LineString3d";
import { ParityRegion, Loop } from "../curve/CurveChain";
import { SweepContour } from "../solid/SweepContour";
import { Checker } from "./Checker";
import { expect } from "chai";
import { IModelJson } from "../serialization/IModelJsonSchema";
import * as fs from "fs";
import { GeometryCoreTestIO } from "./IModelJson.test";
import { StrokeOptions } from "../geometry-core";
import { prettyPrint } from "./testFunctions";
/* tslint:disable:no-console */
let outputFolderPath = "./src/test/output";
// Output folder typically not tracked by git... make directory if not there
if (!fs.existsSync(outputFolderPath))
  fs.mkdirSync(outputFolderPath);
outputFolderPath = outputFolderPath + "/";

// @param longEdgeIsHidden true if any edge longer than1/3 of face perimiter is expected to be hidden
function exercisePolyface(ck: Checker, polyface: Polyface,
  longEdgeIsHidden: boolean) {
  const twoSidedA = polyface.twoSided;
  polyface.twoSided = false;
  ck.testFalse(polyface.twoSided);
  polyface.twoSided = true;
  ck.testTrue(polyface.twoSided);
  polyface.twoSided = twoSidedA;
  // create vars to be reused ...
  const pointZ = Point3d.create();
  const paramZ = Point2d.create();
  const normalZ = Vector3d.create();

  const range = polyface.range();
  const range1 = Range3d.create();
  polyface.extendRange(range1);

  const visitor = polyface.createVisitor(0);
  const visitor1 = polyface.createVisitor(1);
  const pointB = Point3d.create();
  // const normalB = Vector3d.create();
  // visitor.moveToReadIndex(0);
  let facetIndex = 0;
  for (; visitor.moveToNextFacet(); facetIndex++) {
    // make sure visitors mvoe together ..
    ck.testTrue(visitor1.moveToNextFacet(), "wrapped visitor tracks unwrapped");
    const readIndex = visitor.currentReadIndex();
    ck.testExactNumber(readIndex, visitor1.currentReadIndex(), "current read index");
    const numEdge = visitor.pointCount;
    const numPoint1 = visitor1.pointCount;
    ck.testExactNumber(numEdge + 1, numPoint1, "wrapped visitor has extra point on each face");

    for (let i = 0; i < numPoint1; i++) {
      const pointIndexA = visitor1.clientPointIndex(i);
      const pointA = visitor1.point.getPoint3dAt(i);
      polyface.data.copyPointTo(pointIndexA, pointB);
      if (!ck.testPoint3d(pointA, pointB)) {
        const pointIndexQ = visitor1.clientPointIndex(i);
        const pointQ = visitor1.point.getPoint3dAt(i);
        polyface.data.copyPointTo(pointIndexQ, pointB);
        ck.testPoint3d(pointQ, pointB);
      } else {
        // check reused versus new ..
        const pointY = polyface.data.getPoint(pointIndexA);
        polyface.data.copyPointTo(pointIndexA, pointZ);
        ck.testPoint3d(pointY, pointZ, "polyface getPoint, copyPointTo");

        const paramIndexA = visitor1.clientParamIndex(i);
        const paramY = polyface.data.getParam(paramIndexA);
        polyface.data.copyParamTo(paramIndexA, paramZ);
        ck.testPoint2d(paramY, paramZ, "polyface getParam, copyParamTo");

        const normalIndexA = visitor1.clientNormalIndex(i);
        const normalY = polyface.data.getNormal(normalIndexA);
        polyface.data.copyNormalTo(normalIndexA, normalZ);
        ck.testVector3d(normalY, normalZ, "polyface getPoint, copyPointTo");
      }
    }
    // test visibility flags
    if (longEdgeIsHidden) {
      let perimeter = 0;
      for (let i = 0; i < numEdge; i++) {
        perimeter += visitor1.point.getPoint3dAt(i).distance(visitor1.point.getPoint3dAt(i + 1));
      }
      for (let i = 0; i < numEdge; i++) {
        const a = visitor1.point.getPoint3dAt(i).distance(visitor1.point.getPoint3dAt(i + 1));
        const v = visitor1.getEdgeVisible(i);
        if (!ck.testBoolean(a < perimeter / 3.0, v, "diagonals hidden")) {
          console.log({ faceCounter: facetIndex, edgeIndex: i, edgeLength: a, visibilityFlag: v });
          console.log({ faceCounter: facetIndex, edgeIndex: i, edgeLength: a, visibilityFlag: v });
        }
      }
    }
    /*
        if (polyface.data.normalCount > 0) {
          for (let i = 0; i < numPoint1; i++) {
            const normalIndex = visitor1.clientNormalIndex(i);
            const normalA = visitor1.normal.getVector3dAt(i);
            polyface.data.copyNormalTo(normalIndex, normalB);
            ck.testVector3d(normalA, normalB);
          }
        }
        */

  }

  ck.testRange3d(range, range1);
}

/**
 * Checks that FacetFaceData contained within an index polyface is accurate.
 * If there was no face data recorded, we do nothing.
 *
 * NOTE: Currently, face data is only recorded for facets when explicitly telling
 * the builder to do so. Therefore, if every facet is not a part of a face by manually
 * calling PolyfaceBuilder.endFace(), the test will fail. In the future, faces may be
 * moreso automatically claimed depending on the polyface built.
 */
function verifyFaceData(ck: Checker, polyface: IndexedPolyface, shouldCheckParamDistance: boolean = false) {
  if (polyface.data.face.length === 0) {
    return;
  }

  const pointIndex = polyface.data.pointIndex;
  const paramIndex = polyface.data.paramIndex;
  const normalIndex = polyface.data.normalIndex;

  if (paramIndex)
    ck.testExactNumber(paramIndex.length, pointIndex.length, "point, param index counts match");
  if (normalIndex)
    ck.testExactNumber(normalIndex.length, pointIndex.length, "point, normal index counts match");

  for (let i = 0; i < polyface.facetCount; i++) {
    const faceData = polyface.getFaceDataByFacetIndex(i);  // Ensures we do not get out of bounds exception
    ck.testTrue(faceData !== undefined);
    if (shouldCheckParamDistance)
      ck.testFalse(faceData.paramDistanceRange.isNull(), "paramDistanceRange should not be null");
  }
}

/* tslint:disable:no-console */
describe("Polyface.HelloWorld", () => {
  it("Polyface.HelloWorld", () => {
    const origin = Point3d.create(1, 2, 3);
    const ck = new Checker();
    const numX = 3;
    const numY = 2;

    const polyface0 = Sample.createTriangularUnitGridPolyface(
      origin, Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0),
      numX, numY,
      true, true, true);    // params, normals, and colors

    // we know .. normal is 001, param is integers . .
    ck.testVector3d(Vector3d.unitZ(), polyface0.data.getNormal(0), "access normal");
    const point0 = polyface0.data.getPoint(0);
    const param0 = polyface0.data.getParam(numX * numY - 1);
    const normal0 = polyface0.data.getNormal(0);
    ck.testPoint3d(origin, point0);
    ck.testExactNumber(param0.x, numX - 1);
    ck.testExactNumber(param0.y, numY - 1);
    ck.testVector3d(normal0, Vector3d.unitZ());
    ck.testExactNumber(0, polyface0.numEdgeInFacet(100000), "numEdgeInFacet for bad index");
    ck.testExactNumber(3, polyface0.numEdgeInFacet(1), "numEdgeInFacet (triangulated)");
    const numVertex = numX * numY;
    ck.testExactNumber(numVertex, polyface0.pointCount, "known point count in grid");
    ck.testExactNumber(numVertex, polyface0.paramCount, "known param count in grid");
    const numFacet = 2 * (numX - 1) * (numY - 1);   // 2 triangles per quad !!
    ck.testExactNumber(numFacet * 4, polyface0.zeroTerminatedIndexCount, "zeroTerminatedIndexCount in triangular grid: (A B C 0)");

    ck.testExactNumber(numFacet, 2 * polyface0.colorCount, "known color count in one-color-per-quad grid");
    ck.testExactNumber(1, polyface0.normalCount, "single normal for planar grid");
    const polyface1 = polyface0.clone();
    const mirrorX = Transform.createFixedPointAndMatrix(Point3d.createZero(),
      RotMatrix.createScale(-1, 1, 1));
    const polyface2 = polyface0.cloneTransformed(mirrorX);
    const expectedArea = (numX - 1) * (numY - 1);
    const numExpectedFacets = 2 * (numX - 1) * (numY - 1); // 2 triangles per quad .  .
    const expectedEdgeLength = numExpectedFacets * (2.0 + Math.sqrt(2.0));
    for (const pf of [polyface0, polyface1, polyface2]) {
      const loops = PolyfaceQuery.IndexedPolyfaceToLoops(pf);
      ck.testExactNumber(pf.facetCount, loops.children.length, "facet count");
      // console.log("polyface area", PolyfaceQuery.sumFacetAreas(polyface));
      // console.log(loops);
      ck.testCoordinate(expectedArea, PolyfaceQuery.sumFacetAreas(pf), "unit square facets area");
      ck.testCoordinate(expectedArea, PolyfaceQuery.sumFacetAreas(pf), "unit square facets area");
      ck.testCoordinate(loops.sumLengths(), expectedEdgeLength);
      exercisePolyface(ck, pf, true);
    }

    ck.checkpoint("Polyface.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Polyface.HelloWorld", () => {
  it("Polyface.Compress", () => {
    const ck = new Checker();
    const polyface = IndexedPolyface.create();
    // create with duplicate points on edge ..
    polyface.addPoint(Point3d.create(0, 0, 0));
    polyface.addPoint(Point3d.create(1, 0, 0));
    polyface.addPoint(Point3d.create(1, 1, 0));

    polyface.addPoint(Point3d.create(1, 1, 0));
    polyface.addPoint(Point3d.create(0, 1, 0));
    polyface.addPoint(Point3d.create(0, 0, 0));

    polyface.addPointIndex(0);
    polyface.addPointIndex(1);
    polyface.addPointIndex(2);
    polyface.terminateFacet();
    polyface.addPointIndex(3);
    polyface.addPointIndex(4);
    polyface.addPointIndex(5);
    polyface.terminateFacet();
    polyface.data.compress();
    const loops = PolyfaceQuery.IndexedPolyfaceToLoops(polyface);
    // console.log("polyface area", PolyfaceQuery.sumFacetAreas(polyface));
    // console.log(loops);
    ck.testCoordinate(1.0, PolyfaceQuery.sumFacetAreas(polyface), "unit square facets area");
    ck.testCoordinate(loops.sumLengths(),
      4 + 2 * Math.sqrt(2));

    ck.testExactNumber(4, polyface.data.point.length, "compressed point count");
    ck.checkpoint("Polyface.Compress");
    expect(ck.getNumErrors()).equals(0);
  });
});

describe("Polyface.Box", () => {
  it("Polyface.HelloWorld", () => {
    const ck = new Checker();
    const builder = PolyfaceBuilder.create();
    const a = 2; const b = 3; const c = 4;
    const expectedVolume = a * b * c;
    const expectedArea = 2 * (a * b + b * c + c * a);
    builder.addTransformedUnitBox(Transform.createFixedPointAndMatrix(Point3d.createZero(),
      RotMatrix.createScale(2, 3, 4)));

    const polyface = builder.claimPolyface();
    //    const loops = PolyfaceQuery.IndexedPolyfaceToLoops(polyface);
    const area = PolyfaceQuery.sumFacetAreas(polyface);
    const volume = PolyfaceQuery.sumTetrahedralVolumes(polyface);
    ck.testCoordinate(expectedArea, area);
    ck.testCoordinate(expectedVolume, volume);
    polyface.reverseIndices();
    const area1 = PolyfaceQuery.sumFacetAreas(polyface);
    const volume1 = PolyfaceQuery.sumTetrahedralVolumes(polyface);
    ck.testCoordinate(-expectedVolume, volume1, "index reversal negates volume");
    ck.testCoordinate(expectedArea, area1, "area unaffected by index reversal");
    ck.checkpoint("Polyface.Box");
    expect(ck.getNumErrors()).equals(0);

    const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
    // console.log("imjs polyface", jsPolyface);
    const polyfaceB = IModelJson.Reader.parse(jsPolyface);
    ck.testBoolean(true, polyface.isAlmostEqual(polyfaceB), "polyface round trip");
    polyfaceB.data.pointIndex[0] += 1;
    ck.testBoolean(false, polyface.isAlmostEqual(polyfaceB), "index change detection");
    // console.log(polyfaceB);
    expect(ck.getNumErrors()).equals(0);
  });
});

function writeMeshes(geometry: GeometryQuery[], fileName: string) {
  const allMesh = [];
  let dx = 0.0;
  let dy = 0.0;
  for (const g of geometry) {
    const builder = PolyfaceBuilder.create();
    const gRange = g.range();
    dx += 2.0 * gRange.xLength();
    dy = 4.0 * gRange.yLength();
    const transformX = Transform.createTranslationXYZ(dx, 0, 0);

    if (!gRange.isNull()) {
      const corners = gRange.corners();
      const ls = LineString3d.create(
        corners[0], corners[1],
        corners[5], corners[1], // z stroke !!!
        corners[3],
        corners[7], corners[3], // z stroke !!!
        corners[2],
        corners[6], corners[2], // z stroke !!!
        corners[2],
        corners[0],
        corners[4], corners[5], corners[7], corners[6], corners[4]);
      ls.tryTransformInPlace(transformX);
      allMesh.push(ls);
    }
    builder.addGeometryQuery(g);
    const polyface = builder.claimPolyface();
    if (polyface) {
      polyface.tryTransformInPlace(transformX);
      allMesh.push(polyface);
    }
    if (g instanceof SolidPrimitive) {
      for (const f of [0.0, 0.10, 0.20, 0.25, 0.50, 0.75, 1.0]) {
        const section = g.constantVSection(f);
        if (section) {
          section.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy, 0));
          allMesh.push(section);
        }
        if ((g as any).constantUSection) {
          const uSection = (g as any).constantUSection(f);
          if (uSection) {
            uSection.tryTransformInPlace(Transform.createTranslationXYZ(dx, 2.0 * dy, 0));
            allMesh.push(uSection);
          }
        }
      }
    }
    dx += 2.0 * gRange.xLength();
  }
  if (allMesh.length > 0) {
    GeometryCoreTestIO.saveGeometry(allMesh, "Polyface", fileName);
  }

}

describe("Polyface.Facets", () => {
  it("Cones", () => {
    writeMeshes(Sample.createCones(), "FacetedCones");
  });
  it("Spheres", () => {
    writeMeshes(Sample.createSpheres(), "FacetedSpheres");
  });
  it("Boxes", () => {
    writeMeshes(Sample.createBoxes(), "FacetedBoxes");
  });
  it("TorusPipes", () => {
    writeMeshes(Sample.createTorusPipes(), "FacetedTorusPipes");
  });
  it("LinearSweeps", () => {
    writeMeshes(Sample.createSimpleLinearSweeps(), "FacetedLinearSweeps");
  });

  it("RotationalSweeps", () => {
    writeMeshes(Sample.createSimpleRotationalSweeps(), "FacetedRotationalSweeps");
  });
  it("RuledSweeps", () => {
    writeMeshes(Sample.createRuledSweeps(), "FacetedRuledSweeps");
  });
});

describe("Polyface.Faces", () => {
  const ck = new Checker();

  it("Verify FacetFaceData Exists", () => {
    // For the sake of testing, we will let each GeometryQuery object be a 'face',
    // and we will obtain a mesh to which we add new IndexedPolyfaces to and keep declaring new faces
    const builder = PolyfaceBuilder.create();
    let polyface: IndexedPolyface;

    let totalFacets = 0;
    let totalPoints = 0;
    const numFacets: number[] = []; // Number of facets for each added part of the mesh
    const numPoints: number[] = []; // Number of points for each added part of the mesh

    const sampleMeshes = Sample.createSimpleIndexedPolyfaces(1);
    builder.addIndexedPolyface(sampleMeshes[0], false);
    polyface = builder.claimPolyface(false);
    numFacets.push(polyface.facetCount - totalFacets);
    numPoints.push(polyface.pointCount - totalPoints);
    totalFacets += polyface.facetCount;
    totalPoints += polyface.pointCount;
    ck.testTrue(builder.endFace());

    builder.addIndexedPolyface(sampleMeshes[2], false);
    polyface = builder.claimPolyface(false);
    numFacets.push(polyface.facetCount - totalFacets);
    numPoints.push(polyface.pointCount - totalPoints);
    totalFacets += polyface.facetCount;
    totalPoints += polyface.pointCount;
    ck.testTrue(builder.endFace());

    const sampleCones = Sample.createCones();
    builder.addCone(sampleCones[0]);
    polyface = builder.claimPolyface(false);
    numFacets.push(polyface.facetCount - totalFacets);
    numPoints.push(polyface.pointCount - totalPoints);
    totalFacets += polyface.facetCount;
    totalPoints += polyface.pointCount;
    ck.testTrue(builder.endFace());

    ck.testExactNumber(3, polyface.faceCount);
    verifyFaceData(ck, polyface, false);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Add grid w/ params, normals", () => {
    const facetWidth = 5;
    const facetHeight = 6;
    const grid: Point3d[][] = [
      [Point3d.create(0, 0, 1), Point3d.create(facetWidth, 0, 2), Point3d.create(facetWidth, facetHeight, 3), Point3d.create(0, facetHeight, 4)],
      [Point3d.create(facetWidth, 0, 5), Point3d.create(facetWidth * 2, 0, 6), Point3d.create(facetWidth * 2, facetHeight, 7), Point3d.create(facetWidth, facetHeight, 8)],
      [Point3d.create(facetWidth * 2, 0, 9), Point3d.create(facetWidth * 3, 0, 10), Point3d.create(facetWidth * 3, facetHeight, 11), Point3d.create(facetWidth * 2, facetHeight, 12)],
      [Point3d.create(0, facetHeight, 13), Point3d.create(facetWidth, facetHeight, 14), Point3d.create(facetWidth, facetHeight * 2, 15), Point3d.create(0, facetHeight * 2, 16)],
      [Point3d.create(facetWidth, facetHeight, 17), Point3d.create(facetWidth * 2, facetHeight, 18), Point3d.create(facetWidth * 2, facetHeight * 2, 19), Point3d.create(facetWidth, facetHeight * 2, 20)],
      [Point3d.create(facetWidth * 2, facetHeight, 21), Point3d.create(facetWidth * 3, facetHeight, 22), Point3d.create(facetWidth * 3, facetHeight * 2, 23), Point3d.create(facetWidth * 2, facetHeight * 2, 24)],
      [Point3d.create(0, facetHeight * 2, 25), Point3d.create(facetWidth, facetHeight * 2, 26), Point3d.create(facetWidth, facetHeight * 3, 27), Point3d.create(0, facetHeight * 3, 28)],
      [Point3d.create(facetWidth, facetHeight * 2, 29), Point3d.create(facetWidth * 2, facetHeight * 2, 30), Point3d.create(facetWidth * 2, facetHeight * 3, 31), Point3d.create(facetWidth, facetHeight * 3, 32)],
      [Point3d.create(facetWidth * 2, facetHeight * 2, 33), Point3d.create(facetWidth * 3, facetHeight * 2, 34), Point3d.create(facetWidth * 3, facetHeight * 3, 35), Point3d.create(facetWidth * 2, facetHeight * 3, 36)],
    ];

    const options = new StrokeOptions();
    options.needParams = true;
    options.needNormals = true;
    options.shouldTriangulate = false;
    options.maxEdgeLength = 4;

    const builder = PolyfaceBuilder.create(options);
    builder.addGrid(grid, undefined, undefined, true);
    const polyface = builder.claimPolyface(false);

    ck.testExactNumber(polyface.pointCount, polyface.normalCount, "Number of normals match point count");
    ck.testExactNumber(polyface.pointCount, polyface.paramCount, "Number of params matches point count");

    // Check params
    for (let idx = 0; idx < polyface.data.paramIndex!.length; idx++) {
      const currentPoint = polyface.data.point.getPoint3dAt(idx);
      const currentParam = polyface.data.param![idx];
      if (idx % 4 === 0) {
        ck.testCoordinate(currentParam.x, 0);
        ck.testCoordinate(currentParam.y, 0);
      } else if (idx % 4 === 1) {
        const oldPoint = polyface.data.point.getPoint3dAt(idx - 1);
        ck.testCoordinate(currentParam.x, Math.hypot(currentPoint.x - oldPoint.x, currentPoint.y - oldPoint.y, currentPoint.z - oldPoint.z));
        ck.testCoordinate(polyface.data.param![idx].y, 0);
      }
      // else if (idx % 4 === 2)
      // else
    }

    // Check normals
    for (let idx = 0; idx < polyface.data.normalIndex!.length - 1; idx++) {
      if (idx % 4 === 0) {
        const pointA = polyface.data.point.getPoint3dAt(idx);
        const pointB = polyface.data.point.getPoint3dAt(idx + 1);
        const pointC = polyface.data.point.getPoint3dAt(idx + 1);
        const vecAB = pointA.vectorTo(pointB);
        const vecAC = pointA.vectorTo(pointC);
        ck.testCoordinate(polyface.data.normal![idx].dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx].dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 1].dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 1].dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 2].dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 2].dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 3].dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
        ck.testCoordinate(polyface.data.normal![idx + 3].dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
      }
    }

    expect(ck.getNumErrors()).equals(0);
  });

  it.skip("Solid primitive param verification with native", () => {
    const options = new StrokeOptions();
    options.needNormals = true;
    options.needParams = true;
    const builder = PolyfaceBuilder.create(options);
    builder.toggleReversedFacetFlag();
    const torusPipes = Sample.createTorusPipes();

    builder.addTorusPipe(torusPipes[1]);
    builder.addTorusPipe(torusPipes[2]);

    const polyface = builder.claimPolyface();
    const nativePolyface = JSON.parse(fs.readFileSync("./src/test/deepComparisonTestFiles/Polyface.ParamsAndNormals.dgnjs", "utf8"));

    const jsParams = polyface.data.param;
    const jsParamsIdx = polyface.data.paramIndex;
    const nativeParams = nativePolyface.Group.Member[0].IndexedMesh.Param;
    const nativeParamIdx = nativePolyface.Group.Member[0].IndexedMesh.ParamIndex;
    ck.testExactNumber(jsParamsIdx!.length, nativeParamIdx!.length, "Number of params match");
    for (let i = 0; i < jsParams!.length; i++) {
      ck.testCoordinate(jsParams![polyface.data.paramIndex![i]].x, nativeParams![nativeParamIdx![i]][0]);
      ck.testCoordinate(jsParams![polyface.data.paramIndex![i]].y, nativeParams![nativeParamIdx![i]][1]);
    }

    const jsNormals = polyface.data.normal;
    const jsNormalIdx = polyface.data.normalIndex;
    const nativeNormals = nativePolyface.Group.Member[0].IndexedMesh.Normal;
    const nativeNormalIdx = nativePolyface.Group.Member[0].IndexedMesh.NormalIndex;
    ck.testExactNumber(jsNormalIdx!.length, nativeNormalIdx!.length, "Number of params match");
    for (let i = 0; i < jsNormals!.length; i++) {
      ck.testCoordinate(jsNormals![polyface.data.normalIndex![i]].x, nativeNormals![nativeNormalIdx![i]][0]);
      ck.testCoordinate(jsNormals![polyface.data.normalIndex![i]].y, nativeNormals![nativeNormalIdx![i]][1]);
      ck.testCoordinate(jsNormals![polyface.data.normalIndex![i]].z, nativeNormals![nativeNormalIdx![i]][2]);
    }

    expect(ck.getNumErrors()).equals(0);
  });
});

it("facets from sweep contour", () => {
  const ck = new Checker();

  // sawtooth. Triangulate leading portions that are valid polygons (edge from origin does not cross)
  const fullSawtooth = [
    Point3d.create(0, 0, 0),
    Point3d.create(3, 0, 0),
    Point3d.create(3, 2, 0),
    Point3d.create(2, 2, 0),
    Point3d.create(2, 1, 0),
    Point3d.create(1, 1, 0),
    Point3d.create(1, 2, 0),
    Point3d.create(0, 2, 0)];
  for (const numPoints of [3, 5, 6, 7, 8]) {
    const polygonPoints = fullSawtooth.slice(0, numPoints);
    const loop = Loop.createPolygon(polygonPoints);
    const sweepContour = SweepContour.createForLinearSweep(loop);

    const options = new StrokeOptions();
    options.needNormals = false;
    options.needParams = false;
    const builder = PolyfaceBuilder.create(options);

    sweepContour!.emitFacets(builder, options, false);
    const polyface = builder.claimPolyface(true);
    if (!ck.testExactNumber(polygonPoints.length - 2, polyface.facetCount, "Triangle count in polygon")) {
      const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
      console.log(prettyPrint(jsPolyface));
    }
  }
  expect(ck.getNumErrors()).equals(0);
});

it("facets for ACS", () => {
  const ck = new Checker();
  const savedMeshes = [];
  let counter0 = 0;
  for (const a of [4.5, 4.1, 3.5, 3]) {
    // sawtooth. Triangulate leading portions that are valid polygons (edge from origin does not cross)
    const basePoints = [
      Point3d.create(0, 1, 0),
      Point3d.create(4, 1, 0),
      Point3d.create(a, 0, 0),
      Point3d.create(6, 2, 0),
      Point3d.create(a, 4, 0),
      Point3d.create(4, 3, 0),
      Point3d.create(0, 3, 0)];
    let counter1 = 0;
    for (let startIndex = 0; startIndex < basePoints.length; startIndex++) {
      const arrowPoints = [];
      for (let j = 0; j < basePoints.length; j++)
        arrowPoints.push(basePoints[(startIndex + j) % basePoints.length]);
      const loop = Loop.createPolygon(arrowPoints);
      const sweepContour = SweepContour.createForLinearSweep(loop);

      const options = new StrokeOptions();
      options.needNormals = false;
      options.needParams = false;
      const builder = PolyfaceBuilder.create(options);

      sweepContour!.emitFacets(builder, options, false);
      const polyface = builder.claimPolyface(true);
      if (!ck.testExactNumber(arrowPoints.length - 2, polyface.facetCount, "Triangle count in arrow " + counter0 + "." + counter1)) {
        console.log(" Triangulation From Start index " + startIndex);
        const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
        console.log(prettyPrint(arrowPoints));
        console.log(prettyPrint(jsPolyface));
      }
      polyface.tryTranslateInPlace(counter1 * 10, counter0 * 10, 0);
      savedMeshes.push(polyface);
      counter1++;
    }
    counter0++;
  }
  GeometryCoreTestIO.saveGeometry(savedMeshes, "Polyface", "ACSArrows");;
  expect(ck.getNumErrors()).equals(0);
});

it("facets from sweep contour with holes", () => {
  const ck = new Checker();
  const region = ParityRegion.create(
    Loop.create(LineString3d.createRectangleXY(Point3d.create(0, 0, 0), 5, 5)),
    Loop.create(LineString3d.createRectangleXY(Point3d.create(1, 1, 0), 1, 1)));
  const sweepContour = SweepContour.createForLinearSweep(region);

  const options = new StrokeOptions();
  options.needNormals = false;
  options.needParams = false;
  const builder = PolyfaceBuilder.create(options);

  sweepContour!.emitFacets(builder, options, false);
  const polyface = builder.claimPolyface(true);
  //    The real test -- when triangulator is ready . . .if (!ck.testExactNumber(8, polyface.facetCount, "Triangle count in retangle with rectangle hole")) {
  if (true) {
    const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
    console.log(prettyPrint(jsPolyface));
  }
  expect(ck.getNumErrors()).equals(0);

});
