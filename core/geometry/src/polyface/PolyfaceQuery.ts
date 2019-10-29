/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Polyface */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
// import { Point3d, Vector3d, Point2d } from "./PointVector";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Polyface, PolyfaceVisitor } from "./Polyface";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { BagOfCurves, CurveCollection } from "../curve/CurveCollection";
import { Loop } from "../curve/Loop";
import { LineString3d } from "../curve/LineString3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { MomentData } from "../geometry4d/MomentData";
import { IndexedEdgeMatcher, SortableEdgeCluster, SortableEdge } from "./IndexedEdgeMatcher";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Transform } from "../geometry3d/Transform";
import { Segment1d } from "../geometry3d/Segment1d";
import { PolyfaceBuilder } from "./PolyfaceBuilder";
import { Geometry } from "../Geometry";
import { LineSegment3d } from "../curve/LineSegment3d";
import { ChainMergeContext } from "../topology/ChainMerge";
import { UnionFindContext } from "../numerics/UnionFind";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { RangeLengthData } from "./RangeLengthData";
import { XYPointBuckets } from "./multiclip/XYPointBuckets";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { Range3d } from "../geometry3d/Range";
/**
 * Structure to return multiple results from volume between facets and plane
 * @public
 */
export interface FacetProjectedVolumeSums {
  /** Summed (signed) volume */
  volume: number;
  /** summed area moments for positive contributions */
  positiveProjectedFacetAreaMoments?: MomentData;
  /** summed area moments for negative contributions */
  negativeProjectedFacetAreaMoments?: MomentData;
}

/** PolyfaceQuery is a static class whose methods implement queries on a polyface or polyface visitor provided as a parameter to each method.
 * @public
 */
export class PolyfaceQuery {
  /** copy the points from a visitor into a Linestring3d in a Loop object */
  public static visitorToLoop(visitor: PolyfaceVisitor) {
    const ls = LineString3d.createPoints(visitor.point.getPoint3dArray());
    return Loop.create(ls);
  }
  /** Create a linestring loop for each facet of the polyface. */
  public static indexedPolyfaceToLoops(polyface: Polyface): BagOfCurves {
    const result = BagOfCurves.create();
    const visitor = polyface.createVisitor(1);
    while (visitor.moveToNextFacet()) {
      const loop = PolyfaceQuery.visitorToLoop(visitor);
      result.tryAddChild(loop);
    }
    return result;
  }
  /** Return the sum of all facets areas. */
  public static sumFacetAreas(source: Polyface | PolyfaceVisitor): number {
    let s = 0;
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetAreas(source.createVisitor(1));

    const visitor = source as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      s += PolygonOps.sumTriangleAreas(visitor.point.getPoint3dArray());
    }
    return s;
  }
  /** sum volumes of tetrahedra from origin to all facets.
   * * if origin is omitted, the first point encountered (by the visitor) is used as origin.
   * * If the mesh is closed, this sum is the volume.
   * * If the mesh is not closed, this sum is the volume of a mesh with various additional facets
   * from the origin to facets.
  */
  public static sumTetrahedralVolumes(source: Polyface | PolyfaceVisitor, origin?: Point3d): number {
    let s = 0;
    if (source instanceof Polyface)
      return PolyfaceQuery.sumTetrahedralVolumes(source.createVisitor(0), origin);
    let myOrigin = origin;
    const visitor = source as PolyfaceVisitor;
    const facetOrigin = Point3d.create();
    const targetA = Point3d.create();
    const targetB = Point3d.create();
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      if (myOrigin === undefined)
        myOrigin = visitor.point.getPoint3dAtUncheckedPointIndex(0);
      visitor.point.getPoint3dAtUncheckedPointIndex(0, facetOrigin);
      for (let i = 1; i + 1 < visitor.point.length; i++) {
        visitor.point.getPoint3dAtUncheckedPointIndex(i, targetA);
        visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, targetB);
        s += myOrigin.tripleProductToPoints(facetOrigin, targetA, targetB);
      }
    }
    return s / 6.0;
  }
  /** sum (signed) volumes between facets and a plane.
   * Return a structure with multiple sums:
   * * volume = the sum of (signed) volumes between facets and the plane.
   * * positiveAreaMomentData, negativeProjectedFacetAreaMoments = moment data with centroid, area, and second moments with respect to the centroid.
   *
  */
  public static sumVolumeBetweenFacetsAndPlane(source: Polyface | PolyfaceVisitor, plane: Plane3dByOriginAndUnitNormal): FacetProjectedVolumeSums {
    if (source instanceof Polyface)
      return PolyfaceQuery.sumVolumeBetweenFacetsAndPlane(source.createVisitor(0), plane);
    const visitor = source as PolyfaceVisitor;
    const facetOrigin = Point3d.create();
    const targetA = Point3d.create();
    const targetB = Point3d.create();
    const triangleNormal = Vector3d.create();
    const planeNormal = plane.getNormalRef();
    let h0, hA, hB;
    let signedVolumeSum = 0.0;
    let signedTriangleArea;
    let singleFacetArea;
    const positiveAreaMomentSums = MomentData.create(undefined, true);
    const negativeAreaMomentSums = MomentData.create(undefined, true);
    const singleFacetProducts = Matrix4d.createZero();
    const projectToPlane = plane.getProjectionToPlane();

    visitor.reset();
    // For each facet ..
    //   Form triangles from facet origin to each far edge.
    //   Sum signed area and volume contributions
    // each "projectedArea" contribution is twice the area of a triangle.
    // each volume contribution is  3 times the actual volume -- (1/3) of the altitude sums was the centroid altitude.
    while (visitor.moveToNextFacet()) {
      visitor.point.getPoint3dAtUncheckedPointIndex(0, facetOrigin);
      h0 = plane.altitude(facetOrigin);
      singleFacetArea = 0;
      // within a single facets, the singleFacetArea sum is accumulated with signs of individual triangles.
      // For a non-convex facet, this can be a mixture of positive and negative areas.
      // The absoluteProjectedAreaSum contribution is forced positive after the sum for the facet.
      for (let i = 1; i + 1 < visitor.point.length; i++) {
        visitor.point.getPoint3dAtUncheckedPointIndex(i, targetA);
        visitor.point.getPoint3dAtUncheckedPointIndex(i + 1, targetB);
        facetOrigin.crossProductToPoints(targetA, targetB, triangleNormal);
        hA = plane.altitude(targetA);
        hB = plane.altitude(targetB);
        signedTriangleArea = planeNormal.dotProduct(triangleNormal);
        singleFacetArea += signedTriangleArea;
        signedVolumeSum += signedTriangleArea * (h0 + hA + hB);
      }

      singleFacetProducts.setZero();
      visitor.point.multiplyTransformInPlace(projectToPlane);
      PolygonOps.addSecondMomentAreaProducts(visitor.point, facetOrigin, singleFacetProducts);

      if (singleFacetArea > 0) {
        positiveAreaMomentSums.accumulateProductsFromOrigin(facetOrigin, singleFacetProducts, 1.0);
      } else {
        negativeAreaMomentSums.accumulateProductsFromOrigin(facetOrigin, singleFacetProducts, 1.0);

      }
    }
    positiveAreaMomentSums.shiftOriginAndSumsToCentroidOfSums();
    negativeAreaMomentSums.shiftOriginAndSumsToCentroidOfSums();
    const positiveAreaMoments = MomentData.inertiaProductsToPrincipalAxes(positiveAreaMomentSums.origin, positiveAreaMomentSums.sums);
    const negativeAreaMoments = MomentData.inertiaProductsToPrincipalAxes(negativeAreaMomentSums.origin, negativeAreaMomentSums.sums);

    return {
      volume: signedVolumeSum / 6.0,
      positiveProjectedFacetAreaMoments: positiveAreaMoments,
      negativeProjectedFacetAreaMoments: negativeAreaMoments,
    };
  }

  /** Return the inertia products [xx,xy,xz,xw, yw, etc] integrated over all all facets, as viewed from origin. */
  public static sumFacetSecondAreaMomentProducts(source: Polyface | PolyfaceVisitor, origin: Point3d): Matrix4d {
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetSecondAreaMomentProducts(source.createVisitor(0), origin);
    const products = Matrix4d.createZero();
    const visitor = source as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      PolygonOps.addSecondMomentAreaProducts(visitor.point, origin, products);
    }
    return products;
  }
  /** Return the inertia products [xx,xy,xz,xw, yw, etc] integrated over all tetrahedral volumes from origin */
  public static sumFacetSecondVolumeMomentProducts(source: Polyface | PolyfaceVisitor, origin: Point3d): Matrix4d {
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetSecondVolumeMomentProducts(source.createVisitor(0), origin);
    const products = Matrix4d.createZero();
    const visitor = source as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      PolygonOps.addSecondMomentVolumeProducts(visitor.point, origin, products);
    }
    return products;
  }

  /** Compute area moments for the mesh. In the returned MomentData:
   * * origin is the centroid.
   * * localToWorldMap has the origin and principal directions
   * * radiiOfGyration radii for rotation around the x,y,z axes.
   */
  public static computePrincipalAreaMoments(source: Polyface): MomentData | undefined {
    const origin = source.data.getPoint(0);
    if (!origin) return undefined;
    const inertiaProducts = PolyfaceQuery.sumFacetSecondAreaMomentProducts(source, origin);
    return MomentData.inertiaProductsToPrincipalAxes(origin, inertiaProducts);
  }
  /** Compute area moments for the mesh. In the returned MomentData:
   * * origin is the centroid.
   * * localToWorldMap has the origin and principal directions
   * * radiiOfGyration radii for rotation around the x,y,z axes.
   * * The result is only valid if the mesh is closed.
   * * There is no test for closure.  Use `PolyfaceQuery.isPolyfaceClosedByEdgePairing(polyface)` to test for closure.
   */
  public static computePrincipalVolumeMoments(source: Polyface): MomentData | undefined {
    const origin = source.data.getPoint(0);
    if (!origin) return undefined;
    const inertiaProducts = PolyfaceQuery.sumFacetSecondVolumeMomentProducts(source, origin);
    return MomentData.inertiaProductsToPrincipalAxes(origin, inertiaProducts);
  }

  /**
   * Test if the facets in `source` occur in perfectly mated pairs, as is required for a closed manifold volume.
   * @param source
   */
  public static isPolyfaceClosedByEdgePairing(source: Polyface): boolean {
    const edges = new IndexedEdgeMatcher();
    const visitor = source.createVisitor(1) as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), visitor.currentReadIndex());
      }
    }
    const badClusters: SortableEdgeCluster[] = [];
    edges.sortAndCollectClusters(undefined, badClusters, undefined, badClusters);
    return badClusters.length === 0;
  }
  /**
  * Test if the facets in `source` occur in perfectly mated pairs, as is required for a closed manifold volume.
  * If not, extract the boundary edges as lines.
  * @param source
  */
  public static boundaryEdges(source: Polyface, includeDanglers: boolean = true, includeMismatch: boolean = true, includeNull: boolean = true): CurveCollection | undefined {
    const edges = new IndexedEdgeMatcher();
    const visitor = source.createVisitor(1) as PolyfaceVisitor;
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), visitor.currentReadIndex());
      }
    }
    const bad1: SortableEdgeCluster[] = [];
    const bad2: SortableEdgeCluster[] = [];
    const bad0: SortableEdgeCluster[] = [];
    edges.sortAndCollectClusters(undefined, bad1, bad0, bad2);
    const badList = [];
    if (includeDanglers && bad1.length > 0)
      badList.push(bad1);
    if (includeMismatch && bad2.length > 0)
      badList.push(bad2);
    if (includeNull && bad0.length > 0)
      badList.push(bad0);
    if (badList.length === 0)
      return undefined;
    const result = new BagOfCurves();
    for (const list of badList) {
      for (const e of list) {
        const e1 = e instanceof SortableEdge ? e : e[0];
        const indexA = e1.vertexIndexA;
        const indexB = e1.vertexIndexB;
        const pointA = source.data.getPoint(indexA);
        const pointB = source.data.getPoint(indexB);
        if (pointA && pointB)
          result.tryAddChild(LineSegment3d.create(pointA, pointB));
      }
    }
    return result;
  }

  /** Find segments (within the linestring) which project to facets.
   * * Announce each pair of linestring segment and on-facet segment through a callback.
   * * Facets are ASSUMED to be convex and planar.
   */
  public static announceSweepLinestringToConvexPolyfaceXY(linestringPoints: GrowableXYZArray, polyface: Polyface,
    announce: AnnounceDrapePanel): any {
    const visitor = polyface.createVisitor(0);
    const numLinestringPoints = linestringPoints.length;
    const segmentPoint0 = Point3d.create();
    const segmentPoint1 = Point3d.create();
    const localSegmentPoint0 = Point3d.create();
    const localSegmentPoint1 = Point3d.create();
    const clipFractions = Segment1d.create(0, 1);
    const localFrame = Transform.createIdentity();
    let frame;
    for (visitor.reset(); visitor.moveToNextFacet();) {
      // For each triangle within the facet ...
      for (let k1 = 1; k1 + 1 < visitor.point.length; k1++) {
        frame = visitor.point.fillLocalXYTriangleFrame(0, k1, k1 + 1, localFrame);
        if (frame) {
          // For each stroke of the linestring ...
          for (let i1 = 1; i1 < numLinestringPoints; i1++) {
            linestringPoints.getPoint3dAtCheckedPointIndex(i1 - 1, segmentPoint0);
            linestringPoints.getPoint3dAtCheckedPointIndex(i1, segmentPoint1);
            frame.multiplyInversePoint3d(segmentPoint0, localSegmentPoint0);
            frame.multiplyInversePoint3d(segmentPoint1, localSegmentPoint1);
            clipFractions.set(0, 1);
            /** (x,y,1-x-y) are barycentric coordinates in the triangle !!! */
            if (clipFractions.clipBy01FunctionValuesPositive(localSegmentPoint0.x, localSegmentPoint1.x)
              && clipFractions.clipBy01FunctionValuesPositive(localSegmentPoint0.y, localSegmentPoint1.y)
              && clipFractions.clipBy01FunctionValuesPositive(
                1 - localSegmentPoint0.x - localSegmentPoint0.y,
                1 - localSegmentPoint1.x - localSegmentPoint1.y)) {
              /* project the local segment point to the plane. */
              const localClippedPointA = localSegmentPoint0.interpolate(clipFractions.x0, localSegmentPoint1);
              const localClippedPointB = localSegmentPoint0.interpolate(clipFractions.x1, localSegmentPoint1);
              const worldClippedPointA = localFrame.multiplyPoint3d(localClippedPointA)!;
              const worldClippedPointB = localFrame.multiplyPoint3d(localClippedPointB)!;
              const planePointA = localFrame.multiplyXYZ(localClippedPointA.x, localClippedPointA.y, 0.0)!;
              const planePointB = localFrame.multiplyXYZ(localClippedPointB.x, localClippedPointB.y, 0.0)!;
              const splitParameter = Geometry.inverseInterpolate01(localSegmentPoint0.z, localSegmentPoint1.z);
              // emit 1 or 2 panels, oriented so panel normal is always to the left of the line.
              if (splitParameter !== undefined && splitParameter > clipFractions.x0 && splitParameter < clipFractions.x1) {
                const piercePointX = segmentPoint0.interpolate(splitParameter, segmentPoint1);
                const piercePointY = piercePointX.clone();   // so points are distinct for the two triangle announcements.
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointA, piercePointX, planePointA], 2, 1);
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointB, piercePointY, planePointB], 1, 2);
              } else if (localSegmentPoint0.z > 0) {  // segment is entirely above
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointA, worldClippedPointB, planePointB, planePointA], 3, 2);
              } else // segment is entirely under
                announce(linestringPoints, i1 - 1, polyface, visitor.currentReadIndex(), [worldClippedPointB, worldClippedPointA, planePointA, planePointB], 2, 3);
            }
          }
        }
      }
    }
  }

  /** Search the facets for facet subsets that are connected with at least vertex contact.
   * * Return array of arrays of facet indices.
   */
  public static partitionFacetIndicesByVertexConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][] {
    if (polyface instanceof Polyface) {
      return this.partitionFacetIndicesByVertexConnectedComponent(polyface.createVisitor(0));
    }
    // The polyface is really a visitor !!!
    const context = new UnionFindContext(polyface.clientPolyface().data.point.length);
    for (polyface.reset(); polyface.moveToNextFacet();) {
      const firstVertexIndexOnThisFacet = polyface.pointIndex[0];
      for (const vertexIndex of polyface.pointIndex)
        context.mergeSubsets(firstVertexIndexOnThisFacet, vertexIndex);
    }
    const roots = context.collectRootIndices();
    const facetsInComponent: number[][] = [];
    const numRoots = roots.length;
    for (let i = 0; i < numRoots; i++) {
      facetsInComponent.push([]);
    }
    for (polyface.reset(); polyface.moveToNextFacet();) {
      const firstVertexIndexOnThisFacet = polyface.pointIndex[0];
      const rootVertexForThisFacet = context.findRoot(firstVertexIndexOnThisFacet);
      for (let rootIndex = 0; rootIndex < numRoots; rootIndex++) {
        if (roots[rootIndex] === rootVertexForThisFacet) {
          facetsInComponent[rootIndex].push(polyface.currentReadIndex());
          break;
        }
      }
    }
    return facetsInComponent;
  }
  /** Clone the facets in each partition to a separate polyface.
   *
   */
  public static clonePartitions(polyface: Polyface | PolyfaceVisitor, partitions: number[][]): Polyface[] {
    if (polyface instanceof Polyface) {
      return this.clonePartitions(polyface.createVisitor(0), partitions);
    }
    polyface.setNumWrap(0);
    const polyfaces: Polyface[] = [];
    const options = StrokeOptions.createForFacets();
    options.needNormals = polyface.normal !== undefined;
    options.needParams = polyface.param !== undefined;
    options.needColors = polyface.color !== undefined;
    options.needTwoSided = polyface.twoSided;
    for (const partition of partitions) {
      const builder = PolyfaceBuilder.create(options);
      polyface.reset();
      for (const facetIndex of partition) {
        polyface.moveToReadIndex(facetIndex);
        builder.addFacetFromVisitor(polyface);
      }
      polyfaces.push(builder.claimPolyface(true));
    }
    return polyfaces;
  }

  /** Search the facets for facet subsets that are connected with at least edge contact.
   * * Return array of arrays of facet indices.
   */
  public static partitionFacetIndicesByEdgeConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][] {
    if (polyface instanceof Polyface) {
      return this.partitionFacetIndicesByEdgeConnectedComponent(polyface.createVisitor(0));
    }
    polyface.setNumWrap(1);
    const matcher = new IndexedEdgeMatcher();
    polyface.reset();
    let numFacets = 0;
    while (polyface.moveToNextFacet()) {
      const numEdges = polyface.pointCount - 1;
      numFacets++;
      for (let i = 0; i < numEdges; i++) {
        matcher.addEdge(polyface.clientPointIndex(i), polyface.clientPointIndex(i + 1), polyface.currentReadIndex());
      }
    }
    const allEdges: SortableEdgeCluster[] = [];
    matcher.sortAndCollectClusters(allEdges, allEdges, allEdges, allEdges);
    const context = new UnionFindContext(numFacets);
    for (const cluster of allEdges) {
      if (cluster instanceof SortableEdge) {
        // this edge does not connect anywhere.  Ignore it!!
      } else {
        const edge0 = cluster[0];
        for (let i = 1; i < cluster.length; i++)
          context.mergeSubsets(edge0.facetIndex, cluster[i].facetIndex);
      }
    }

    const roots = context.collectRootIndices();
    const facetsInComponent: number[][] = [];
    const numRoots = roots.length;
    for (let i = 0; i < numRoots; i++) {
      facetsInComponent.push([]);
    }

    for (let facetIndex = 0; facetIndex < numFacets; facetIndex++) {
      const rootOfFacet = context.findRoot(facetIndex);
      for (let rootIndex = 0; rootIndex < numRoots; rootIndex++) {
        if (roots[rootIndex] === rootOfFacet) {
          facetsInComponent[rootIndex].push(facetIndex);
          break;
        }
      }
    }
    return facetsInComponent;
  }
  /** Find segments (within the linestring) which project to facets.
   * * Assemble each segment pair as a facet in a new polyface
   * * Facets are ASSUMED to be convex and planar.
   */
  public static sweepLinestringToFacetsXYreturnSweptFacets(linestringPoints: GrowableXYZArray, polyface: Polyface): Polyface {
    const builder = PolyfaceBuilder.create();
    this.announceSweepLinestringToConvexPolyfaceXY(linestringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[]) => {
        if (points.length === 4)
          builder.addQuadFacet(points);
        else if (points.length === 3)
          builder.addTriangleFacet(points);

      });
    return builder.claimPolyface(true);
  }
  /** Find segments (within the linestring) which project to facets.
   * * Return collected line segments
   */
  public static sweepLinestringToFacetsXYReturnLines(linestringPoints: GrowableXYZArray, polyface: Polyface): LineSegment3d[] {
    const drapeGeometry: LineSegment3d[] = [];
    this.announceSweepLinestringToConvexPolyfaceXY(linestringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[], indexA: number, indexB: number) => {
        drapeGeometry.push(LineSegment3d.create(points[indexA], points[indexB]));
      });
    return drapeGeometry;
  }

  /** Find segments (within the linestring) which project to facets.
   * * Return chains.
   */
  public static sweepLinestringToFacetsXYReturnChains(linestringPoints: GrowableXYZArray, polyface: Polyface): LineString3d[] {
    const chainContext = ChainMergeContext.create();

    this.announceSweepLinestringToConvexPolyfaceXY(linestringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[], indexA: number, indexB: number) => {
        chainContext.addSegment(points[indexA], points[indexB]);
      });
    chainContext.clusterAndMergeVerticesXYZ();
    return chainContext.collectMaximalChains();
  }

  /** Find segments (within the linestring) which project to facets.
   * * Return chains.
   */
  public static collectRangeLengthData(polyface: Polyface | PolyfaceVisitor): RangeLengthData {
    if (polyface instanceof Polyface) {
      return this.collectRangeLengthData(polyface.createVisitor(0));
    }
    const rangeData = new RangeLengthData();
    // polyface is a visitor ...
    for (polyface.reset(); polyface.moveToNextFacet();)
      rangeData.accumulateGrowableXYZArrayRange(polyface.point);
    return rangeData;
  }

  /** Clone the facets, inserting vertices (within edges) where points not part of each facet's vertex indices impinge within edges.
   *
   */
  public static cloneWithTVertexFixup(polyface: Polyface): Polyface {
    const oldFacetVisitor = polyface.createVisitor(1);  // This is to visit the existing facets.
    const newFacetVisitor = polyface.createVisitor(0); // This is to build the new facets.
    const rangeSearcher = XYPointBuckets.create(polyface.data.point, 30)!;
    const builder = PolyfaceBuilder.create();
    const edgeRange = Range3d.createNull();
    const point0 = Point3d.create();
    const point1 = Point3d.create();
    const spacePoint = Point3d.create();
    const segment = LineSegment3d.create(point0, point1);

    for (oldFacetVisitor.reset(); oldFacetVisitor.moveToNextFacet();) {
      newFacetVisitor.clearArrays();
      for (let i = 0; i + 1 < oldFacetVisitor.point.length; i++) {
        // each base vertex is part of the result ...
        oldFacetVisitor.point.getPoint3dAtUncheckedPointIndex(i, point0);
        oldFacetVisitor.point.getPoint3dAtUncheckedPointIndex(i + 1, point1);
        newFacetVisitor.pushDataFrom(oldFacetVisitor, i);
        edgeRange.setNull();
        LineSegment3d.create(point0, point1, segment);
        let detailArray: CurveLocationDetail[] | undefined;
        edgeRange.extend(point0);
        edgeRange.extend(point1);
        rangeSearcher.announcePointsInRange(edgeRange, (index: number, _x: number, _y: number, _z: number) => {
          // x,y,z has x,y within the range of the search ... test for exact on (in full 3d!)
          polyface.data.point.getPoint3dAtUncheckedPointIndex(index, spacePoint);
          const detail = segment.closestPoint(spacePoint, false);
          if (undefined !== detail) {
            if (detail.fraction >= 0.0 && detail.fraction < 1.0 && !detail.point.isAlmostEqual(point0) && !detail.point.isAlmostEqual(point1)) {
              if (detailArray === undefined)
                detailArray = [];
              detail.a = index;
              detailArray.push(detail);
            }
          }
          return true;
        });
        if (detailArray !== undefined) {
          detailArray.sort((a: CurveLocationDetail, b: CurveLocationDetail) => (a.fraction - b.fraction));
          for (const d of detailArray) {
            newFacetVisitor.pushInterpolatedDataFrom(oldFacetVisitor, i, d.fraction, i + 1);
          }
        }
      }
      builder.addFacetFromGrowableArrays(newFacetVisitor.point, newFacetVisitor.normal, newFacetVisitor.param, newFacetVisitor.color);
    }

    return builder.claimPolyface();
  }

  /** Clone the facets, inserting removing points that are simply within colinear edges.
   *
   */
  public static cloneWithColinearEdgeFixup(polyface: Polyface): Polyface {
    const oldFacetVisitor = polyface.createVisitor(2);  // This is to visit the existing facets.
    const newFacetVisitor = polyface.createVisitor(0); // This is to build the new facets.
    const builder = PolyfaceBuilder.create();
    const vector01 = Vector3d.create();
    const vector12 = Vector3d.create();
    const numPoint = polyface.data.point.length;
    const pointState = new Int32Array(numPoint);
    // FIRST PASS -- in each sector of each facet, determine if the sector has colinear incoming and outgoing vectors.
    //   Mark each point as
    //  0 unvisited
    // -1 incident to a non-colinear sector
    //  n incident to n colinear sectors
    for (oldFacetVisitor.reset(); oldFacetVisitor.moveToNextFacet();) {
      for (let i = 0; i + 2 < oldFacetVisitor.point.length; i++) {
        // each base vertex is part of the result ...
        oldFacetVisitor.point.vectorIndexIndex(i, i + 1, vector01);
        oldFacetVisitor.point.vectorIndexIndex(i + 1, i + 2, vector12);
        const pointIndex = oldFacetVisitor.clientPointIndex(i + 1);
        if (pointState[pointIndex] >= 0) {
          const theta = vector01.angleTo(vector12);
          if (theta.isAlmostZero) {
            pointState[pointIndex]++;
          } else {
            pointState[pointIndex] = -1;
          }
        }
      }
    }
    // SECOND PASS -- make copies, omitting references to points at colinear sectors
    for (oldFacetVisitor.reset(); oldFacetVisitor.moveToNextFacet();) {
      newFacetVisitor.clearArrays();
      for (let i = 0; i + 2 < oldFacetVisitor.point.length; i++) {
        const pointIndex = oldFacetVisitor.clientPointIndex(i);
        if (pointState[pointIndex] < 0) {
          newFacetVisitor.pushDataFrom(oldFacetVisitor, i);
        }
      }
      if (newFacetVisitor.point.length > 2)
        builder.addFacetFromGrowableArrays(newFacetVisitor.point, newFacetVisitor.normal, newFacetVisitor.param, newFacetVisitor.color);
    }
    return builder.claimPolyface();
  }
}

/** Announce the points on a drape panel.
 * * The first two points in the array are always along the draped line segment.
 * * The last two are always on the facet.
 * * If there are 4 points, those two pairs are distinct, i.e. both segment points are to the same side of the facet.
 * * If there are 3 points, those two pairs share an on-facet point.
 * * The panel is ordered so the outward normal is to the right of the draped segment.
 * @param indexAOnFacet index (in points) of the point that is the first facet point for moving forward along the linestring
 * @param indexBOnFacet index (in points) of the point that is the second facet point for moving forward along the linestring
 * @public
 */
export type AnnounceDrapePanel = (linestring: GrowableXYZArray, segmentIndex: number,
  polyface: Polyface, facetIndex: number, points: Point3d[], indexAOnFacet: number, indexBOnFacet: number) => any;
