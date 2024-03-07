/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { randomInt } from "crypto";
import * as fs from "fs";
import { CloneFunction, Dictionary, OrderedComparator } from "@itwin/core-bentley";
import { ClipUtilities } from "../../clipping/ClipUtils";
import { Arc3d } from "../../curve/Arc3d";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { UVSurface } from "../../geometry3d/GeometryHandler";
import { GrowableXYArray } from "../../geometry3d/GrowableXYArray";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../../geometry3d/Plane3dByOriginAndVectors";
import { Point2d } from "../../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range2d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { XAndY, XYAndZ } from "../../geometry3d/XYZProps";
import { YawPitchRollAngles } from "../../geometry3d/YawPitchRollAngles";
import { MomentData } from "../../geometry4d/MomentData";
import { FacetFaceData } from "../../polyface/FacetFaceData";
import { IndexedPolyface, Polyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceData } from "../../polyface/PolyfaceData";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { IModelJson } from "../../serialization/IModelJsonSchema";
import { Box } from "../../solid/Box";
import { Cone } from "../../solid/Cone";
import { SolidPrimitive } from "../../solid/SolidPrimitive";
import { Sphere } from "../../solid/Sphere";
import { TorusPipe } from "../../solid/TorusPipe";
import { Triangulator } from "../../topology/Triangulation";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { prettyPrint } from "../testFunctions";
import { ImportedSample } from "../testInputs/ImportedSamples";

// pass "longEdgeIsHidden = true" if any edge longer than 1/3 of face perimeter is expected to be hidden
function exercisePolyface(ck: Checker, polyface: Polyface, longEdgeIsHidden: boolean) {
  const twoSidedA = polyface.twoSided;
  polyface.twoSided = false;
  ck.testFalse(polyface.twoSided);
  polyface.twoSided = true;
  ck.testTrue(polyface.twoSided);
  polyface.twoSided = twoSidedA;

  const range = polyface.range();
  const range1 = Range3d.create();
  polyface.extendRange(range1);
  ck.testRange3d(range, range1);

  const visitor = polyface.createVisitor(0);
  const numWrap = 1;
  const visitor1 = polyface.createVisitor(numWrap);
  let facetIndex = 0;
  for (; visitor.moveToNextFacet(); facetIndex++) {
    ck.testTrue(visitor1.moveToNextFacet(), "move to next facet via visitor1"); // visitors move together
    ck.testExactNumber(visitor.currentReadIndex(), visitor1.currentReadIndex(), "current read index");
    const numEdge = visitor.pointCount;
    const numPoint1 = visitor1.pointCount;
    ck.testExactNumber(numEdge + numWrap, numPoint1, "wrapped visitor has an extra point on each face");

    const pointB = Point3d.create();
    const pointZ = Point3d.create();
    const paramZ = Point2d.create();
    const normalZ = Vector3d.create();
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
        const pointY = polyface.data.getPoint(pointIndexA)!;
        polyface.data.copyPointTo(pointIndexA, pointZ);
        ck.testPoint3d(pointY, pointZ, "polyface getPoint, copyPointTo");

        const paramIndexA = visitor1.clientParamIndex(i);
        const paramY = polyface.data.getParam(paramIndexA);
        polyface.data.copyParamTo(paramIndexA, paramZ);
        if (ck.testPointer(paramY))
          ck.testPoint2d(paramY, paramZ, "polyface getParam, copyParamTo");

        const normalIndexA = visitor1.clientNormalIndex(i);
        const normalY = polyface.data.getNormal(normalIndexA);
        if (ck.testPointer(normalY)) {
          polyface.data.copyNormalTo(normalIndexA, normalZ);
          ck.testVector3d(normalY, normalZ, "polyface getPoint, copyPointTo");
        }
      }
    }

    if (longEdgeIsHidden) {
      let perimeter = 0;
      for (let i = 0; i < numEdge; i++) {
        perimeter += visitor1.point.getPoint3dAtUncheckedPointIndex(i).distance(
          visitor1.point.getPoint3dAtUncheckedPointIndex(i + 1),
        );
      }
      for (let i = 0; i < numEdge; i++) {
        const a = visitor1.point.getPoint3dAtUncheckedPointIndex(i).distance(
          visitor1.point.getPoint3dAtUncheckedPointIndex(i + 1),
        );
        const v = visitor1.getEdgeVisible(i);
        if (!ck.testBoolean(a < perimeter / 3.0, v, "diagonal edges are hidden")) {
          GeometryCoreTestIO.consoleLog({ faceCounter: facetIndex, edgeIndex: i, edgeLength: a, visibilityFlag: v });
          GeometryCoreTestIO.consoleLog({ faceCounter: facetIndex, edgeIndex: i, edgeLength: a, visibilityFlag: v });
        }
      }
    }
  }
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
    const faceData = polyface.tryGetFaceData(i);
    if (ck.testType(faceData, FacetFaceData)) {
      if (shouldCheckParamDistance)
        ck.testFalse(faceData.paramDistanceRange.isNull, "paramDistanceRange should not be null");
    }
  }
}

describe("Polyface.HelloWorld", () => {
  it("Polyface.HelloWorld", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const origin = Point3d.create(1, 2, 3);
    const numX = 3;
    const numY = 2;
    const polyface0 = Sample.createTriangularUnitGridPolyface(
      origin, Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0),
      numX, numY,
      true, true, true, // params, normals, and colors
    );
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "HelloWorld");
    // we know that "normal" is 001 and "params" are integer
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
    const numFacet = 2 * (numX - 1) * (numY - 1); // 2 triangles per quad
    ck.testExactNumber(
      numFacet * 4, polyface0.zeroTerminatedIndexCount, "zeroTerminatedIndexCount in triangular grid: (A B C 0)",
    );
    ck.testExactNumber(numFacet, 2 * polyface0.colorCount, "known color count in one-color-per-quad grid");
    ck.testExactNumber(1, polyface0.normalCount, "single normal for planar grid");
    const polyface1 = polyface0.clone();
    const mirrorX = Transform.createFixedPointAndMatrix(Point3d.createZero(), Matrix3d.createScale(-1, 1, 1));
    const polyface2 = polyface0.cloneTransformed(mirrorX);
    const expectedArea = (numX - 1) * (numY - 1);
    const numExpectedFacets = 2 * (numX - 1) * (numY - 1); // 2 triangles per quad
    const expectedEdgeLength = numExpectedFacets * (2.0 + Math.sqrt(2.0));
    for (const pf of [polyface0, polyface1, polyface2]) {
      const loops = PolyfaceQuery.indexedPolyfaceToLoops(pf);
      ck.testExactNumber(pf.facetCount, loops.children.length, "facet count");
      ck.testCoordinate(expectedArea, PolyfaceQuery.sumFacetAreas(pf), "unit square facets area");
      ck.testCoordinate(expectedEdgeLength, loops.sumLengths(), "sum of triangle facets perimeter");
      exercisePolyface(ck, pf, true);
    }
    ck.checkpoint("Polyface.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Polyface.Compress", () => {
    const ck = new Checker();
    const polyface = IndexedPolyface.create(true, true);
    // create with duplicate points and params on edge
    polyface.addPoint(Point3d.create(0, 0, 0));
    polyface.addParam(Point2d.create(0, 0));
    polyface.addPoint(Point3d.create(1, 0, 0));
    polyface.addParam(Point2d.create(1, 0));
    polyface.addPoint(Point3d.create(1, 1, 0));
    polyface.addParam(Point2d.create(1, 1));

    polyface.addPoint(Point3d.create(1, 1, 0));
    polyface.addParam(Point2d.create(1, 1));
    polyface.addPoint(Point3d.create(0, 1, 0));
    polyface.addParam(Point2d.create(0, 1));
    polyface.addPoint(Point3d.create(0, 0, 0));
    polyface.addParam(Point2d.create(0, 0));

    for (let i = 0; i < 6; ++i)
      polyface.addNormalXYZ(0, 0, 1); // addNormalXYZ to force redundant normals

    const addIndex = (idx: number) => {
      polyface.addPointIndex(idx);
      polyface.addNormalIndex(idx);
      polyface.addParamIndex(idx);
    };
    addIndex(0);
    addIndex(1);
    addIndex(2);
    polyface.terminateFacet();
    addIndex(3);
    addIndex(4);
    addIndex(5);
    polyface.terminateFacet();
    polyface.data.compress();
    const loops = PolyfaceQuery.indexedPolyfaceToLoops(polyface);
    // GeometryCoreTestIO.consoleLog("polyface area", PolyfaceQuery.sumFacetAreas(polyface));
    // GeometryCoreTestIO.consoleLog(loops);
    ck.testCoordinate(1.0, PolyfaceQuery.sumFacetAreas(polyface), "unit square facets area");
    ck.testCoordinate(loops.sumLengths(),
      4 + 2 * Math.sqrt(2));

    ck.testExactNumber(4, polyface.data.point.length, "compressed point count");
    ck.testExactNumber(1, polyface.data.normal!.length, "compressed point count");
    ck.testExactNumber(4, polyface.data.param!.length, "compressed point count");
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
    const volumeXY = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(polyface, Plane3dByOriginAndUnitNormal.createXYPlane(Point3d.create(1, 1, 0)));
    const planeQ = Plane3dByOriginAndUnitNormal.create(Point3d.create(1, 2, 3), Vector3d.create(3, -1, 2))!;
    const volumeQ = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(polyface, planeQ);
    ck.testCoordinate(expectedArea, area);
    ck.testCoordinate(expectedVolume, volume, "tetrahedral volume");
    ck.testCoordinate(expectedVolume, volumeXY.volume, "volume computed between mesh and xy plane");
    ck.testCoordinate(expectedVolume, volumeQ.volume, "volume computed between mesh and non-principal plane");
    polyface.reverseIndices();
    const area1 = PolyfaceQuery.sumFacetAreas(polyface);
    const volume1 = PolyfaceQuery.sumTetrahedralVolumes(polyface);
    ck.testCoordinate(-expectedVolume, volume1, "index reversal negates volume");
    ck.testCoordinate(expectedArea, area1, "area unaffected by index reversal");
    ck.checkpoint("Polyface.Box");
    expect(ck.getNumErrors()).equals(0);

    const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
    // GeometryCoreTestIO.consoleLog("imjs polyface", jsPolyface);
    const polyfaceB = IModelJson.Reader.parse(jsPolyface) as IndexedPolyface;
    ck.testBoolean(true, polyface.isAlmostEqual(polyfaceB), "polyface round trip");
    polyfaceB.data.pointIndex[0] += 1;
    ck.testBoolean(false, polyface.isAlmostEqual(polyfaceB), "index change detection");
    polyfaceB.data.pointIndex[0] -= 1;
    ck.testTrue(polyface.isAlmostEqual(polyfaceB), "index change undo");
    // GeometryCoreTestIO.consoleLog(polyfaceB);
    expect(ck.getNumErrors()).equals(0);
  });

  it("Polyface.RaggedBoxVolume", () => {
    const ck = new Checker();
    const builder = PolyfaceBuilder.create();
    const a = 2; const b = 3; const c = 4;
    const expectedVolume = a * b * c;
    const expectedAreaZX = a * c;
    const xzPlane = Plane3dByOriginAndUnitNormal.createZXPlane();
    const openBox = Box.createRange(Range3d.createXYZXYZ(0, 0, 0, a, b, c), false);
    builder.addBox(openBox!);
    const polyface = builder.claimPolyface();
    // the box is open top and bottom !!
    const volumeZX = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(polyface, xzPlane);
    ck.testDefined(volumeZX.positiveProjectedFacetAreaMoments);
    ck.testDefined(volumeZX.negativeProjectedFacetAreaMoments);
    if (volumeZX.positiveProjectedFacetAreaMoments && volumeZX.negativeProjectedFacetAreaMoments) {
      ck.testCoordinate(expectedAreaZX, volumeZX.positiveProjectedFacetAreaMoments.quantitySum);
      ck.testCoordinate(expectedAreaZX, volumeZX.negativeProjectedFacetAreaMoments.quantitySum);
      ck.testCoordinate(expectedVolume, volumeZX.volume);
      ck.testCentroidAndRadii(volumeZX.positiveProjectedFacetAreaMoments, volumeZX.negativeProjectedFacetAreaMoments, "open box ragged moments");
    }
    // In other planes, the missing facets are NOT perpendicular, and we expect to detect the mismatched projections in the moments.
    const planeB = Plane3dByOriginAndUnitNormal.createXYZUVW(0, 0, 0, 1, 2, 3)!;
    const volumeB = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(polyface, planeB)!;
    ck.testFalse(MomentData.areEquivalentPrincipalAxes(volumeB.positiveProjectedFacetAreaMoments, volumeB.negativeProjectedFacetAreaMoments), "Expect mismatched moments");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Polyface.RaggedBoxMisMatch", () => {
    const ck = new Checker();

    const ay = 1.0;
    const ax0 = 4.0;  // significantly bitter than ay so principal X is global x even if either or both are multiplied by a factor not to far from 1
    const zPlane = Plane3dByOriginAndUnitNormal.createXYPlane();
    const f = 0.9;
    // exercise deep branches in axis equivalence
    const zTop = 1;
    const zBottom = -1;
    // point with (x,y,q)
    //    q = 0 means do not expect same moments.
    //    q = 1 means expect same moments
    for (const corner of [
      Point3d.create(ax0, ay, 1),    // everything matches
      Point3d.create(-ax0, -ay, 1),    // everything matches
      Point3d.create(ax0 * f, ay / f, 0),    // area matches
      Point3d.create(ax0 * 2, ay, 0),    // same orientation, different radii.
      Point3d.create(ax0, ay * 0.9, 0),    // same orientation, different radii.
      Point3d.create(ay, ax0, 0),    // rotate 90 degrees, same radii
    ]) {
      const builder = PolyfaceBuilder.create();
      const bx = corner.x;
      const by = corner.y;
      const expectSameMoments = corner.z === 1;
      // positive polygon
      builder.addPolygon([Point3d.create(-ax0, -ay, zTop), Point3d.create(ax0, -ay, zTop), Point3d.create(ax0, ay, zTop), Point3d.create(-ax0, ay, zTop)]);
      builder.addPolygon([Point3d.create(-bx, -by, zBottom), Point3d.create(-bx, by, zBottom), Point3d.create(bx, by, zBottom), Point3d.create(bx, -by, zBottom)]);
      const polyface = builder.claimPolyface();
      const volumeData = PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(polyface, zPlane);
      ck.testBoolean(expectSameMoments, MomentData.areEquivalentPrincipalAxes(volumeData.positiveProjectedFacetAreaMoments, volumeData.negativeProjectedFacetAreaMoments), "Expect mismatched moments");
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("Polyface.IntersectLocalRangeBoxes", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    interface TestCase {
      data: { localRange: Range3d, localToWorld: Transform, worldClashRange?: Range3d }[];
      expectedClash: boolean; // each entry is a set of mutually clashing or mutually non-clashing local ranges
      clashRange?: (undefined | Range3d)[][];  // clashRange[i][j] is world range of intersection of data[i] and data[j], defined only for i < j
    }
    const testCases: TestCase[] = [ // from user iModel
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(-0.023434012896785816, -5.00413553129377, -9.650393591767262, 20.02343401289663, 5.03613553129378, 9.68239359176722),
            localToWorld: Transform.createRefs(Point3d.create(-108.12092516312605, 80.97820829881688, 67.15651552186583), YawPitchRollAngles.createDegrees(-47.95656913000159, 15.000000000006024, 90).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.024019658687571166, -0.020559836132079568, -0.047579717945438915, 0.10484869637410554, 0.09055983613204432, 0.0975797179454645),
            localToWorld: Transform.createRefs(Point3d.create(-95.29966304738043, 66.6762028551563, 72.28348554781851), YawPitchRollAngles.createDegrees(42.04343086998508, -4.9775680764904035e-11, 74.99999999999397).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.041116288886769325, -0.04342022062438389, -0.21911795212515983, 0.3411162888867949, 0.3434202206242212, 0.22911795212515074),
            localToWorld: Transform.createRefs(Point3d.create(-95.14478995681672, 66.78879158941069, 72.16981588733208), YawPitchRollAngles.createDegrees(132.0434308699035, 75.00000000001432, 8.799644912641437e-11).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-95.36397573926465, 66.58616814357191, 72.25131173394928, -95.15511302989337, 66.79795624308294, 72.396215121783),
            Range3d.createXYZXYZ(-95.60069397863792, 66.44083908685087, 72.07338870288137, -95.00616526632447, 67.04061581909228, 72.53902056524058),
          ],
          [
            undefined,
            undefined,
            Range3d.createXYZXYZ(-95.36397573926463, 66.58616814357194, 72.25131173394928, -95.15511302989336, 66.79795624308295, 72.39621512178302),
          ],
        ],
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(1.1546319456101628e-14, -1.4328815911568427e-14, -5.1535165024318985e-14, 11.999999999999943, 0.03199999999999116, 0.031999999999948535),
            localToWorld: Transform.createRefs(Point3d.create(-119.10528623043024, 43.39951280844136, 68.47662261522927), YawPitchRollAngles.createDegrees(-6.448039711171915, 15.000000000002194, 1.6754791257296069).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(0, 0, -1.4210854715202004e-14, 11.999999999999986, 0, -1.4210854715202004e-14),
            localToWorld: Transform.createRefs(Point3d.create(-107.5899903512084, 42.11371219204531, 71.59835123713896), YawPitchRollAngles.createDegrees(173.55196028882585, -14.99999999999978, 2.0579703138818464e-16).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.02213513258379224, -0.018579865396888717, -0.19678412188787828, 0.5721351325838432, 0.5685798653970273, 0.22178412188785057),
            localToWorld: Transform.createRefs(Point3d.create(-107.61315829094143, 42.393081259141205, 71.29907515904608), YawPitchRollAngles.createDegrees(173.5519602888134, 74.99999999996545, 5.981534282323202e-12).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-119.10777616425821, 42.11371219204531, 68.4925226959081, -107.5899903512084, 43.415418394376765, 71.59835123713894),
            Range3d.createXYZXYZ(-107.90948424949468, 42.09780660611036, 71.4978732020779, -107.5841489131751, 42.16506585450406, 71.61425131781793),
          ],
          [
            undefined,
            undefined,
            Range3d.createXYZXYZ(-107.90364281146148, 42.11371219204531, 71.513773282757, -107.5899903512084, 42.149160268569325, 71.59835123713894),
          ],
        ],
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(-5, -5, -5, 5, 5, 5),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(-3, -6, -9), Matrix3d.createRotationAroundVector(Vector3d.create(1, 1, 1), Angle.createDegrees(33))),
          },
          {
            localRange: Range3d.createXYZXYZ(-2, -2, -2, 2, 2, 2),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(5, 5, 5), Matrix3d.createRotationAroundVector(Vector3d.create(-1, 1, -1), Angle.createDegrees(-115))),
          },
          {
            localRange: Range3d.createXYZXYZ(-1, -1, -1, 1, 1, 1),
            localToWorld: Transform.createOriginAndMatrix(Point3d.create(-10, 4, 3), Matrix3d.createRotationAroundVector(Vector3d.create(0, 1, -1), Angle.createDegrees(245))),
          },
        ],
        expectedClash: false,
      },
      {
        data: [
          {
            localRange: Range3d.createXYZXYZ(7.993605777301127e-15, 1.1483869410966463e-15, -8.895661984809067e-15, 11.999999999999961, 0.03200000000001247, 0.03200000000001958),
            localToWorld: Transform.createRefs(Point3d.create(-118.75022305842617, 45.954529463039, 68.47641991136159), YawPitchRollAngles.createDegrees(-9.408029798593397, 15.000000000007361, 2.455595252575587).toMatrix3d()),
          },
          {
            localRange: Range3d.createXYZXYZ(-0.03474118660066772, -3.3591167872492598, -1.714177531529474, 11.744741186600766, 3.4591167872486275, 1.8141775315289306),
            localToWorld: Transform.createRefs(Point3d.create(-118.82046236854137, 46.0485514387863, 68.44465610136753), YawPitchRollAngles.createDegrees(-9.40802979863332, 15.000000000003949, 113.91380925648686).toMatrix3d()),
          },
        ],
        expectedClash: true,
        clashRange: [
          [
            undefined,
            Range3d.createXYZXYZ(-118.75861047954066, 44.11431206598608, 68.47641991136157, -107.63915480739682, 45.9861280555703, 71.52509446528897),
          ],
        ],
      },
    ];
    let z = 0;
    for (const testCase of testCases) {
      const maxRange = Point3d.createZero();
      for (const datum of testCase.data)
        maxRange.set(Math.max(maxRange.x, datum.localRange.xLength()), Math.max(maxRange.y, datum.localRange.yLength()), Math.max(maxRange.z, datum.localRange.zLength()));
      const delta = maxRange.maxAbs();
      const delta10 = 10 * delta;
      let x = 0;
      for (let i = 0; i < testCase.data.length; ++i) {
        for (let j = i + 1; j < testCase.data.length; ++j) {
          let y = 0;
          // lambda to exercise local range clash methods
          const clashDetect = (index0: number, index1: number, captureLocal: boolean = false, captureWorld: boolean = true, captureIntersection: boolean = true): boolean => {
            if (captureLocal) {
              // doLocalRangesIntersect converts range0 to a polyface transformed into range1's local coordinates
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index0].localRange, testCase.data[index1].localToWorld.inverse()?.multiplyTransformTransform(testCase.data[index0].localToWorld), x, y, z);
              GeometryCoreTestIO.captureRangeEdges(allGeometry, testCase.data[index1].localRange, x, y, z);
            }
            if (captureWorld) {
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index0].localRange, testCase.data[index0].localToWorld, x, y, z);
              GeometryCoreTestIO.captureTransformedRangeEdges(allGeometry, testCase.data[index1].localRange, testCase.data[index1].localToWorld, x, y, z);
            }
            const isClash = ClipUtilities.doLocalRangesIntersect(testCase.data[index0].localRange, testCase.data[index0].localToWorld, testCase.data[index1].localRange, testCase.data[index1].localToWorld);
            ck.testBoolean(isClash, testCase.expectedClash, `ranges clash as expected: i=${index0} j=${index1}`);
            const clashRange = ClipUtilities.rangeOfIntersectionOfLocalRanges(testCase.data[index0].localRange, testCase.data[index0].localToWorld, testCase.data[index1].localRange, testCase.data[index1].localToWorld);
            if (captureIntersection)
              GeometryCoreTestIO.captureRangeEdges(allGeometry, clashRange, x, y, z);
            if (ck.testTrue(isClash === !clashRange.isNull, "intersection range is non-null iff ranges clash") && isClash)
              ck.testRange3d(clashRange, testCase.clashRange![Math.min(index0, index1)][Math.max(index0, index1)]!, "intersection has expected world range");
            return isClash;
          };

          const clashIJ = clashDetect(i, j);
          y += delta10;
          const clashJI = clashDetect(j, i);
          ck.testBoolean(clashIJ, clashJI, `symmetric arguments: i=${i} j=${j}`);

          // cover the margin case, no output or test
          ClipUtilities.doLocalRangesIntersect(testCase.data[i].localRange, testCase.data[i].localToWorld, testCase.data[j].localRange, testCase.data[j].localToWorld, 1.0);
          x += delta10;
        }
      }
      z += delta10;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "IntersectLocalRangeBoxes");
    expect(ck.getNumErrors()).equals(0);
  });
});

function writeMeshes(
  ck: Checker,
  geometry: GeometryQuery[],
  fileName: string,
  checkClosure: boolean,
  options?: StrokeOptions,
  dx0: number = 0,
  dy0: number = 0,
) {
  let fileName1 = `${fileName.slice()}.X`;
  if (options) {
    if (options.hasMaxEdgeLength)
      fileName1 = `${fileName1}E`;
    if (options.needNormals)
      fileName1 = `${fileName1}N`;
    if (options.needParams)
      fileName1 = `${fileName1}P`;
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
        corners[0], corners[1], corners[5], corners[1],
        corners[3], corners[7], corners[3], corners[2],
        corners[6], corners[2], corners[2], corners[0],
        corners[4], corners[5], corners[7], corners[6], corners[4],
      );
      ls.tryTransformInPlace(transformForPolyfaceRangeSticks);
      allMesh.push(ls);
    }
    builder.addGeometryQuery(g);
    const polyface = builder.claimPolyface();
    if (polyface) {
      const rotationTransform = Transform.createFixedPointAndMatrix(
        Point3d.create(0.25, 0.25, 0), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(10)),
      );
      const polyfaceA = polyface.cloneTransformed(rotationTransform)!;
      polyfaceA.tryTranslateInPlace(0, 1.5 * (gRange.high.y - gRange.low.y));
      polyfaceA.tryTransformInPlace(transformForPolyface);
      polyface.tryTransformInPlace(transformForPolyface);
      allMesh.push(polyface);
      allMesh.push(polyfaceA);
    }
    if (g instanceof SolidPrimitive) {
      const isClosedMesh = PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface);
      if (!isClosedMesh) {
        const boundary = PolyfaceQuery.boundaryEdges(polyface);
        if (boundary !== undefined)
          allMesh.push(boundary);
      }
      const isClosedSolid = g.isClosedVolume;
      if (polyface.isEmpty) {
        GeometryCoreTestIO.consoleLog(fileName1, `${gCount} of ${geometry.length} is empty polyface`);
      } else if (isClosedMesh !== isClosedSolid) {
        GeometryCoreTestIO.consoleLog(
          fileName1,
          `${gCount} of ${geometry.length}`,
          { isClosedBySolid: isClosedSolid, isClosedByEdgePairing: isClosedMesh },
        );
        PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(polyface);
        const isClosedMesh1 = PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface);
        // GeometryCoreTestIO.consoleLog(
        //   "After Reorient " + fileName1,
        //   {
        //     isClosedBySolid: isClosedSolid,
        //     isClosedByEdgePairing: isClosedMesh, isClosedByEdgePairing1: isClosedMesh1,
        //   },
        // );
        if (isClosedSolid !== isClosedMesh1) {
          if (options.hasMaxEdgeLength) {
            // we think there is a bug in edge length splits. Let's see if we can fix it up with TVertex logic ...
            const polyface2 = PolyfaceQuery.cloneWithTVertexFixup(polyface);
            PolyfaceQuery.reorientVertexOrderAroundFacetsForConsistentOrientation(polyface2);
            const isClosedMesh2 = PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface2);
            polyface2.tryTranslateInPlace(0, dyLocal);
            allMesh.push(polyface2);
            if (checkClosure)
              ck.testBoolean(isClosedSolid, isClosedMesh2, "Closure after TVertex Fixup");
            GeometryCoreTestIO.consoleLog(
              `After Reorient AND T VERTEX ${fileName1}`,
              {
                isClosedBySolid: isClosedSolid,
                isClosedByEdgePairing: isClosedMesh,
                isClosedByEdgePairing2: isClosedMesh2,
              },
            );
          } else if (checkClosure) {
            if (!ck.testBoolean(isClosedSolid, isClosedMesh1, "post-fixup solid closure"))
              GeometryCoreTestIO.consoleLog(
                `After Reorient ${fileName1}`,
                {
                  isClosedBySolid: isClosedSolid,
                  isClosedByEdgePairing: isClosedMesh,
                  isClosedByEdgePairing1: isClosedMesh1,
                },
              );
          }
        }
      }
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
function writeAllMeshes(
  geometry: GeometryQuery[], name: string, checkClosure: boolean, options: StrokeOptions[], y0: number, dy: number,
) {
  const ck = new Checker();
  for (let i = 0; i < options.length; i++) {
    writeMeshes(ck, geometry, name, checkClosure, options[i], 0, y0 + i * dy);
  }
  expect(ck.getNumErrors()).equals(0);
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
  const optionsE = new StrokeOptions();
  const optionsN = new StrokeOptions();
  const optionsP = new StrokeOptions();
  const optionsPN = new StrokeOptions();
  const optionsPNE = new StrokeOptions();

  optionsE.maxEdgeLength = 0.5;
  optionsN.needNormals = true;
  optionsP.needParams = true;
  optionsPN.needNormals = true;
  optionsPN.needParams = true;
  optionsPNE.maxEdgeLength = 0.5;
  optionsPNE.needNormals = true;
  optionsPNE.needParams = true;

  const bigYStep = 800.0;        // step between starts for different solid types
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
  const allOptions = [options0, optionsN, optionsP, optionsE, optionsPNE];
  it("Cones", () => {
    const all = Sample.createCones();
    // writeAllMeshes(all, "ConeE", [optionsP], -y0Cone, optionYStep);
    writeAllMeshes(all, "Cone", true, allOptions, y0Cone, optionYStep);
  });
  it("Spheres", () => {
    const all = Sample.createSpheres();
    // writeAllMeshes(all, "SphereNN", [optionsN], 0.0, optionYStep);
    writeAllMeshes(all, "Sphere", true, allOptions, y0Sphere, optionYStep);
  });
  it("SpheresDensity", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const allCountsA = [];
    const allCountsB = [];
    const allCountsC = [];
    let y0 = 0;
    for (const a of [10, 22, 45]) {
      const countsA = [];
      const countsB = [];
      const countsC = [];
      // use a as both angle in degrees and multiplier of chordTol
      const optionsA = StrokeOptions.createForFacets();
      const optionsB = StrokeOptions.createForFacets();
      const optionsC = StrokeOptions.createForFacets();
      optionsA.angleTol = undefined;
      optionsB.angleTol = undefined;
      optionsC.angleTol = undefined;
      optionsA.angleTol = Angle.createDegrees(a);
      optionsA.chordTol = undefined;
      optionsB.chordTol = a * 0.1;
      optionsB.angleTol = undefined;
      let xA = 0;
      let xB = 400;
      let xC = 800;
      for (const radius of [1, 64, 4096]) {
        optionsC.maxEdgeLength = radius / 4.0;
        xA += 2 * radius;
        xB += 2 * radius;
        xC += 2 * radius;
        const sphere = Sphere.createCenterRadius(Point3d.create(1, 23), radius);
        const builderA = PolyfaceBuilder.create(optionsA);
        builderA.addSphere(sphere);
        const facetsA = builderA.claimPolyface();
        ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(facetsA), "closure of sphere mesh with angle tol");
        if (radius < 80)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, facetsA, xA, y0);
        countsA.push(facetsA.facetCount);

        const builderB = PolyfaceBuilder.create(optionsB);
        builderB.addSphere(sphere);
        const facetsB = builderB.claimPolyface();
        ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(facetsB), "closure of sphere mesh with chord tol");
        countsB.push(facetsB.facetCount);
        if (radius < 80)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, facetsB, xB, y0);
        const builderC = PolyfaceBuilder.create(optionsC);
        builderC.addSphere(sphere);
        const facetsC = builderC.claimPolyface();
        ck.testTrue(PolyfaceQuery.isPolyfaceClosedByEdgePairing(facetsC), "closure of sphere mesh with maxEdgeLength");
        countsC.push(facetsC.facetCount);
        if (radius < 80)
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, facetsC, xC, y0);

      }
      ck.testExactNumber(countsA[0], countsA[1], "angleTol counts not affected by radius");
      ck.testExactNumber(countsA[1], countsA[2], "angleTol counts not affected by radius");
      ck.testLT(countsB[0], countsB[1], "radiusTol count increases with radius");
      ck.testLT(countsB[1], countsB[2], "radiusTol count increases with radius");

      ck.testExactNumber(countsC[0], countsC[1], "fractional maxEdgeLength counts no affected by radius");
      ck.testExactNumber(countsC[1], countsC[2], "fractional maxEdgeLength counts no affected by radius");

      y0 += 200.0;
      allCountsA.push(countsA);
      allCountsB.push(countsB);
      allCountsC.push(countsC);
    }
    GeometryCoreTestIO.consoleLog({ angleCounts: allCountsA, chordCounts: allCountsB, maxEdgeLengthCounts: allCountsC });
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "SphereDensity");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Boxes", () => {
    const allBox = flattenGeometry(Sample.createBoxes(false), Sample.createBoxes(true));
    writeAllMeshes(allBox, "Box", true, allOptions, y0Box, optionYStep);
  });
  it("TorusPipes", () => {
    const allBox = Sample.createTorusPipes();
    writeAllMeshes(allBox, "TorusPipe", true, allOptions, y0TorusPipe, optionYStep);
  });
  it("LinearSweeps", () => {
    // writeAllMeshes(Sample.createSimpleLinearSweeps(), "LinearSweepSubset", allEOptions, -y0LinearSweep, optionYStep);
    writeAllMeshes(Sample.createSimpleLinearSweeps(), "LinearSweep", true, allOptions, y0LinearSweep, optionYStep);
  });

  it("RotationalSweeps", () => {
    writeAllMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", true, allOptions, y0RotationalSweep, optionYStep);
    // writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", optionsP, 0, y0LinearSweep + 2 * optionYStep);
    // writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", optionsE, 0, y0RotationalSweep);
    // writeMeshes(Sample.createSimpleRotationalSweeps(), "RotationalSweep", optionsN, 0, y0RotationalSweep + optionYStep);
  });
  it("RuledSweeps", () => {
    const sweepP = Sample.createRuledSweeps(true);
    writeAllMeshes(sweepP, "RuledSweep", true, allOptions, y0RuledSweep, optionYStep);
    // writeMeshes(sweepP, "RuledSweep", optionsP, 0, y0RuledSweep + 2 * optionYStep);
    // const sweepB = Sample.createRuledSweeps(true);
    // writeMeshes(sweepB, "RuledSweep", optionsE, 0, y0RuledSweep);
    // const sweepA = Sample.createRuledSweeps(true);
    // writeMeshes(sweepA, "RuledSweep", optionsN, 0, y0RuledSweep + optionYStep);
  });
  it("Samplers", () => {
    const openSweeps = Sample.createClosedSolidSampler(false);
    writeAllMeshes([openSweeps[4]], "Work", true, [optionsPNE, optionsPNE], y0OpenSweeps, optionYStep);
    writeAllMeshes(openSweeps, "OpenSweeps", true, allOptions, y0OpenSweeps, optionYStep);
    const closedSolids = Sample.createClosedSolidSampler(true);
    writeAllMeshes(closedSolids, "ClosedSweeps", false, allOptions, y0ClosedSampler, optionYStep);
  });

  it("Moments", () => {
    const allGeometry: GeometryQuery[] = [];
    const closedSweeps = Sample.createClosedSolidSampler(true);
    const dx = 20.0;
    const dy = 20.0;
    let x0 = 0;
    const y0 = 0;
    for (const s of closedSweeps) {
      const builder = PolyfaceBuilder.create();
      builder.addGeometryQuery(s);
      const mesh = builder.claimPolyface();
      const areaMoments = PolyfaceQuery.computePrincipalAreaMoments(mesh);
      const volumeMoments = PolyfaceQuery.computePrincipalVolumeMoments(mesh);
      GeometryCoreTestIO.captureGeometry(allGeometry, s, x0, y0);
      GeometryCoreTestIO.showMomentData(allGeometry, areaMoments, false, x0, y0 + dy);
      GeometryCoreTestIO.showMomentData(allGeometry, volumeMoments, false, x0, y0 + 2 * dy);
      x0 += dx;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "Moments");
  });

  it("ExactMoments", () => {
    const ck = new Checker();
    // const allGeometry: GeometryQuery[] = [];
    const builder = PolyfaceBuilder.create();
    const a = 5;
    const b = 3;
    const c = 2;
    const volume = a * b * c;
    const iX = volume * (b * b + c * c) / 12.0;
    const iY = volume * (a * a + c * c) / 12.0;
    const iZ = volume * (b * b + a * a) / 12.0;
    const s = Box.createRange(Range3d.createXYZXYZ(0, 0, 0, a, b, c), true)!;
    builder.addGeometryQuery(s);
    const mesh = builder.claimPolyface();
    const areaMoments = PolyfaceQuery.computePrincipalAreaMoments(mesh)!;
    const volumeMoments = PolyfaceQuery.computePrincipalVolumeMoments(mesh)!;
    ck.testCoordinate(2.0 * (a * b + b * c + c * a), areaMoments.quantitySum, "Known box area");
    ck.testCoordinate(volume, volumeMoments.quantitySum, "Known box volume");
    const volumeB = volumeMoments.quantitySum;
    const rxB = volumeMoments.radiusOfGyration.x;
    const ryB = volumeMoments.radiusOfGyration.y;
    const rzB = volumeMoments.radiusOfGyration.z;
    ck.testCoordinate(iX, rxB * rxB * volumeB, "box X moment");
    ck.testCoordinate(iY, ryB * ryB * volumeB, "box Y moment");
    ck.testCoordinate(iZ, rzB * rzB * volumeB, "box Z moment");

    expect(ck.getNumErrors()).equals(0);
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
    const allGeometry: GeometryQuery[] = [];
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
    const grid4: Point3d[][] = [
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
    const params4: Point2d[][] = [
      [Point2d.create(x0, y0), Point2d.create(x1, y0), Point2d.create(x1, y1), Point2d.create(x0, y1)],
      [Point2d.create(x1, y0), Point2d.create(x2, y0), Point2d.create(x2, y1), Point2d.create(x1, y1)],
      [Point2d.create(x2, y0), Point2d.create(x3, y0), Point2d.create(x3, y1), Point2d.create(x2, y1)],
      [Point2d.create(x0, y1), Point2d.create(x1, y1), Point2d.create(x1, y2), Point2d.create(x0, y2)],
      [Point2d.create(x1, y1), Point2d.create(x2, y1), Point2d.create(x2, y2), Point2d.create(x1, y2)],
      [Point2d.create(x2, y1), Point2d.create(x3, y1), Point2d.create(x3, y2), Point2d.create(x2, y2)],
      [Point2d.create(x0, y2), Point2d.create(x1, y2), Point2d.create(x1, y3), Point2d.create(x0, y3)],
      [Point2d.create(x1, y2), Point2d.create(x2, y2), Point2d.create(x2, y3), Point2d.create(x1, y3)],
      [Point2d.create(x2, y2), Point2d.create(x3, y2), Point2d.create(x3, y3), Point2d.create(x2, y3)],
    ];
    let xOut = 0;
    for (const compress of [true, false]) {
      for (const numPerFacet of [3, 4]) {
        let grid: Point3d[][];
        let params: Point2d[][];
        if (numPerFacet === 4) {
          grid = grid4;
          params = params4;
        } else {
          grid = [];
          params = [];
          for (const xyz of grid4) {
            grid.push([xyz[0], xyz[1], xyz[2]]);
            grid.push([xyz[2], xyz[3], xyz[0]]);
          }
          for (const uv of params4) {
            params.push([uv[0], uv[1], uv[2]]);
            params.push([uv[2], uv[3], uv[0]]);
          }
        }
        for (const useParams of [true, false]) {
          const options = new StrokeOptions();
          options.needParams = true;
          options.needNormals = true;
          options.shouldTriangulate = false;
          options.maxEdgeLength = 4;

          const builder = PolyfaceBuilder.create(options);
          builder.addCoordinateFacets(grid, useParams ? params : undefined, undefined, true);
          const polyface = builder.claimPolyface(compress);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, xOut, 0);
          // ck.testExactNumber(polyface.pointCount, polyface.normalCount, "Number of normals match point count");
          if (!compress)
            ck.testExactNumber(polyface.pointCount, polyface.paramCount, "Number of params matches point count");
          if (useParams) {

          } else {
            if (numPerFacet === 4 && !compress) {
              // Check params
              for (let idx = 0; idx < polyface.data.paramIndex!.length; idx++) {
                const currentPoint = polyface.data.point.getPoint3dAtUncheckedPointIndex(idx);
                const currentParam = polyface.data.param!.getPoint2dAtCheckedPointIndex(idx)!;
                if (idx % 4 === 0) {
                  ck.testCoordinate(currentParam.x, 0);
                  ck.testCoordinate(currentParam.y, 0);
                } else if (idx % 4 === 1) {
                  const oldPoint = polyface.data.point.getPoint3dAtUncheckedPointIndex(idx - 1);
                  ck.testCoordinate(currentParam.x, Geometry.hypotenuseXYZ(currentPoint.x - oldPoint.x, currentPoint.y - oldPoint.y, currentPoint.z - oldPoint.z));
                  ck.testCoordinate(polyface.data.param!.getYAtUncheckedPointIndex(idx), 0);
                }
              }
            }
          }
          xOut += 40;
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddCoordinateFacets");
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
    const options = new StrokeOptions();
    options.needNormals = false;
    options.needParams = false;
    const builder = PolyfaceBuilder.create(options);
    builder.addGeometryQuery(loop);
    const polyface = builder.claimPolyface(true);
    if (!ck.testExactNumber(polygonPoints.length - 2, polyface.facetCount, "Triangle count in polygon")) {
      const jsPolyface = IModelJson.Writer.toIModelJson(polyface);
      GeometryCoreTestIO.consoleLog(prettyPrint(jsPolyface));
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
  const step = 10;
  const x0 = 0;
  const y0 = 0;
  const y1 = step;

  GeometryCoreTestIO.captureGeometry(allGeometry, region, x0, y0);

  let x1 = x0;

  const options = new StrokeOptions();
  options.needNormals = false;
  options.needParams = false;
  const builder = PolyfaceBuilder.create(options);
  builder.addGeometryQuery(region);
  GeometryCoreTestIO.captureGeometry(allGeometry, builder.claimPolyface(), x1, y1);
  for (const e of [1, 0.5]) {
    x1 += step;
    options.maxEdgeLength = e;
    const builder1 = PolyfaceBuilder.create(options);
    builder1.addGeometryQuery(region);
    GeometryCoreTestIO.captureGeometry(allGeometry, builder1.claimPolyface(), x1, y1);
  }

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
      const quad = [Point3d.create(xShift + iRow * spacing, iColumn * spacing, 0.0), Point3d.create(xShift + (iRow + 1) * spacing, iColumn * spacing, 0.0), Point3d.create(xShift + (iRow + 1) * spacing, (iColumn + 1) * spacing, 0.0), Point3d.create(xShift + iRow * spacing, (iColumn + 1) * spacing)];
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
it("SolidPrimitiveBoundary", () => {
  const allGeometry: GeometryQuery[] = [];
  const ck = new Checker();
  let x0 = 0;
  const y0 = 0;
  const delta = 10;
  const z1 = 10.0;
  for (const capped of [true, false]) {
    for (const solid of
      [Box.createRange(Range3d.createXYZXYZ(0, 0, 0, 1, 2, 3), capped)!, TorusPipe.createInFrame(Transform.createIdentity(), 2, 1, Angle.createDegrees(180), capped)!, Cone.createBaseAndTarget(Point3d.create(0, 0, 0), Point3d.create(0, 0, 2), Vector3d.unitX(), Vector3d.unitY(), 2, 1, capped)!]) {
      const builder = PolyfaceBuilder.create();
      builder.addGeometryQuery(solid);
      const mesh = builder.claimPolyface();
      ck.testBoolean(capped, PolyfaceQuery.isPolyfaceClosedByEdgePairing(mesh), "verify closure");
      const boundary = PolyfaceQuery.boundaryEdges(mesh);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundary, x0, y0 + delta);

      PolyfaceQuery.markAllEdgeVisibility(mesh, false);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0 + 2 * delta);
      PolyfaceQuery.markAllEdgeVisibility(mesh, true);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y0 + 3 * delta);

      let y1 = y0 + 5 * delta;
      for (const angle of [undefined, Angle.createDegrees(0.1),
        Angle.createDegrees(15),
        Angle.createDegrees(30),
        Angle.createDegrees(50)]) {
        PolyfaceQuery.markPairedEdgesInvisible(mesh, angle);
        const boundary1 = PolyfaceQuery.boundaryEdges(mesh);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, x0, y1);
        if (capped) {
          if (!ck.testUndefined(boundary1, "capped solid should have no boundary"))
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, boundary1, x0, y1, z1);
        } else {
          ck.testDefined(boundary1, "uncapped solid should have boundary");
        }
        y1 += 2 * delta;
      }
      x0 += delta;
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "SolidPrimitiveBoundary");
  expect(ck.getNumErrors()).equals(0);
});

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

it("AddSweptLineStrings", () => {
  const ck = new Checker();
  const path = Path.create();
  path.tryAddChild(LineString3d.create([[0, 0, 0], [0, 1, 0], [1, 1, 0]]));
  path.tryAddChild(LineString3d.create([[1, 1, 0], [0, 1, 0], [0, 2, 0]]));
  const builder = PolyfaceBuilder.create();
  builder.addLinearSweepLineStringsXYZOnly(path, Vector3d.create(0, 0, 1));
  const mesh = builder.claimPolyface();
  ck.testExactNumber(4, mesh.facetCount);

  builder.applyStrokeCountsToCurvePrimitives(path);
  expect(ck.getNumErrors()).equals(0);
});

it("AddTriangles", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const options = StrokeOptions.createForFacets();
  options.needNormals = true;
  options.needParams = true;
  const builder = PolyfaceBuilder.create(options);
  builder.addTriangleFacet([Point3d.create(0, 1, 2)]);
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
  const pointA = new GrowableXYZArray();
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

    // build lower half without params, use GrowableArray for coverage . ..
    pointA.length = 0;
    pointA.push(coneB);
    pointA.push(strokes.pointAt(i)!);
    pointA.push(strokes.pointAt(i - 1)!);
    builder.addTriangleFacet(pointA);

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

  // triangulate to test edge hiding in reversed mesh
  const polyfaceA = Sample.createTriangularUnitGridPolyface(
    Point3d.create(0, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(), 2, 3, true, true, true, true);
  const polyfaceB = Sample.createTriangularUnitGridPolyface(
    Point3d.create(5, 0, 0),
    Vector3d.unitX(),
    Vector3d.unitY(), 2, 3, true, true, true, true);

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

it("AddSweptIndexedPolyface", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];

  // generate triangulated square flat grid with size pts on a side
  const size = 10;
  const seed = 10;
  const baseMesh = Sample.createTriangularUnitGridPolyface(Point3d.create(0, 0, 0), Vector3d.unitX(), Vector3d.unitY(), size, size, true, true, true, true);

  // randomly perturb grid in z, and compute new tri normals
  const xyz = Point3d.create();
  for (let i = 0; i < baseMesh.data.pointCount; ++i) {
    baseMesh.data.point.getPoint3dAtUncheckedPointIndex(i, xyz);
    baseMesh.data.point.setXYZAtCheckedPointIndex(i, xyz.x, xyz.y, xyz.z + (i % 2 ? -1 : 1) * (randomInt(0, seed) / seed) / 2);
  }
  const normal = Vector3d.create();
  const visitor = baseMesh.createVisitor(0);
  while (visitor.moveToNextFacet()) {
    const pts = visitor.point.getPoint3dArray();
    pts[0].crossProductToPoints(pts[1], pts[2], normal).normalizeInPlace();
    const newNormalIndex = baseMesh.addNormal(normal);
    for (let i = baseMesh.facetIndex0(visitor.currentReadIndex()); i < baseMesh.facetIndex1(visitor.currentReadIndex()); i++)
      baseMesh.data.normalIndex![i] = newNormalIndex;
  }

  const options = StrokeOptions.createForFacets();
  options.needNormals = options.needParams = options.needColors = true; // only applies to new side faces!
  const sweepDir = Vector3d.create(1, 1, 2);

  const builder3 = PolyfaceBuilder.create(options);
  builder3.addSweptIndexedPolyface(baseMesh, sweepDir, true);
  const sweptPolyface3 = builder3.claimPolyface(true);

  const sideFacetCount = 2 * 4 * (size - 1);
  ck.testExactNumber(2 * baseMesh.facetCount + sideFacetCount, sweptPolyface3.facetCount, "Triangulated swept polyface has expected facet count.");
  ck.testBoolean(true, PolyfaceQuery.isPolyfaceManifold(sweptPolyface3, false), "Triangulated swept polyface is closed manifold.");

  options.needColors = false;
  const builder4 = PolyfaceBuilder.create(options);
  builder4.addSweptIndexedPolyface(baseMesh, sweepDir, false);
  const sweptPolyface4 = builder4.claimPolyface(true);

  ck.testUndefined(sweptPolyface4.data.color, "Swept polyface colors ignored.");
  ck.testExactNumber(2 * baseMesh.facetCount + sideFacetCount / 2, sweptPolyface4.facetCount, "Swept polyface has expected facet count.");
  ck.testBoolean(true, PolyfaceQuery.isPolyfaceManifold(sweptPolyface4, false), "Swept polyface is closed manifold.");

  const badBuilder = PolyfaceBuilder.create(options);
  ck.testBoolean(false, badBuilder.addSweptIndexedPolyface(sweptPolyface4, sweepDir, false), "Closed mesh does not create a simple sweep.");
  const badPolyface = badBuilder.claimPolyface(false);

  GeometryCoreTestIO.captureGeometry(allGeometry, baseMesh, 0, 0, 0);
  GeometryCoreTestIO.captureGeometry(allGeometry, sweptPolyface3, 0, 1.5 * size, 0);
  GeometryCoreTestIO.captureGeometry(allGeometry, sweptPolyface4, 0, 3 * size, 0);
  GeometryCoreTestIO.captureGeometry(allGeometry, badPolyface, 0, 4.5 * size, 0);
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "AddSweptPolyface");
  expect(ck.getNumErrors()).equals(0);
});

it("EmptyPolyface", () => {
  const ck = new Checker();
  const emptyPolyface = IndexedPolyface.create(false, false, false);
  ck.testFalse(emptyPolyface.isAlmostEqual(undefined));
  ck.testFalse(emptyPolyface.isSameGeometryClass(undefined));
  ck.testTrue(emptyPolyface.isSameGeometryClass(emptyPolyface));
  ck.testUndefined(PolyfaceQuery.computePrincipalAreaMoments(emptyPolyface), "Expect moment failure in empty polyface");
  ck.testUndefined(PolyfaceQuery.computePrincipalVolumeMoments(emptyPolyface), "Expect moment failure in empty polyface");
  expect(ck.getNumErrors()).equals(0);
});

it("Polyface.VisitorParamQueries", () => {
  for (const geom of [
    Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 5), 1.0, 0.5, true)!,
    Sphere.createCenterRadius(Point3d.create(0, 0, 0), 2.0, AngleSweep.createStartEndDegrees(0, 90)),
  ]) {
    const options = new StrokeOptions();
    options.needParams = true;
    options.needNormals = true;
    const builder = PolyfaceBuilder.create(options);
    // builder.toggleReversedFacetFlag();
    geom.dispatchToGeometryHandler(builder);
    const polyface = builder.claimPolyface(true);
    const visitor = polyface.createVisitor(0);
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

it("Polyface.VisitorQueryFailures", () => {
  const ck = new Checker();
  const options = new StrokeOptions();
  options.needParams = false;
  options.needNormals = true;
  const builder = PolyfaceBuilder.create(options);
  builder.toggleReversedFacetFlag();
  const cone = Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 5), 1.0, 0.5, true)!;
  builder.addCone(cone);
  const polyface = builder.claimPolyface(true);
  const visitor = polyface.createVisitor(0);
  if (ck.testTrue(visitor.moveToNextFacet())) {
    ck.testUndefined(visitor.tryGetDistanceParameter(100), "invalid vertex index");
    ck.testUndefined(visitor.tryGetNormalizedParameter(100), "invalid vertex index");
    ck.testUndefined(visitor.tryGetDistanceParameter(0), "undefined param");
    ck.testUndefined(visitor.tryGetNormalizedParameter(0), "undefined param");
  }
  ck.testUndefined(PolyfaceQuery.computeFacetUnitNormal(visitor, -1), "invalid vertex index");
  const rangeLengths = PolyfaceQuery.collectRangeLengthData(polyface);
  ck.testTrue(rangeLengths.xSums.count > 0, "rangeLengths sums exist");
  expect(ck.getNumErrors()).equals(0);
});

it("Polyface.IndexValidation", () => {
  const ck = new Checker();
  const indices = [0, 1, 2, 3, 4, 7, 6, 5];
  const data = [9, 8, 7, 6, 5, 4, 3, 2, 1, 100];
  ck.testFalse(Polyface.areIndicesValid(undefined,
    -1, 3,   // range to examine
    data, 1), "one of indices and data cannot be undefined");
  ck.testFalse(Polyface.areIndicesValid(indices,
    -1, 3,   // range to examine
    undefined, 1), "one of indices and data cannot be undefined");

  ck.testFalse(Polyface.areIndicesValid(indices,
    -1, 3,   // range to examine
    data, 10), "first index is out of bounds");

  ck.testFalse(Polyface.areIndicesValid(indices,
    15, 3,   // range to examine
    data, 10), "first index is out of bounds");
  ck.testFalse(Polyface.areIndicesValid(indices,
    0, 20,   // range to examine
    data, 1), "second index is out of bounds");
  ck.testFalse(Polyface.areIndicesValid(indices,
    3, 0,   // range to examine
    data, 10), "first index cannot be greater than second index");
  ck.testFalse(Polyface.areIndicesValid(indices,
    0, 0,   // range to examine
    data, 10), "first index and second index cannot be equal");

  ck.testFalse(Polyface.areIndicesValid(indices,
    0, 3,   // range to examine
    data, 1), "confirm index out of bounds detected");
  ck.testTrue(Polyface.areIndicesValid(indices,
    0, 3,   // range to examine
    data, 10), "validate indices");
  ck.testTrue(Polyface.areIndicesValid(undefined,
    0, 3,   // range to examine
    undefined, 10), "both of indices and data can be undefined");

  expect(ck.getNumErrors()).equals(0);
});

// disable naming to allow exact names from synchro mesh
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Construct a SynchroMesh for an xy integer point grid with bilinear z
 * Convert to polyfaces with and without normals and params.
 * Save all 4 (in shifted positions)
 */
it("Synchro", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  const synchroMesh: SynchroMesh = {
    vertex_array: [],
    index_array: [],
  };
  const numVertexX = 4;
  const numVertexY = 3;
  // build a regular point grid ...
  const myUVArray: Point2d[] = [];
  const myNormalArray: Vector3d[] = [];
  const zScale = 0.1;
  // build up normal and param arrays to reference later
  for (let iy = 0; iy < numVertexY; iy++)
    for (let ix = 0; ix < numVertexX; ix++) {
      synchroMesh.vertex_array.push(Point3d.create(ix, iy, zScale * ix * iy));
      myUVArray.push(Point2d.create(ix, iy));
      const normal = Vector3d.createCrossProduct(1, 0, zScale * iy, 0, 1, zScale * ix);
      normal.normalizeInPlace();
      myNormalArray.push(normal);
    }
  // push indices for 2 triangles in each quad ...
  for (let iy = 0; iy + 1 < numVertexY; iy++)
    for (let ix = 0; ix + 1 < numVertexX; ix++) {
      const i00 = iy * numVertexX + ix;
      const i10 = i00 + 1;
      const i01 = i00 + numVertexX;
      const i11 = i01 + 1;
      synchroMesh.index_array.push(i00, i10, i01);
      synchroMesh.index_array.push(i10, i11, i01);
    }
  // create and output all 4 combinations of uv and normal content ..
  const polyface = createPolyfaceFromSynchro(synchroMesh);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyface, 0, 0);

  synchroMesh.uv_array = myUVArray;
  synchroMesh.normal_array = undefined;
  const polyfaceWithParams = createPolyfaceFromSynchro(synchroMesh);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceWithParams, numVertexX, 0);

  synchroMesh.uv_array = undefined;
  synchroMesh.normal_array = myNormalArray;
  const polyfaceWithNormals = createPolyfaceFromSynchro(synchroMesh);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceWithNormals, 0, numVertexY);

  synchroMesh.uv_array = myUVArray;
  synchroMesh.normal_array = myNormalArray;
  const polyfaceWithParamsAndNormals = createPolyfaceFromSynchro(synchroMesh);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceWithParamsAndNormals, numVertexX, numVertexY);

  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "Synchro");
  expect(ck.getNumErrors()).equals(0);
});

it("SmallSynchroMesh", () => {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  // const synchroMesh = JSON.parse(fs.readFileSync("./src/test/testInputs/synchro/082020/synchroMesh.json", "utf8"));
  // const synchroMesh = JSON.parse(fs.readFileSync("./src/test/testInputs/synchro/082020A/synchroMesh.json", "utf8"));
  const synchroMesh = JSON.parse(fs.readFileSync("./src/test/testInputs/synchro/082020B/synchromesh.json", "utf8"));
  let x0 = 0;
  for (const polyfaceA of [createPolyfaceFromSynchro(synchroMesh), createPolyfaceFromSynchroA(synchroMesh)]) {
    if (polyfaceA)
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x0, 0);
    x0 += 10.0;
    if (polyfaceA instanceof IndexedPolyface) {
      const errorsA = checkPolyfaceIndexErrors(polyfaceA);
      if (ck.testUndefined(errorsA, "Index Check before compress")) {
        polyfaceA.data.compress();
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, polyfaceA, x0, 10.0);
        const errorsB = checkPolyfaceIndexErrors(polyfaceA);
        ck.testUndefined(errorsB, "Index Check after compress");
      }
    }
  }
  GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "082020BFromSynchro");
  expect(ck.getNumErrors()).equals(0);
});

it("synchroPolyface", () => {
  const synchroMesh = JSON.parse(fs.readFileSync("./src/test/testInputs/synchro/082020B/synchromesh.json", "utf8"));

  const ck = new Checker();
  for (const polyfaceA of [createPolyfaceFromSynchro(synchroMesh)]) {
    const polyfaceJson = JSON.parse(fs.readFileSync("./src/test/testInputs/synchro/082020B/polyface.json", "utf8"));
    const xyzArray = enumerateToNumberArray(polyfaceJson.data.point._data);
    xyzArray.length = 3 * polyfaceJson.data.point._xyzInUse;
    const paramArray = enumerateToNumberArray(polyfaceJson.data.param._data);
    paramArray.length = 2 * polyfaceJson.data.param._xyInUse;
    const normalArray = enumerateToNumberArray(polyfaceJson.data.normal._data);
    normalArray.length = 3 * polyfaceJson.data.normal._xyzInUse;
    const pointIndexArray = enumerateToNumberArray(polyfaceJson.data.pointIndex);
    const paramIndexArray = enumerateToNumberArray(polyfaceJson.data.paramIndex);
    const normalIndexArray = enumerateToNumberArray(polyfaceJson.data.normalIndex);
    GeometryCoreTestIO.consoleLog({ numXYZ: xyzArray.length });
    const polyfaceB = IndexedPolyface.create(true, true, false, true);
    polyfaceB.data.point.pushFrom(xyzArray);
    for (let i = 0; i + 1 < paramArray.length; i += 2)
      polyfaceB.data.param!.pushXY(paramArray[i], paramArray[i + 1]);
    polyfaceB.data.normal!.pushFrom(normalArray);
    polyfaceB.data.pointIndex.push(...pointIndexArray);
    polyfaceB.data.paramIndex!.push(...paramIndexArray);
    polyfaceB.data.normalIndex!.push(...normalIndexArray);
    const facetStartB = (polyfaceB as any)._facetStart;
    // purge initialization from ctor ...
    facetStartB.length = 0;
    for (const s of polyfaceJson._facetStart) {
      facetStartB.push(s);
    }
    for (const visible of polyfaceJson.data.edgeVisible) {
      polyfaceB.data.edgeVisible.push(visible);
    }
    const errors = checkPolyfaceIndexErrors(polyfaceB);
    if (!ck.testUndefined(errors, "index error description"))
      GeometryCoreTestIO.consoleLog(errors);
    // EDL July 2021 twoSided is flipping?
    polyfaceB.twoSided = polyfaceA.twoSided;
    ck.testTrue(polyfaceA.isAlmostEqual(polyfaceB), "Compare polyfaces");
  }
  expect(ck.getNumErrors()).equals(0);
});
/**
 * This is the Synchro mesh structure, as deduced by looking at prior code to transfer to polyface.
 */
interface SynchroMesh {
  vertex_array: XYAndZ[];
  index_array: number[];
  uv_array?: XAndY[];
  normal_array?: XYAndZ[];
}

/*
public static areIndicesValid(indices: number[] | undefined,
  indexPositionA: number, indexPositionB: number, data: any | undefined, dataLength: number): boolean {
 */
function createPolyfaceFromSynchro(geom: any): Polyface {
  // const options: StrokeOptions = StrokeOptions.createForFacets();
  const hasUV: boolean = geom.uv_array != null && geom.uv_array.length !== 0;
  const hasNormals: boolean = geom.normal_array != null && geom.normal_array.length !== 0;
  const polyface = IndexedPolyface.create(hasNormals, hasUV);
  // const numVertex = geom.vertex_array.length;
  // Always load point data ...
  for (const xyz of geom.vertex_array)
    polyface.data.point.pushXYZ(xyz.x, xyz.y, xyz.z);

  // OPTIONAL uv array
  if (hasUV) {
    for (const xy of geom.uv_array)
      polyface.data.param!.pushXY(xy.x, xy.y);
  }
  // OPTIONAL normal array
  if (hasNormals) {
    for (const xyz of geom.normal_array)
      polyface.data.normal!.pushXYZ(xyz.x, xyz.y, xyz.z);
  }

  // build up the index sets one facet at a time, let terminateFacet () get the facetStart table right . . .
  // Note that polyface has separate index arrays for params and normals.
  // (When there are sharp edges in the mesh, this allows smaller param, point, and normal arrays.
  //    The single-index style of Synchro and other
  //   browser software saves memory by sharing the index array but wastes it with redundant data arrays.
  //   The polyface compress function can get this effect)
  const indexArray = geom.index_array;
  let i0, i1, i2;
  for (let k = 0; k + 2 < indexArray.length; k += 3) {
    i0 = indexArray[k];
    i1 = indexArray[k + 1];
    i2 = indexArray[k + 2];
    polyface.data.pointIndex.push(i0, i1, i2);
    polyface.data.edgeVisible.push(true, true, true);
    if (polyface.data.paramIndex)
      polyface.data.paramIndex.push(i0, i1, i2);
    if (polyface.data.normalIndex)
      polyface.data.normalIndex.push(i0, i1, i2);
    polyface.terminateFacet();
  }
  if (polyface.data.paramIndex) {
    const paramCount = polyface.data.paramCount;
    // let bp = 0;
    let lastJ = -1;
    for (let j = 0; j < polyface.data.paramIndex.length; j++) {
      if (polyface.data.paramIndex[j] > paramCount) {
        lastJ = j;
      }
    }
    if (lastJ !== -1)
      GeometryCoreTestIO.consoleLog(`lastJ error ${lastJ}`);
  }
  return polyface;
}
function enumerateToNumberArray(data: any): number[] {
  const result = [];
  for (let i = 0; ; i++) {
    if (data.hasOwnProperty(i)) {
      result.push(data[i]);
    } else break;
  }
  return result;
}
function appendIndexErrors(name: string, data: number[], numValues: number, errors: object[]) {
  if (data === undefined)
    return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (min >= 0 && min < numValues && max >= 0 && max < numValues)
    return;
  let i, k;
  for (i = 0; i < data.length; i++) {
    k = data[i];
    if (k < 0 || k >= numValues) {
      errors.push({ indexArrayName: name, indexOfBadPointIndex: i, badPointIndex: k });
      return;
    }
  }
}

/**
 * Return an array of objects whose members describe various error conditions.
 * * If the array is undefined, no errors were detected.
 */
function checkPolyfaceIndexErrors(polyface: IndexedPolyface): object[] | undefined {
  const errors: object[] = [];
  appendIndexErrors("pointIndex", polyface.data.pointIndex, polyface.data.point.length, errors);
  if (polyface.data.paramIndex && polyface.data.param)
    appendIndexErrors("paramIndex", polyface.data.paramIndex, polyface.data.param.length, errors);
  if (polyface.data.normalIndex && polyface.data.normal)
    appendIndexErrors("normalIndex", polyface.data.normalIndex, polyface.data.normal.length, errors);
  if (errors.length === 0)
    return undefined;
  return errors;
}
function createPolyfaceFromSynchroA(geom: any): Polyface {
  // const options: StrokeOptions = StrokeOptions.createForFacets();
  const hasUV: boolean = geom.uv_array != null && geom.uv_array.length !== 0;
  const hasNormals: boolean = geom.normal_array != null && geom.normal_array.length !== 0;
  const polyface = IndexedPolyface.create(hasNormals, hasUV);
  // const numVertex = geom.vertex_array.length;

  // Always load point data ...
  for (const xyz of geom.vertex_array)
    polyface.data.point.pushXYZ(xyz.x, xyz.y, xyz.z);

  // OPTIONAL uv array
  if (hasUV) {
    for (const xy of geom.uv_array)
      polyface.data.param!.pushXY(xy.x, xy.y);
  }

  // OPTIONAL normal array
  if (hasNormals) {
    for (const xyz of geom.normal_array)
      polyface.data.normal!.pushXYZ(xyz.x, xyz.y, xyz.z);
  }

  // build up the index sets one facet at a time, let terminateFacet () get the facetStart table right . . .
  // Note that polyface has separate index arrays for params and normals.
  // (When there are sharp edges in the mesh, this allows smaller param, point, and normal arrays.
  //    The single-index style of Synchro and other
  //   browser software saves memory by sharing the index array but wastes it with redundant data arrays.
  //   The polyface compress function can get this effect)
  const indexArray = geom.index_array;
  let i0, i1, i2;
  for (let k = 0; k + 2 < indexArray.length; k += 3) {
    i0 = indexArray[k];
    i1 = indexArray[k + 1];
    i2 = indexArray[k + 2];

    polyface.data.pointIndex.push(i0, i1, i2);
    polyface.data.edgeVisible.push(true, true, true);

    if (polyface.data.paramIndex)
      polyface.data.paramIndex.push(i0, i1, i2);

    if (polyface.data.normalIndex)
      polyface.data.normalIndex.push(i0, i1, i2);

    polyface.terminateFacet();
  }

  // check if paramIndex refers to param out of bounds
  // if (polyface.data.paramIndex) {
  //     let paramCount = polyface.data.paramCount;
  //     if(polyface.data.point.length >= 35000) {
  //         let bp = 1;
  //     }
  //     for (let j = 0; j < polyface.data.paramIndex.length; j++) {
  //         if (polyface.data.paramIndex[j] > paramCount) {
  //             let bp = 1;
  //         }
  //     }
  // }

  return polyface;
}

// lexicographical order, with slop for equality
const compareNormals: OrderedComparator<Vector3d> = (v0: Vector3d, v1: Vector3d) => { // lexicographical order, with slop for equality
  if (v0.isAlmostEqual(v1))
    return 0;
  if (!Geometry.isAlmostEqualNumber(v0.x, v1.x)) {
    if (v0.x < v1.x)
      return -1;
    if (v0.x > v1.x)
      return 1;
  }
  if (!Geometry.isAlmostEqualNumber(v0.y, v1.y)) {
    if (v0.y < v1.y)
      return -1;
    if (v0.y > v1.y)
      return 1;
  }
  if (!Geometry.isAlmostEqualNumber(v0.z, v1.z)) {
    if (v0.z < v1.z)
      return -1;
    if (v0.z > v1.z)
      return 1;
  }
  return 0;
};

const cloneNormal: CloneFunction<Vector3d> = (v: Vector3d) => {
  return v.clone();
};

function sectorsWithSameNormalAtVertexShareUVParamAndColor(ck: Checker, data: PolyfaceData): void {
  if (data.normal && data.normalIndex && ((data.param && data.paramIndex) || (data.color && data.colorIndex))) {
    const normal = Vector3d.createZero();
    for (let vi = 0; vi < data.pointCount; ++vi) {
      const sectors: number[] = [];
      for (let readIndex = 0; readIndex < data.pointIndex.length; ++readIndex) {
        if (data.pointIndex[readIndex] === vi)
          sectors.push(readIndex);
      }
      const normalToAuxIndex = new Dictionary<Vector3d, number>(compareNormals, cloneNormal);
      for (const auxIndices of [data.paramIndex, data.colorIndex]) {
        if (!auxIndices)
          continue;
        normalToAuxIndex.clear();
        for (const readIndex of sectors) {
          const iNormal: number = data.normalIndex[readIndex];
          ck.testPointer(data.getNormal(iNormal, normal));
          const iAuxData = auxIndices[readIndex];
          const inserted = normalToAuxIndex.insert(normal, iAuxData);
          if (!inserted)
            ck.testExactNumber(normalToAuxIndex.get(normal)!, iAuxData, "at a vertex, sectors with same normal have same uv/color");
        }
      }
    }
  }
}

describe("Polyface", () => {
  it("SphericalAuxiliaryData", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const normal = Vector3d.createZero();
    const vertex = Point3d.createZero();

    const mesh = ImportedSample.createPolyhedron62();
    if (!ck.testPointer(mesh, "imported mesh"))
      return;

    mesh.data.color = undefined;
    mesh.data.colorIndex = undefined;

    // install per-vertex spherical uv-parameters
    mesh.data.param?.clear();
    for (let vi = 0; vi < mesh.data.pointCount; ++vi) {
      if (mesh.data.getPoint(vi, vertex)) {
        const theta = Math.atan2(vertex.y, vertex.x);
        const phi = Math.asin(vertex.z);
        mesh.addParamUV(theta, phi);
      }
    }
    mesh.data.paramIndex = mesh.data.pointIndex.slice();

    // install per-vertex spherical normals
    mesh.data.normal?.clear();
    for (let vi = 0; vi < mesh.data.pointCount; ++vi) {
      if (mesh.data.getPoint(vi, vertex) && !vertex.isZero) {
        normal.setFromPoint3d(vertex);
        if (normal.normalizeInPlace())
          mesh.addNormal(normal);
      }
    }
    mesh.data.normalIndex = mesh.data.pointIndex.slice();

    // This yields a mesh with uv different from, say, those computed by QV in MicroStation.
    mesh.data.compress();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh);

    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "SphericalAuxiliaryData");
    expect(ck.getNumErrors()).equals(0);
  });

  it("TriangulateAuxiliaryData", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    const normal = Vector3d.createZero();
    const vertex = Point3d.createZero();
    const vertex1 = Point3d.createZero();

    const mesh = ImportedSample.createPolyhedron62();
    if (!ck.testPointer(mesh, "imported mesh"))
      return;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh);

    // preserve per-facet colors
    let colors: number[] | undefined;
    const normalToColorIndex = new Dictionary<Vector3d, number>(compareNormals, cloneNormal);
    if (
      ck.testDefined(mesh.data.color, "input mesh has colors") && mesh.data.color !== undefined &&
      ck.testDefined(mesh.data.colorIndex, "input mesh has color indices") && mesh.data.colorIndex !== undefined &&
      ck.testDefined(mesh.data.normal, "input mesh has normals") && mesh.data.normal !== undefined
    ) {
      colors = mesh.data.color.slice();
      for (const visitor = mesh.createVisitor(); visitor.moveToNextFacet();)
        ck.testTrue(normalToColorIndex.insert(visitor.getNormal(0, normal)!, visitor.colorIndex![0]), "associate normal to color of face");
    }

    // preserve per-sector uv-parameters
    let params: GrowableXYArray | undefined;
    const vertexIndexToSector = [];
    if (
      ck.testDefined(mesh.data.param, "input mesh has params") && mesh.data.param !== undefined &&
      ck.testDefined(mesh.data.paramIndex, "input mesh has param indices") && mesh.data.paramIndex !== undefined &&
      ck.testDefined(mesh.data.normal, "input mesh has normals") && mesh.data.normal !== undefined
    ) {
      params = mesh.data.param.clone();
      for (let vi = 0; vi < mesh.data.pointCount; ++vi) {
        const normalToParamIndex = new Dictionary<Vector3d, number>(compareNormals, cloneNormal);
        for (const visitor = mesh.createVisitor(); visitor.moveToNextFacet();) {
          for (let i = 0; i < visitor.numEdgesThisFacet; ++i) {
            if (visitor.pointIndex[i] === vi)
              normalToParamIndex.insert(visitor.getNormal(i, normal)!, visitor.paramIndex![i]);
          }
        }
        vertexIndexToSector.push(normalToParamIndex);
      }
    }

    // triangulate via graph roundtrip (loses normals, params, colors)
    const graph = PolyfaceQuery.convertToHalfEdgeGraph(mesh);
    ck.testTrue(Triangulator.triangulateAllInteriorFaces(graph, true), "triangulated the graph");
    const mesh1 = PolyfaceBuilder.graphToPolyface(graph, undefined, () => true, () => true);
    ck.testTrue(!mesh1.isEmpty, "triangulated the mesh");

    ck.testExactNumber(mesh1.pointCount, mesh.pointCount, "triangulation didn't add any vertices");
    ck.testExactNumber(mesh1.facetCount, 54 + mesh.facetCount, "triangulation produced expected facet count");
    ck.testExactNumber(mesh1.data.pointIndex.length, 108 + mesh.data.pointIndex.length, "triangulation produced expected edge count");
    ck.testExactNumber(mesh1.pointCount - (mesh1.data.pointIndex.length / 2) + mesh1.facetCount, 2, "triangulation satisfies Euler equation");

    // reinstall per-facet normals
    PolyfaceQuery.buildPerFaceNormals(mesh1);
    ck.testDefined(mesh1.data.normal, "normals successfully installed");

    // restore per-facet colors
    if (colors) {
      for (const visitor = mesh1.createVisitor(); visitor.moveToNextFacet();) {
        const colorIndex = normalToColorIndex.get(visitor.getNormal(0, normal)!);
        if (ck.testDefined(colorIndex, "found color index in map") && colorIndex !== undefined) {
          for (let i = 0; i < visitor.numEdgesThisFacet; ++i)
            mesh1.addColorIndex(colorIndex);
        }
      }
      mesh1.data.color = colors;
    }

    // restore per-sector uv-parameters
    if (params) {
      mesh1.data.paramIndex = [];
      mesh1.data.paramIndex.length = mesh1.data.pointIndex.length;
      for (let vi = 0; vi < mesh1.data.pointCount; ++vi) {
        mesh1.data.getPoint(vi, vertex);
        for (const visitor = mesh1.createVisitor(); visitor.moveToNextFacet();) {
          for (let i = 0; i < visitor.numEdgesThisFacet; ++i) {
            if (vertex.isAlmostEqual(visitor.getPoint(i, vertex1)!)) {
              const uvIndex = vertexIndexToSector[vi].get(visitor.getNormal(i, normal)!);
              if (ck.testDefined(uvIndex, "found uv index in map") && uvIndex !== undefined)
                mesh1.data.paramIndex[mesh1.facetIndex0(visitor.currentReadIndex()) + i] = uvIndex;
            }
          }
        }
      }
      mesh1.data.param = params;
    }

    mesh1.data.compress();
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh1, 10);
    sectorsWithSameNormalAtVertexShareUVParamAndColor(ck, mesh1.data);

    GeometryCoreTestIO.saveGeometry(allGeometry, "Polyface", "TriangulateAuxiliaryData");
    expect(ck.getNumErrors()).equals(0);
  });
});
