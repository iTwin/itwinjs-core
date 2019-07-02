/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IndexedPolyface, Polyface, IndexedPolyfaceVisitor } from "../../polyface/Polyface";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Transform } from "../../geometry3d/Transform";
import { Range3d, Range2d } from "../../geometry3d/Range";
import { SolidPrimitive } from "../../solid/SolidPrimitive";
import { LineString3d } from "../../curve/LineString3d";
import { ParityRegion } from "../../curve/ParityRegion";
import { Loop } from "../../curve/Loop";
import { SweepContour } from "../../solid/SweepContour";
import { Checker } from "../Checker";
import { expect } from "chai";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import * as fs from "fs";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { prettyPrint } from "../testFunctions";
import { Arc3d } from "../../curve/Arc3d";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { UVSurface } from "../../geometry3d/GeometryHandler";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Angle } from "../../geometry3d/Angle";
import { Cone } from "../../solid/Cone";
import { Sphere } from "../../solid/Sphere";
/* tslint:disable:no-console */

// @param longEdgeIsHidden true if any edge longer than1/3 of face perimeter is expected to be hidden
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
    // make sure visitors move together ..
    ck.testTrue(visitor1.moveToNextFacet(), "wrapped visitor tracks unwrapped");
    const readIndex = visitor.currentReadIndex();
    ck.testExactNumber(readIndex, visitor1.currentReadIndex(), "current read index");
    const numEdge = visitor.pointCount;
    const numPoint1 = visitor1.pointCount;
    ck.testExactNumber(numEdge + 1, numPoint1, "wrapped visitor has extra point on each face");

    for (let i = 0; i < numPoint1; i++) {
      const pointIndexA = visitor1.clientPointIndex(i);
      const pointA = visitor1.point.getPoint3dAtUncheckedPointIndex(i);
      polyface.data.copyPointTo(pointIndexA, pointB);
      if (!ck.testPoint3d(pointA, pointB)) {
        const pointIndexQ = visitor1.clientPointIndex(i);
        const pointQ = visitor1.point.getPoint3dAtUncheckedPointIndex(i);
        polyface.data.copyPointTo(pointIndexQ, pointB);
        ck.testPoint3d(pointQ, pointB);
      } else {
        // check reused versus new ..
        const pointY = polyface.data.getPoint(pointIndexA)!;
        polyface.data.copyPointTo(pointIndexA, pointZ);
        ck.testPoint3d(pointY, pointZ, "polyface getPoint, copyPointTo");

        const paramIndexA = visitor1.clientParamIndex(i);
        const paramY = polyface.data.getParam(paramIndexA);
        polyface.data.copyParamTo(paramIndexA, paramZ);
        if (ck.testPointer(paramY) && paramY)
          ck.testPoint2d(paramY, paramZ, "polyface getParam, copyParamTo");

        const normalIndexA = visitor1.clientNormalIndex(i);
        const normalY = polyface.data.getNormal(normalIndexA);
        if (ck.testPointer(normalY) && normalY) {
          polyface.data.copyNormalTo(normalIndexA, normalZ);
          ck.testVector3d(normalY, normalZ, "polyface getPoint, copyPointTo");
        }
      }
    }
    // test visibility flags
    if (longEdgeIsHidden) {
      let perimeter = 0;
      for (let i = 0; i < numEdge; i++) {
        perimeter += visitor1.point.getPoint3dAtUncheckedPointIndex(i).distance(visitor1.point.getPoint3dAtUncheckedPointIndex(i + 1));
      }
      for (let i = 0; i < numEdge; i++) {
        const a = visitor1.point.getPoint3dAtUncheckedPointIndex(i).distance(visitor1.point.getPoint3dAtUncheckedPointIndex(i + 1));
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
 * automatically claimed depending on the polyface built.
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
      ck.testFalse(faceData.paramDistanceRange.isNull, "paramDistanceRange should not be null");
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
    ck.testVector3d(Vector3d.unitZ(), polyface0.data.getNormal(0)!, "access normal");
    const point0 = polyface0.data.getPoint(0)!;
    const param0 = polyface0.data.getParam(numX * numY - 1)!;
    const normal0 = polyface0.data.getNormal(0);
    ck.testPoint3d(origin, point0);
    if (param0 && ck.testPointer(param0)) {
      ck.testExactNumber(param0.x, numX - 1);
      ck.testExactNumber(param0.y, numY - 1);
    }
    ck.testVector3d(normal0!, Vector3d.unitZ());
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
      Matrix3d.createScale(-1, 1, 1));
    const polyface2 = polyface0.cloneTransformed(mirrorX);
    const expectedArea = (numX - 1) * (numY - 1);
    const numExpectedFacets = 2 * (numX - 1) * (numY - 1); // 2 triangles per quad .  .
    const expectedEdgeLength = numExpectedFacets * (2.0 + Math.sqrt(2.0));
    for (const pf of [polyface0, polyface1, polyface2]) {
      const loops = PolyfaceQuery.indexedPolyfaceToLoops(pf);
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
    const loops = PolyfaceQuery.indexedPolyfaceToLoops(polyface);
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
      Matrix3d.createScale(2, 3, 4)));

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
    polyfaceB.data.pointIndex[0] -= 1;
    ck.testTrue(polyface.isAlmostEqual(polyfaceB), "index change undo");
    // console.log(polyfaceB);
    expect(ck.getNumErrors()).equals(0);
  });
});

function writeMeshes(geometry: GeometryQuery[], fileName: string, options?: StrokeOptions, dx0: number = 0, dy0: number = 0) {
  let fileName1 = fileName.slice() + ".X";
  if (options) {
    if (options.hasMaxEdgeLength) fileName1 = fileName1 + "E";
    if (options.needNormals) fileName1 = fileName1 + "N";
    if (options.needParams) fileName1 = fileName1 + "P";
  }

  const allMesh = [];
  let dx = dx0;
  let gCount = -1;
  for (const g of geometry) {
    gCount++;
    if (options === undefined) {
      options = new StrokeOptions();
    }
    const builder = PolyfaceBuilder.create(options);

    const gRange = g.range();
    const dyLocal = Math.max(20.0, 2.0 * gRange.yLength());
    const dxLocal = Math.max(10.0, 1.25 * gRange.xLength());
    const dyUSection = dyLocal;
    const dyVSection = 2.0 * dyLocal;
    const transformForPolyface = Transform.createTranslationXYZ(dx, dy0, 0);
    const transformForPolyfaceRangeSticks = Transform.createTranslationXYZ(dx, dy0 + dyVSection, 0);

    if (!gRange.isNull) {
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
      ls.tryTransformInPlace(transformForPolyfaceRangeSticks);
      allMesh.push(ls);
    }
    builder.addGeometryQuery(g);
    const polyface = builder.claimPolyface();

    if (polyface) {
      const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(0.25, 0.25, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(10)));
      const polyfaceA = polyface.cloneTransformed(rotationTransform)!;
      polyfaceA.tryTranslateInPlace(0, 1.5 * (gRange.high.y - gRange.low.y));
      polyfaceA.tryTransformInPlace(transformForPolyface);

      polyface.tryTransformInPlace(transformForPolyface);
      allMesh.push(polyface);
      allMesh.push(polyfaceA);
    }
    if (g instanceof SolidPrimitive) {
      const isClosedMesh = PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface);
      const isClosedSolid = g.isClosedVolume;
      if (polyface.isEmpty) {
        console.log(fileName1, gCount + " of " + geometry.length + "is empty polyface");
      } else if (isClosedMesh !== isClosedSolid)
        console.log(fileName1, gCount + " of " + geometry.length, { isClosedBySolid: isClosedSolid, isClosedByEdgePairing: isClosedMesh });
      for (const f of [0.0, 0.10, 0.20, 0.25, 0.50, 0.75, 1.0]) {
        const section = g.constantVSection(f);
        if (section) {
          section.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy0 + dyVSection, 0));
          allMesh.push(section);
        }
        if ((g as any).constantUSection) {
          const uSection = (g as any).constantUSection(f);
          if (uSection) {
            uSection.tryTransformInPlace(Transform.createTranslationXYZ(dx, dy0 + dyUSection, 0));
            allMesh.push(uSection);
          }
        }
      }
    }
    dx += dxLocal;
  }
  if (allMesh.length > 0) {
    GeometryCoreTestIO.saveGeometry(allMesh, "Polyface", fileName1);
  }

}
// call writeMeshes with multiple options and placements
function writeAllMeshes(geometry: GeometryQuery[], name: string, options: StrokeOptions[], y0: number, dy: number) {
  for (let i = 0; i < options.length; i++) {
    writeMeshes(geometry, name, options[i], 0, y0 + i * dy);
  }

}
type GeometryData = GeometryQuery | GeometryQuery[];
function flattenGeometry(...data: GeometryData[]): GeometryQuery[] {
  const result = [];
  for (const member of data) {
    if (member instanceof GeometryQuery)
      result.push(member);
    else if (Array.isArray(member))
      for (const g of member)
        result.push(g);
  }
  return result;
}
describe("Polyface.Facets", () => {
  const options0 = new StrokeOptions();
  const options0E = new StrokeOptions();
  options0E.maxEdgeLength = 0.5;
  const optionsN = new StrokeOptions();
  const optionsP = new StrokeOptions();
  const optionsPN = new StrokeOptions();
  const optionsPNE = new StrokeOptions();
  optionsP.needParams = true;
  optionsN.needNormals = true;
  optionsPN.needNormals = true;
  optionsPN.needParams = true;

  optionsPNE.needNormals = true;
  optionsPNE.needParams = true;
  optionsPNE.maxEdgeLength = 0.5;

  const bigYStep = 800.0;       // step between starts for different solid types
  const optionYStep = 100.0;    // steps between starts for option variants of same solid type
  const y0OpenSweeps = 0.0;
  const y0ClosedSampler = y0OpenSweeps + bigYStep;
  const y0Box = y0ClosedSampler + bigYStep;
  const y0Cone = y0Box + bigYStep;
  const y0Sphere = y0Cone + bigYStep;
  const y0TorusPipe = y0Sphere + bigYStep;
  const y0LinearSweep = y0TorusPipe + bigYStep;
  const y0RotationalSweep = y0LinearSweep + bigYStep;
  const y0RuledSweep = y0RotationalSweep + bigYStep;
  const allOptions = [options0, optionsN, optionsP, options0E, optionsPNE];
  // const allEOptions = [options0E, optionsPNE];
  it("Cones", () => {
    const all = Sample.createCones();
    // writeAllMeshes(all, "ConeE", [optionsP], -y0Cone, optionYStep);
    writeAllMeshes(all, "Cone", allOptions, y0Cone, optionYStep);
  });
  it("Spheres", () => {
    const all = Sample.createSpheres();
    // writeAllMeshes(all, "SphereNN", [optionsN], 0.0, optionYStep);
    writeAllMeshes(all, "Sphere", allOptions, y0Sphere, optionYStep);
  });
  it("Boxes", () => {
    const allBox = flattenGeometry(Sample.createBoxes(false), Sample.createBoxes(true));
    writeAllMeshes(allBox, "Box", allOptions, y0Box, optionYStep);
  });
  it("TorusPipes", () => {
    const allBox = Sample.createTorusPipes();
    writeAllMeshes(allBox, "TorusPipe", allOptions, y0TorusPipe, optionYStep);
  });
  it("LinearSweeps", () => {
    // writeAllMeshes(Sample.createSimpleLinearSweeps(), "LinearSweepSubset", allEOptions, -y0LinearSweep, optionYStep);
    writeAllMeshes(Sample.createSimpleLinearSweeps(), "LinearSweep", allOptions, y0LinearSweep, optionYStep);
  });

  it("RotationalSweeps", () => {
    writeAllMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", allOptions, y0RotationalSweep, optionYStep);
    //     writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", optionsP, 0, y0LinearSweep + 2 * optionYStep);
    //    writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", options0E, 0, y0RotationalSweep);
    //    writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", optionsN, 0, y0RotationalSweep + optionYStep);
  });
  it("RuledSweeps", () => {
    const sweepP = Sample.createRuledSweeps(true);
    writeAllMeshes(sweepP, "RuledSweep", allOptions, y0RuledSweep, optionYStep);

    //    writeMeshes(sweepP, "RuledSweep", optionsP, 0, y0RuledSweep + 2 * optionYStep);
    //    const sweepB = Sample.createRuledSweeps(true);
    //    writeMeshes(sweepB, "RuledSweep", options0E, 0, y0RuledSweep);
    // const sweepA = Sample.createRuledSweeps(true);
    // writeMeshes(sweepA, "RuledSweep", optionsN, 0, y0RuledSweep + optionYStep);
  });
  it("Samplers", () => {
    const openSweeps = Sample.createClosedSolidSampler(false);
    writeAllMeshes([openSweeps[4]], "Work", [optionsPNE, optionsPNE], y0OpenSweeps, optionYStep);
    writeAllMeshes(openSweeps, "OpenSweeps", allOptions, y0OpenSweeps, optionYStep);
    const closedSolids = Sample.createClosedSolidSampler(true);
    writeAllMeshes(closedSolids, "ClosedSweeps", allOptions, y0ClosedSampler, optionYStep);
  });

});

describe("Polyface.Faces", () => {

  it("Verify FacetFaceData Exists", () => {
    const ck = new Checker();
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
    //   (cone handles faces itself !!)  ck.testTrue(builder.endFace());

    ck.testExactNumber(3, polyface.faceCount);
    verifyFaceData(ck, polyface, false);

    expect(ck.getNumErrors()).equals(0);
  });

  it("Add grid w/ params, normals", () => {
    const ck = new Checker();
    const facetWidth = 5;
    const facetHeight = 6;
    const y0 = 0;
    const y1 = facetHeight;
    const y2 = 2 * facetHeight;
    const y3 = 3 * facetHeight;
    const x0 = 0.0;
    const x1 = facetWidth;
    const x2 = 2.0 * facetWidth;
    const x3 = 3.0 * facetWidth;
    const grid: Point3d[][] = [
      [Point3d.create(x0, y0, 1), Point3d.create(x1, y0, 2), Point3d.create(x1, y1, 3), Point3d.create(x0, y1, 4)],
      [Point3d.create(x1, y0, 5), Point3d.create(x2, y0, 6), Point3d.create(x2, y1, 7), Point3d.create(x1, y1, 8)],
      [Point3d.create(x2, y0, 9), Point3d.create(x3, y0, 10), Point3d.create(x3, y1, 11), Point3d.create(x2, y1, 12)],
      [Point3d.create(x0, y1, 13), Point3d.create(x1, y1, 14), Point3d.create(x1, y2, 15), Point3d.create(x0, y2, 16)],
      [Point3d.create(x1, y1, 17), Point3d.create(x2, y1, 18), Point3d.create(x2, y2, 19), Point3d.create(x1, y2, 20)],
      [Point3d.create(x2, y1, 21), Point3d.create(x3, y1, 22), Point3d.create(x3, y2, 23), Point3d.create(x2, y2, 24)],
      [Point3d.create(x0, y2, 25), Point3d.create(x1, y2, 26), Point3d.create(x1, y3, 27), Point3d.create(x0, y3, 28)],
      [Point3d.create(x1, y2, 29), Point3d.create(x2, y2, 30), Point3d.create(x2, y3, 31), Point3d.create(x1, y3, 32)],
      [Point3d.create(x2, y2, 33), Point3d.create(x3, y2, 34), Point3d.create(x3, y3, 35), Point3d.create(x2, y3, 36)],
    ];

    const options = new StrokeOptions();
    options.needParams = true;
    options.needNormals = true;
    options.shouldTriangulate = false;
    options.maxEdgeLength = 4;

    const builder = PolyfaceBuilder.create(options);
    builder.addCoordinateFacets(grid, undefined, undefined, true);
    const polyface = builder.claimPolyface(false);

    // ck.testExactNumber(polyface.pointCount, polyface.normalCount, "Number of normals match point count");
    ck.testExactNumber(polyface.pointCount, polyface.paramCount, "Number of params matches point count");

    // Check params
    for (let idx = 0; idx < polyface.data.paramIndex!.length; idx++) {
      const currentPoint = polyface.data.point.getPoint3dAtUncheckedPointIndex(idx);
      const currentParam = polyface.data.param!.getPoint2dAtCheckedPointIndex(idx)!;
      if (idx % 4 === 0) {
        ck.testCoordinate(currentParam.x, 0);
        ck.testCoordinate(currentParam.y, 0);
      } else if (idx % 4 === 1) {
        const oldPoint = polyface.data.point.getPoint3dAtUncheckedPointIndex(idx - 1);
        ck.testCoordinate(currentParam.x, Math.hypot(currentPoint.x - oldPoint.x, currentPoint.y - oldPoint.y, currentPoint.z - oldPoint.z));
        ck.testCoordinate(polyface.data.param!.getYAtUncheckedPointIndex(idx), 0);
      }
      // else if (idx % 4 === 2)
      // else
    }
    /*  EDL -- this test makes assumptions about normal indices.
        With recent (Feb 2019) optimizations of normal constructions, the normals cannot be accessed this way.
        // Check normals
        for (let idx = 0; idx < polyface.data.normalIndex!.length - 1; idx++) {
          if (idx % 4 === 0) {
            const pointA = polyface.data.point.getPoint3dAt(idx);
            const pointB = polyface.data.point.getPoint3dAt(idx + 1);
            const pointC = polyface.data.point.getPoint3dAt(idx + 2);
            const vecAB = pointA.vectorTo(pointB);
            const vecAC = pointA.vectorTo(pointC);
            const normalArray = polyface.data.normal!;
            ck.testCoordinate(normalArray.atVector3dIndex(idx)!.dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx)!.dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 1)!.dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 1)!.dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 2)!.dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 2)!.dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 3)!.dotProduct(vecAB), 0, "Normal is perpendicular to grid surface");
            ck.testCoordinate(normalArray.atVector3dIndex(idx + 3)!.dotProduct(vecAC), 0, "Normal is perpendicular to grid surface");
          }
        }
    */
    expect(ck.getNumErrors()).equals(0);
  });
  // cspell:word dgnjs
  it.skip("Solid primitive param verification with native", () => {
    const ck = new Checker();
    const options = new StrokeOptions();
    options.needParams = true;
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
      ck.testCoordinate(jsParams!.getXAtUncheckedPointIndex(polyface.data.paramIndex![i]), nativeParams![nativeParamIdx![i]][0]);
      ck.testCoordinate(jsParams!.getYAtUncheckedPointIndex(polyface.data.paramIndex![i]), nativeParams![nativeParamIdx![i]][1]);
    }

    const jsNormals = polyface.data.normal!;
    const jsNormalIdx = polyface.data.normalIndex;
    const nativeNormals = nativePolyface.Group.Member[0].IndexedMesh.Normal;
    const nativeNormalIdx = nativePolyface.Group.Member[0].IndexedMesh.NormalIndex;
    ck.testExactNumber(jsNormalIdx!.length, nativeNormalIdx!.length, "Number of params match");
    for (let i = 0; i < jsNormals!.length; i++) {
      const normal = jsNormals.getVector3dAtCheckedVectorIndex(i)!;
      ck.testCoordinate(normal.x, nativeNormals![nativeNormalIdx![i]][0]);
      ck.testCoordinate(normal.y, nativeNormals![nativeNormalIdx![i]][1]);
      ck.testCoordinate(normal.z, nativeNormals![nativeNormalIdx![i]][2]);
    }

    expect(ck.getNumErrors()).equals(0);
  });
});

it("PartialSawToothTriangulation", () => {
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
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0.0;
  const dy = 10.0;
  for (const numPoints of [3, 5, 6, 7, 8]) {
    let y0 = 0.0;
    const polygonPoints = fullSawtooth.slice(0, numPoints);
    const loop = Loop.createPolygon(polygonPoints);
    const sweepContour = SweepContour.createForLinearSweep(loop);

    const options = new StrokeOptions();
    options.needParams = false;
    options.needParams = false;
    const builder = PolyfaceBuilder.create(options);

    sweepContour!.emitFacets(builder, false);
    const polyface = builder.claimPolyface(true);
    if (!ck.testExactNumber(polygonPoints.length - 2, polyface.facetCount, "Triangle count in polygon")) {
      const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
      console.log(prettyPrint(jsPolyface));
    }
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(polygonPoints), x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry, polyface, x0, y0 += dy);
    x0 += dy;
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "PartialSawToothTriangulation");
  expect(ck.getNumErrors()).equals(0);
});

it("facets from sweep contour with holes", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const arc = Arc3d.createCircularStartMiddleEnd(
    Point3d.create(3, 3, 0),
    Point3d.create(4, 3, 0),
    Point3d.create(4, 4, 0)) as Arc3d;
  arc.sweep = (AngleSweep.createStartEndDegrees(0, 360));
  const region = ParityRegion.create(
    Loop.create(LineString3d.createRectangleXY(Point3d.create(0, 0, 0), 5, 5)),
    Loop.create(LineString3d.createRectangleXY(Point3d.create(1, 1, 0), 1, 1)),
    Loop.create(arc));
  allGeometry.push(region);

  const sweepContour = SweepContour.createForLinearSweep(region);
  const options = new StrokeOptions();
  options.needParams = false;
  options.needParams = false;
  const builder = PolyfaceBuilder.create(options);
  sweepContour!.emitFacets(builder, false);
  const polyface = builder.claimPolyface(true);
  polyface.tryTranslateInPlace(0, 10, 0);
  allGeometry.push(polyface);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Triangulation", "ParityRegion");
  expect(ck.getNumErrors()).equals(0);

});

function createGridMeshByCoordinates(numXEdge: number, numYEdge: number, xShiftCounter: number, reverseFacets: boolean, needParams: boolean, needNormals: boolean) {
  const options = StrokeOptions.createForFacets();
  options.needNormals = needNormals;
  options.needParams = needParams;
  options.shouldTriangulate = true;
  const builder = PolyfaceBuilder.create(options);
  if (reverseFacets)
    builder.toggleReversedFacetFlag();
  const spacing = 1.0;
  const xShift = xShiftCounter * numXEdge * spacing;

  for (let iRow = 0; iRow < numXEdge; iRow++) {
    for (let iColumn = 0; iColumn < numYEdge; iColumn++) {
      const quad = [Point3d.create(xShift + iRow * spacing, iColumn * spacing, 0.0),
      Point3d.create(xShift + (iRow + 1) * spacing, iColumn * spacing, 0.0),
      Point3d.create(xShift + (iRow + 1) * spacing, (iColumn + 1) * spacing, 0.0),
      Point3d.create(xShift + iRow * spacing, (iColumn + 1) * spacing)];
      builder.addQuadFacet(quad);
    }
  }
  return builder.claimPolyface();
}

function createMeshByUVSurface(surface: UVSurface, numXEdge: number, numYEdge: number, reverseFacets: boolean, needParams: boolean, needNormals: boolean) {
  const options = StrokeOptions.createForFacets();
  options.needNormals = needNormals;
  options.needParams = needParams;
  options.shouldTriangulate = true;
  const builder = PolyfaceBuilder.create(options);
  if (reverseFacets)
    builder.toggleReversedFacetFlag();
  builder.addUVGridBody(surface, numXEdge + 1, numYEdge + 1);
  return builder.claimPolyface();
}

it("LargeMeshCompression", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  allGeometry.push(createGridMeshByCoordinates(100, 100, 0.0, false, false, false));
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "LargeMeshCompression");
  expect(ck.getNumErrors()).equals(0);
});

class UVSinusoidalSurface implements UVSurface {
  public thetaU: AngleSweep;
  public thetaV: AngleSweep;
  public transform: Transform;
  constructor(thetaU: AngleSweep, thetaV: AngleSweep, transform: Transform) {
    this.thetaU = thetaU;
    this.thetaV = thetaV;
    this.transform = transform;
  }
  public uvFractionToPoint(u: number, v: number): Point3d {
    const thetaU = this.thetaU.fractionToRadians(u);
    const thetaV = this.thetaV.fractionToRadians(v);
    return this.transform.multiplyXYZ(u, v, Math.cos(thetaU) * Math.cos(thetaV));
  }
  public uvFractionToPointAndTangents(u: number, v: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const thetaU = this.thetaU.fractionToRadians(u);
    const thetaV = this.thetaV.fractionToRadians(v);
    const cU = Math.cos(thetaU);
    const sU = Math.sin(thetaU);
    const cV = Math.cos(thetaV);
    const sV = Math.sin(thetaV);
    if (!result)
      result = Plane3dByOriginAndVectors.createXYPlane();
    this.transform.multiplyXYZ(u, v, cU * cV, result.origin);
    this.transform.multiplyVectorXYZ(1.0, 0.0, -sU * cV, result.vectorU);
    this.transform.multiplyVectorXYZ(0.0, 1.0, -cU * sV, result.vectorV);
    return result;
  }

}

it("UVGridSurface", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const surface = new UVSinusoidalSurface(AngleSweep.createStartEndDegrees(0, 180), AngleSweep.createStartEndDegrees(20, 100),
    Transform.createRowValues(
      4, 0, 0, 0,
      0, 4, 0, 0,
      0, 0, 1, 0));

  allGeometry.push(createMeshByUVSurface(surface, 4, 6, false, true, true));
  surface.transform.origin.set(10, 0, 0);
  allGeometry.push(createMeshByUVSurface(surface, 4, 6, true, true, true));
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "UVGridSurface");
  expect(ck.getNumErrors()).equals(0);
});

it("AddTriangleFan", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const options = StrokeOptions.createForFacets();
  options.shouldTriangulate = true;
  const builder = PolyfaceBuilder.create(options);
  const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(4, 0, 0), Point3d.create(3, 3, 0), Point3d.create(0, 4, 0))!;
  const strokes = LineString3d.create();
  arc.emitStrokes(strokes, options);
  ck.testUndefined(builder.findOrAddPointInLineString(strokes, strokes.numPoints() + 10), " confirm bad index in linestring");
  ck.testUndefined(builder.findOrAddPointInLineString(strokes, -1), " confirm bad index in linestring");
  const coneA = Point3d.create(0, 0, 5);
  const coneB = Point3d.create(0, 0, -3);
  // upward cone
  builder.addTriangleFan(coneA, strokes, false);
  // matching downward cone
  builder.addTriangleFan(coneB, strokes, true);

  const polyface = builder.claimPolyface();
  allGeometry.push(polyface);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddTriangleFan");
  expect(ck.getNumErrors()).equals(0);
});

it("AddTriangles", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const options = StrokeOptions.createForFacets();
  options.needNormals = true;
  options.needParams = true;
  const builder = PolyfaceBuilder.create(options);
  const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(4, 0, 0), Point3d.create(3, 3, 0), Point3d.create(0, 4, 0))!;
  const strokes = LineString3d.create();
  arc.emitStrokes(strokes, options);

  const coneA = Point3d.create(0, 0, 10);
  const coneB = Point3d.create(0, 0, -1);

  const points = [];
  const params = [];
  const normals = [];
  const normalA = Vector3d.create();
  //  const params = [];
  //  const normals = [];
  const du = 1.0 / strokes.numPoints();
  for (let i = 1; i < strokes.numPoints(); i++) {
    points.length = 0;
    points.push(coneA);
    points.push(strokes.pointAt(i - 1)!);
    points.push(strokes.pointAt(i)!);
    params.length = 0;
    params.push(Point2d.create(0, 0));
    params.push(Point2d.create(1.0, (i - 1) * du));
    params.push(Point2d.create(0, i * du));
    normals.length = 0;
    points[0].crossProductToPoints(points[1], points[2], normalA);
    normals.push(normalA);
    normals.push(normalA);
    normals.push(normalA);
    builder.addTriangleFacet(points, params, normals);

    // build lower half without params.
    points.length = 0;
    points.push(coneB);
    points.push(strokes.pointAt(i)!);
    points.push(strokes.pointAt(i - 1)!);
    builder.addTriangleFacet(points);

  }

  const polyface = builder.claimPolyface();
  allGeometry.push(polyface);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddTriangles");
  expect(ck.getNumErrors()).equals(0);
});

function buildWrappedVertexCrossProducts(points: Point3d[]): Vector3d[] {
  const normals = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const normal = points[i].crossProductToPoints(points[(i + 1) % n], points[(i + 2) % n]);
    normal.normalizeInPlace();
    normals.push(normal);
  }
  return normals;
}
it("AddQuads", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const options = StrokeOptions.createForFacets();
  options.needNormals = true;
  options.shouldTriangulate = true;
  options.needParams = true;
  const builder = PolyfaceBuilder.create(options);
  const pointA = [];
  const pointB = [];
  const paramA = [];
  const paramB = [];
  const dMax = 180.0;
  const theta = Angle.createDegrees(0);
  for (let d = 0; d <= 180; d += 30) {
    const u = d / dMax;
    theta.setDegrees(90 + d);
    pointA.push(Point3d.create(u, 0));
    pointB.push(Point3d.create(u, 1.1 + theta.cos()));
    paramA.push(Point2d.create(u, 0));
    paramB.push(Point2d.create(u, 1));
  }
  const points = [];
  for (let i = 1; i < pointA.length; i++) {
    points.length = 0;
    const k = i - 1;
    points.push(pointA[k]);
    points.push(pointA[i]);
    points.push(pointB[i]);
    points.push(pointB[k]);
    builder.addQuadFacet(points,
      [paramA[k], paramA[i], paramB[i], paramB[k]],
      buildWrappedVertexCrossProducts(points));
  }

  const polyface = builder.claimPolyface();
  allGeometry.push(polyface);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddQuads");
  expect(ck.getNumErrors()).equals(0);
});

it("AddPolyface", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];

  const polyfaceA = Sample.createTriangularUnitGridPolyface(
    Point3d.create(0, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(), 2, 3, true, true, true);

  const polyfaceB = Sample.createTriangularUnitGridPolyface(
    Point3d.create(5, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(), 2, 3, true, true, true);

  const options = StrokeOptions.createForFacets();
  options.needNormals = true;
  options.needParams = true;
  options.needColors = true;
  const builder = PolyfaceBuilder.create(options);
  builder.addIndexedPolyface(polyfaceA, false);
  builder.addIndexedPolyface(polyfaceB, true);
  const mergedPolyface = builder.claimPolyface(true);

  GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceA, 0, 0, 0);
  GeometryCoreTestIO.captureGeometry(allGeometry, polyfaceB, 0, 0, 0);

  GeometryCoreTestIO.captureGeometry(allGeometry, mergedPolyface, 0, 10, 0);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddPolyface");
  expect(ck.getNumErrors()).equals(0);
});
it("EmptyPolyface", () => {
  const ck = new Checker();
  const emptyPolyface = IndexedPolyface.create(false, false, false);
  ck.testFalse(emptyPolyface.isAlmostEqual(undefined));
  ck.testFalse(emptyPolyface.isSameGeometryClass(undefined));
  ck.testTrue(emptyPolyface.isSameGeometryClass(emptyPolyface));
  ck.testUndefined(PolyfaceQuery.computePrincipalAreaMoments(emptyPolyface), "Expect moment failure in empty polyface");
  expect(ck.getNumErrors()).equals(0);
});

it("VisitorParamQueries", () => {
  for (const s of [
    Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 5), 1.0, 0.5, true)!,
    Sphere.createCenterRadius(Point3d.create(0, 0, 0), 2.0, AngleSweep.createStartEndDegrees(0, 90)),
  ]) {
    const options = new StrokeOptions();
    options.needParams = true;
    options.needNormals = true;
    const builder = PolyfaceBuilder.create(options);
    // builder.toggleReversedFacetFlag();
    s.dispatchToGeometryHandler(builder);
    const polyface = builder.claimPolyface(true);
    const visitor = polyface.createVisitor(0) as IndexedPolyfaceVisitor;
    let facetIndex = 0;
    const distanceRange = Range2d.createNull();
    const fractionRange = Range2d.createNull();
    for (; visitor.moveToNextFacet(); facetIndex++) {
      for (let i = 0; i < visitor.numEdgesThisFacet; i++) {
        const distanceParam = visitor.tryGetDistanceParameter(i);
        const fractionParam = visitor.tryGetNormalizedParameter(i);
        distanceRange.extendPoint(distanceParam!);
        fractionRange.extendPoint(fractionParam!);
      }
    }
  }
});

it("VisitorQueryFailures", () => {
  const ck = new Checker();
  const options = new StrokeOptions();
  options.needParams = false;
  options.needNormals = true;
  const builder = PolyfaceBuilder.create(options);
  builder.toggleReversedFacetFlag();
  const cone = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 5), 1.0, 0.5, true)!;
  builder.addCone(cone);
  const polyface = builder.claimPolyface(true);
  const visitor = polyface.createVisitor(0) as IndexedPolyfaceVisitor;
  if (ck.testTrue(visitor.moveToNextFacet())) {
    // exercise failure cases in parameter queries.
    // edge index is tested first . .
    ck.testUndefined(visitor.tryGetDistanceParameter(100));
    ck.testUndefined(visitor.tryGetNormalizedParameter(100));
    // then array presence ...
    ck.testUndefined(visitor.tryGetDistanceParameter(0));
    ck.testUndefined(visitor.tryGetNormalizedParameter(0));
  }
  expect(ck.getNumErrors()).equals(0);
});

it("IndexValidation", () => {
  const ck = new Checker();
  const indices = [0, 1, 2, 3, 4, 7, 6, 5];
  const data = [9, 8, 7, 6, 5, 4, 3, 2, 1, 100];
  ck.testFalse(Polyface.areIndicesValid(undefined,
    - 1, 3,   // range to examine
    data, 1), "confirm face index range out of bounds detected");
  ck.testFalse(Polyface.areIndicesValid(indices,
    - 1, 3,   // range to examine
    undefined, 1), "confirm face index range out of bounds detected");

  ck.testFalse(Polyface.areIndicesValid(indices,
    - 1, 3,   // range to examine
    data, 1), "confirm face index range out of bounds detected");

  ck.testFalse(Polyface.areIndicesValid(indices,
    10, 3,   // range to examine
    data, 1), "confirm face index range out of bounds detected");
  ck.testFalse(Polyface.areIndicesValid(indices,
    3, 0,   // range to examine
    data, 1), "confirm face index range out of bounds detected");
  ck.testFalse(Polyface.areIndicesValid(indices,
    0, 20,   // range to examine
    data, 1), "confirm face index range out of bounds detected");

  ck.testFalse(Polyface.areIndicesValid(indices,
    0, 3,   // range to examine
    data, 1), "confirm index out of bounds detected");
  ck.testTrue(Polyface.areIndicesValid(indices,
    0, 3,   // range to examine
    data, 10), "validate indices");
  ck.testTrue(Polyface.areIndicesValid(undefined,
    0, 3,   // range to examine
    undefined, 10), "validate double undefined indices");

  expect(ck.getNumErrors()).equals(0);
});
/*
public static areIndicesValid(indices: number[] | undefined,
  indexPositionA: number, indexPositionB: number, data: any | undefined, dataLength: number): boolean {
    */
