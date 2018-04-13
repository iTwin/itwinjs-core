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
import { Checker } from "./Checker";
import { expect } from "chai";
import { IModelJson } from "../serialization/IModelJsonSchema";
import * as fs from "fs";
import { GeometryCoreTestIO } from "./IModelJson.test";
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
