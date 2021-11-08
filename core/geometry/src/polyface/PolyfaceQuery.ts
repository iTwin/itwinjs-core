/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

// import { Point2d } from "./Geometry2d";
/* eslint-disable @typescript-eslint/naming-convention, no-empty */
import { BagOfCurves, CurveCollection } from "../curve/CurveCollection";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Angle } from "../geometry3d/Angle";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { Range3d } from "../geometry3d/Range";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { MomentData } from "../geometry4d/MomentData";
import { UnionFindContext } from "../numerics/UnionFind";
import { ChainMergeContext } from "../topology/ChainMerge";
import { FacetOrientationFixup } from "./FacetOrientation";
import { IndexedEdgeMatcher, SortableEdge, SortableEdgeCluster } from "./IndexedEdgeMatcher";
import { IndexedPolyfaceSubsetVisitor } from "./IndexedPolyfaceVisitor";
import { BuildAverageNormalsContext } from "./multiclip/BuildAverageNormalsContext";
import { SweepLineStringToFacetContext } from "./multiclip/SweepLineStringToFacetContext";
import { XYPointBuckets } from "./multiclip/XYPointBuckets";
import { IndexedPolyface, Polyface, PolyfaceVisitor } from "./Polyface";
import { PolyfaceBuilder } from "./PolyfaceBuilder";
import { RangeLengthData } from "./RangeLengthData";

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
/**
 * Enumeration of cases for retaining facets among duplicates
 * @public
 */
export enum DuplicateFacetClusterSelector {
  /** retain none of the duplicates */
  SelectNone = 0,
  /** retain any one member among duplicates */
  SelectAny = 1,
  /** retain all members among duplicates */
  SelectAll = 2,
  /** retain one from any cluster with an odd number of faces */
  SelectOneByParity = 3,
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
  public static sumFacetAreas(source: Polyface | PolyfaceVisitor | undefined): number {
    let s = 0;
    if (source !== undefined) {
      if (source instanceof Polyface)
        return PolyfaceQuery.sumFacetAreas(source.createVisitor(1));

      source.reset();
      while (source.moveToNextFacet()) {
        s += PolygonOps.areaNormal(source.point.getPoint3dArray()).magnitude();
      }
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
    const facetOrigin = Point3d.create();
    const targetA = Point3d.create();
    const targetB = Point3d.create();
    source.reset();
    while (source.moveToNextFacet()) {
      if (myOrigin === undefined)
        myOrigin = source.point.getPoint3dAtUncheckedPointIndex(0);
      source.point.getPoint3dAtUncheckedPointIndex(0, facetOrigin);
      for (let i = 1; i + 1 < source.point.length; i++) {
        source.point.getPoint3dAtUncheckedPointIndex(i, targetA);
        source.point.getPoint3dAtUncheckedPointIndex(i + 1, targetB);
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

    source.reset();
    // For each facet ..
    //   Form triangles from facet origin to each far edge.
    //   Sum signed area and volume contributions
    // each "projectedArea" contribution is twice the area of a triangle.
    // each volume contribution is  3 times the actual volume -- (1/3) of the altitude sums was the centroid altitude.
    while (source.moveToNextFacet()) {
      source.point.getPoint3dAtUncheckedPointIndex(0, facetOrigin);
      h0 = plane.altitude(facetOrigin);
      singleFacetArea = 0;
      // within a single facets, the singleFacetArea sum is accumulated with signs of individual triangles.
      // For a non-convex facet, this can be a mixture of positive and negative areas.
      // The absoluteProjectedAreaSum contribution is forced positive after the sum for the facet.
      for (let i = 1; i + 1 < source.point.length; i++) {
        source.point.getPoint3dAtUncheckedPointIndex(i, targetA);
        source.point.getPoint3dAtUncheckedPointIndex(i + 1, targetB);
        facetOrigin.crossProductToPoints(targetA, targetB, triangleNormal);
        hA = plane.altitude(targetA);
        hB = plane.altitude(targetB);
        signedTriangleArea = planeNormal.dotProduct(triangleNormal);
        singleFacetArea += signedTriangleArea;
        signedVolumeSum += signedTriangleArea * (h0 + hA + hB);
      }

      singleFacetProducts.setZero();
      source.point.multiplyTransformInPlace(projectToPlane);
      PolygonOps.addSecondMomentAreaProducts(source.point, facetOrigin, singleFacetProducts);

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
    source.reset();
    while (source.moveToNextFacet()) {
      PolygonOps.addSecondMomentAreaProducts(source.point, origin, products);
    }
    return products;
  }
  /** Return the inertia products [xx,xy,xz,xw, yw, etc] integrated over all tetrahedral volumes from origin */
  public static sumFacetSecondVolumeMomentProducts(source: Polyface | PolyfaceVisitor, origin: Point3d): Matrix4d {
    if (source instanceof Polyface)
      return PolyfaceQuery.sumFacetSecondVolumeMomentProducts(source.createVisitor(0), origin);
    const products = Matrix4d.createZero();
    source.reset();
    while (source.moveToNextFacet()) {
      PolygonOps.addSecondMomentVolumeProducts(source.point, origin, products);
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
   */
  public static isPolyfaceClosedByEdgePairing(source: Polyface): boolean {
    return this.isPolyfaceManifold(source, false);
  }
  /** Test edges pairing in `source` mesh.
   * * for `allowSimpleBoundaries === false` true return means this is a closed 2-manifold surface
   * * for `allowSimpleBoundaries === true` true means this is a 2-manifold surface which may have boundary, but is still properly matched internally.
   * * Any edge with 3 ore more incident facets triggers `false` return.
   * * Any edge with 2 incident facets in the same direction triggers a `false` return.
  */
  public static isPolyfaceManifold(source: Polyface, allowSimpleBoundaries: boolean = false): boolean {
    const edges = new IndexedEdgeMatcher();
    const visitor = source.createVisitor(1);
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), visitor.currentReadIndex());
      }
    }
    const badClusters: SortableEdgeCluster[] = [];
    edges.sortAndCollectClusters(undefined, allowSimpleBoundaries ? undefined : badClusters, undefined, badClusters);
    return badClusters.length === 0;
  }

  /**
  * Test if the facets in `source` occur in perfectly mated pairs, as is required for a closed manifold volume.
  * If not, extract the boundary edges as lines.
  * @param source
  */
  public static boundaryEdges(source: Polyface | PolyfaceVisitor | undefined, includeDanglers: boolean = true, includeMismatch: boolean = true, includeNull: boolean = true): CurveCollection | undefined {
    if (source === undefined)
      return undefined;
    const edges = new IndexedEdgeMatcher();
    const visitor = source instanceof Polyface ? source.createVisitor(1) : source;
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
    const sourcePolyface = visitor.clientPolyface()!;
    const result = new BagOfCurves();
    for (const list of badList) {
      for (const e of list) {
        const e1 = e instanceof SortableEdge ? e : e[0];
        const indexA = e1.vertexIndexA;
        const indexB = e1.vertexIndexB;
        const pointA = sourcePolyface.data.getPoint(indexA);
        const pointB = sourcePolyface.data.getPoint(indexB);
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
    const context = SweepLineStringToFacetContext.create(linestringPoints);
    if (context) {
      const visitor = polyface.createVisitor(0);
      for (visitor.reset(); visitor.moveToNextFacet();) {
        context.projectToPolygon(visitor.point, announce, polyface, visitor.currentReadIndex());
      }
    }
  }

  /** Execute context.projectToPolygon until its work estimates accumulate to workLimit  */
  private static async continueAnnouunceSweepLinestringToConvexPolyfaceXY(
    context: SweepLineStringToFacetContext, visitor: PolyfaceVisitor, announce: AnnounceDrapePanel): Promise<number> {
    let workCount = 0;
    while ((workCount < this.asyncWorkLimit) && visitor.moveToNextFacet()) {
      workCount += context.projectToPolygon(visitor.point, announce, visitor.clientPolyface()!, visitor.currentReadIndex());
    }
    return workCount;
  }
  // amount of computation to do per step of async methods.
  private static _asyncWorkLimit = 1.e06;
  /** Set the limit on work during an async time blocks, and return the old value.
   * * This should be a large number -- default is 1.0e6
   * @internal
   */
  public static setAsyncWorkLimit(value: number): number { const a = this._asyncWorkLimit; this._asyncWorkLimit = value; return a; }
  /** Query the current limit on work during an async time block.
   * @internal
   */
  public static get asyncWorkLimit(): number { return this._asyncWorkLimit; }
  /** Number of "await" steps executed in recent async calls.
   * @internal
   */
  public static awaitBlockCount = 0;

  /** Find segments (within the linestring) which project to facets.
   * * Announce each pair of linestring segment and on-facet segment through a callback.
   * * Facets are ASSUMED to be convex and planar.
   * * REMARK: Although this is public, the usual use is via slightly higher level public methods, viz:
   *   * asyncSweepLinestringToFacetsXYReturnChains
   * @internal
   */
  public static async asyncAnnounceSweepLinestringToConvexPolyfaceXY(linestringPoints: GrowableXYZArray, polyface: Polyface,
    announce: AnnounceDrapePanel): Promise<number> {
    const context = SweepLineStringToFacetContext.create(linestringPoints);
    this.awaitBlockCount = 0;
    let workTotal = 0;
    if (context) {
      const visitor = polyface.createVisitor(0);
      let workCount;
      while (0 < (workCount = await Promise.resolve(PolyfaceQuery.continueAnnouunceSweepLinestringToConvexPolyfaceXY(context, visitor, announce)))) {
        workTotal += workCount;
        this.awaitBlockCount++;
        // console.log({ myWorkCount: workCount, myBlockCount: this.awaitBlockCount });
      }
    }
    // eslint-disable-next-line no-console
    // console.log({ myWorkTotal: workTotal, myBlockCount: this.awaitBlockCount });
    return workTotal;
  }

  /** Search the facets for facet subsets that are connected with at least vertex contact.
   * * Return array of arrays of facet indices.
   */
  public static partitionFacetIndicesByVertexConnectedComponent(polyface: Polyface | PolyfaceVisitor): number[][] {
    if (polyface instanceof Polyface) {
      return this.partitionFacetIndicesByVertexConnectedComponent(polyface.createVisitor(0));
    }
    // The polyface is really a visitor !!!
    const context = new UnionFindContext(this.visitorClientPointCount(polyface));
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
  /**
   * * Examine the normal orientation for each faces.
   * * Separate to 3 partitions:
   *    * facets with normal in the positive direction of the vectorToEye (partition 0)
   *    * facets with normal in the negative direction of the vectorToEye (partition 1)
   *    * facets nearly perpendicular to the view vector  (partition 2)
   * * Return array of arrays of facet indices.
   */
  public static partitionFacetIndicesByVisibilityVector(polyface: Polyface | PolyfaceVisitor, vectorToEye: Vector3d, sideAngleTolerance: Angle): number[][] {
    if (polyface instanceof Polyface) {
      return this.partitionFacetIndicesByVisibilityVector(polyface.createVisitor(0), vectorToEye, sideAngleTolerance);
    }
    const facetsInComponent: number[][] = [];
    for (let i = 0; i < 3; i++) {
      facetsInComponent.push([]);
    }
    const forwardComponent = facetsInComponent[0];
    const rearComponent = facetsInComponent[1];
    const sideComponent = facetsInComponent[2];
    const radiansTol = Math.max(sideAngleTolerance.radians, 1.0e-8);
    for (polyface.reset(); polyface.moveToNextFacet();) {
      const areaNormal = PolygonOps.areaNormalGo(polyface.point);
      const index = polyface.currentReadIndex();
      if (areaNormal) {
        const angle = areaNormal.angleFromPerpendicular(vectorToEye);
        if (Math.abs(angle.radians) < radiansTol) {
          sideComponent.push(index);
        } else if (areaNormal.dotProduct(vectorToEye) < 0) {
          rearComponent.push(index);
        } else {
          forwardComponent.push(index);
        }
      }
    }
    return facetsInComponent;
  }

  /**
   * Return the boundary of facets that are facing the eye.
   * @param polyface
   * @param visibilitySubset selector among the visible facet sets extracted by partitionFacetIndicesByVisibilityVector
   *   * 0 ==> forward facing
   *   * 1 ==> rear facing
   *   * 2 ==> side facing
   * @param vectorToEye
   * @param sideAngleTolerance
   */
  public static boundaryOfVisibleSubset(polyface: IndexedPolyface, visibilitySelect: 0 | 1 | 2, vectorToEye: Vector3d, sideAngleTolerance: Angle = Angle.createDegrees(1.0e-3)): CurveCollection | undefined {
    const partitionedIndices = this.partitionFacetIndicesByVisibilityVector(polyface, vectorToEye, sideAngleTolerance);
    if (partitionedIndices[visibilitySelect].length === 0)
      return undefined;
    const visitor = IndexedPolyfaceSubsetVisitor.createSubsetVisitor(polyface, partitionedIndices[visibilitySelect], 1);
    return this.boundaryEdges(visitor, true, false, false);
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

  /** Clone facets that pass an filter function
   */
   public static cloneFiltered(source: Polyface | PolyfaceVisitor, filter: (visitor: PolyfaceVisitor) => boolean): Polyface{
    if (source instanceof Polyface) {
      return this.cloneFiltered(source.createVisitor(0), filter);
    }
    source.setNumWrap(0);
    const options = StrokeOptions.createForFacets();
    options.needNormals = source.normal !== undefined;
    options.needParams = source.param !== undefined;
    options.needColors = source.color !== undefined;
    options.needTwoSided = source.twoSided;
    const builder = PolyfaceBuilder.create(options);
    source.reset();
    for (; source.moveToNextFacet();){
      if (filter (source))
      builder.addFacetFromVisitor(source);
    }
    return builder.claimPolyface(true);
  }
  /** If the visitor's client is a polyface, simply return its point array length.
   * If not a polyface, visit all facets to find the largest index.
   */
  private static visitorClientPointCount(visitor: PolyfaceVisitor): number {
    const polyface = visitor.clientPolyface();
    if (polyface !== undefined)
      return polyface.data.point.length;
    visitor.reset();
    let maxIndex = -1;
    while (visitor.moveToNextFacet()) {
      for (const pointIndex of visitor.pointIndex)
        if (pointIndex > maxIndex)
          maxIndex = pointIndex;
    }
    return maxIndex + 1;
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
   * * This is done as a sequence of "await" steps.
   * * Each "await" step deals with approximately PolyfaceQuery.asyncWorkLimit pairings of (linestring edge) with (facet edge)
   *  * PolyfaceQuery.setAsyncWorkLimit () to change work blocks from default
   * * Return chains.
   */
  public static async asyncSweepLinestringToFacetsXYReturnChains(linestringPoints: GrowableXYZArray, polyface: Polyface): Promise<LineString3d[]> {
    const chainContext = ChainMergeContext.create();

    await Promise.resolve(this.asyncAnnounceSweepLinestringToConvexPolyfaceXY(linestringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[], indexA: number, indexB: number) => {
        chainContext.addSegment(points[indexA], points[indexB]);
      }));
    chainContext.clusterAndMergeVerticesXYZ();
    const chains = chainContext.collectMaximalChains();
    return chains;
  }

  /**
   * * Examine ranges of facets.
   * * Return statistical summary of x,y,z ranges.
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
  public static cloneWithTVertexFixup(polyface: Polyface): IndexedPolyface {
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
            if (detail.fraction >= 0.0 && detail.fraction < 1.0 && !detail.point.isAlmostEqual(point0) && !detail.point.isAlmostEqual(point1)
              && spacePoint.isAlmostEqual(detail.point)) {
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
  /**
   * * Each array input structure is: [facetIndex, vertexIndex0, vertexIndex1, ....]
   * * Vertex indices assumed reversed so it
   *   * vertexIndex0 is the lowest index on the facet
   *   * vertexIndex1 is the lowest neighbor of vertex0
   *   * first different entry among vertex indices determines lexical result.
   *   * Hence facets with duplicate indices (whether forward or reversed) are considered equal.
   * @param arrayA
   * @param arrayB
   */
  private static compareFacetIndexAndVertexIndices(arrayA: number[], arrayB: number[]): number {
    if (arrayA.length !== arrayB.length)
      return arrayA.length - arrayB.length;
    for (let i = 1; i < arrayA.length; i++) {
      if (arrayA[i] !== arrayB[i]) {
        return arrayA[i] - arrayB[i];
      }
    }
    return 0;
  }
  /**
   * * Return an array of arrays describing facet duplication.
   * @param includeSingletons if true, non-duplicated facets are included in the output.
   * * Each array `entry` in the output contains read indices of a cluster of facets with the same vertex indices.
   */
  public static collectDuplicateFacetIndices(polyface: Polyface, includeSingletons: boolean = false): number[][] {
    const result: number[][] = [];
    this.announceDuplicateFacetIndices(polyface,
      (clusterFacetIndices: number[]) => {
        if (includeSingletons || clusterFacetIndices.length > 1)
          result.push(clusterFacetIndices.slice());
      });
    return result;
  }
  /**
   * * Return an array of arrays describing facet duplication.
   * @param includeSingletons if true, non-duplicated facets are included in the output.
   * * Each array `entry` in the output contains read indices of a cluster of facets with the same vertex indices.
   */
  public static announceDuplicateFacetIndices(polyface: Polyface, announceCluster: (clusterFacetIndices: number[]) => void) {
    const visitor = polyface.createVisitor(0);  // This is to visit the existing facets.
    const facetIndexAndVertexIndices: number[][] = [];
    for (visitor.reset(); visitor.moveToNextFacet();) {
      const facetIndex = visitor.currentReadIndex();
      const entry = [facetIndex];
      const pointIndex = visitor.pointIndex;
      const numPointsThisFacet = pointIndex.length;
      let lowIndex = 0;
      // find the lowest point index ...
      for (let i = 1; i < visitor.pointIndex.length; i++) {
        if (pointIndex[i] < pointIndex[lowIndex])
          lowIndex = i;
      }
      // find its lowest neighbor -- assemble sort array in that direction
      if (pointIndex[(lowIndex + 1) % numPointsThisFacet] < pointIndex[(lowIndex + numPointsThisFacet - 1) % numPointsThisFacet]) {
        for (let i = 0; i < numPointsThisFacet; i++) {
          entry.push(pointIndex[(lowIndex + i) % numPointsThisFacet]);
        }
      } else {
        for (let i = 0; i < numPointsThisFacet; i++) {
          entry.push(pointIndex[(lowIndex + numPointsThisFacet - i) % numPointsThisFacet]);
        }
      }
      facetIndexAndVertexIndices.push(entry);
    }
    facetIndexAndVertexIndices.sort(this.compareFacetIndexAndVertexIndices);
    let i0, i1;
    const n = facetIndexAndVertexIndices.length;
    const clusterArray = [];
    for (i0 = 0; i0 < n; i0 = i1) {
      i1 = i0 + 1;
      clusterArray.length = 0;
      clusterArray.push(facetIndexAndVertexIndices[i0][0]);
      while (i1 < n && 0 === this.compareFacetIndexAndVertexIndices(facetIndexAndVertexIndices[i0], facetIndexAndVertexIndices[i1])) {
        clusterArray.push(facetIndexAndVertexIndices[i1][0]);
        i1++;
      }
      announceCluster(clusterArray);
    }
  }
  /** Return a new facet set with a subset of facets in source
   * @param includeSingletons true to copy facets that only appear once
   * @param clusterSelector indicates whether duplicate clusters are to have 0, 1, or all facets included
   */
  public static cloneByFacetDuplication(source: Polyface, includeSingletons: boolean, clusterSelector: DuplicateFacetClusterSelector): Polyface {
    const builder = PolyfaceBuilder.create();
    const visitor = source.createVisitor(0);
    this.announceDuplicateFacetIndices(source,
      (clusterFacetIndices: number[]) => {
        let numToSelect = 0;
        if (clusterFacetIndices.length === 1) {
          if (includeSingletons)
            numToSelect = 1;
        } else if (clusterFacetIndices.length > 1) {
          if (clusterSelector === DuplicateFacetClusterSelector.SelectAny)
            numToSelect = 1;
          else if (clusterSelector === DuplicateFacetClusterSelector.SelectAll)
            numToSelect = clusterFacetIndices.length;
          else if (clusterSelector === DuplicateFacetClusterSelector.SelectOneByParity)
            numToSelect = (clusterFacetIndices.length & 0x01) === 0x01 ? 1 : 0;
        }
        for (let i = 0; i < numToSelect; i++) {
          visitor.moveToReadIndex(clusterFacetIndices[i]);
          builder.addFacetFromVisitor(visitor);
        }
      });
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

  /**
   * Set the edge visibility for specified edges in the polyface.
   * @param polyface mesh to be edited
   * @param clusters array of edge references
   * @param value visibility value (true or false)
   */
  private static setEdgeVisibility(polyface: IndexedPolyface, clusters: SortableEdgeCluster[], value: boolean) {
    for (const cluster of clusters) {
      if (cluster instanceof SortableEdge) {
        this.setSingleEdgeVisibility(polyface, cluster.facetIndex, cluster.vertexIndexA, value);
      } else if (Array.isArray(cluster)) {
        for (const e1 of cluster)
          this.setSingleEdgeVisibility(polyface, e1.facetIndex, e1.vertexIndexA, value);
      }
    }
  }
  /**
   * Set the visibility of a particular edge of a particular facet.
   * @param polyface containing polyface
   * @param facetIndex facet index
   * @param vertexIndex vertex index (in vertex array)
   * @param value visibility value.
   */
  public static setSingleEdgeVisibility(polyface: IndexedPolyface, facetIndex: number, vertexIndex: number, value: boolean) {
    const data = polyface.data;
    const index0 = polyface.facetIndex0(facetIndex);
    const index1 = polyface.facetIndex1(facetIndex);
    for (let i = index0; i < index1; i++)
      if (data.pointIndex[i] === vertexIndex)
        data.edgeVisible[i] = value;
  }
  /** Load all half edges from a mesh to an IndexedEdgeMatcher */
  public static createIndexedEdges(visitor: PolyfaceVisitor): IndexedEdgeMatcher {
    const edges = new IndexedEdgeMatcher();
    visitor.reset();
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), visitor.currentReadIndex());
      }
    }
    return edges;
  }
  /**
  * * Find mated pairs among facet edges.
  * * Mated pairs have the same vertex indices appearing in opposite order.
  * * Mark all non-mated pairs invisible.
  * * At mated pairs
  *    * if angle across the edge is larger than `sharpEdgeAngle`, mark visible
  *    * otherwise mark invisible.
  * @param mesh mesh to be marked
  */
  public static markPairedEdgesInvisible(mesh: IndexedPolyface, sharpEdgeAngle?: Angle) {
    const visitor = mesh.createVisitor(1);
    const edges = this.createIndexedEdges(visitor);

    const pairedEdges: SortableEdgeCluster[] = [];
    const boundaryEdges: SortableEdgeCluster[] = [];
    edges.sortAndCollectClusters(pairedEdges, boundaryEdges, boundaryEdges, boundaryEdges);
    this.markAllEdgeVisibility(mesh, false);
    this.setEdgeVisibility(mesh, boundaryEdges, true);
    if (sharpEdgeAngle !== undefined) {
      const normal0 = Vector3d.create();
      const normal1 = Vector3d.create();
      for (const pair of pairedEdges) {
        if (Array.isArray(pair) && pair.length === 2) {
          const e0 = pair[0];
          const e1 = pair[1];
          if (undefined !== PolyfaceQuery.computeFacetUnitNormal(visitor, e0.facetIndex, normal0)
            && undefined !== PolyfaceQuery.computeFacetUnitNormal(visitor, e1.facetIndex, normal1)) {
            const edgeAngle = normal0.smallerUnorientedAngleTo(normal1);
            if (edgeAngle.radians > sharpEdgeAngle.radians) {
              this.setSingleEdgeVisibility(mesh, e0.facetIndex, e0.vertexIndexA, true);
              this.setSingleEdgeVisibility(mesh, e1.facetIndex, e1.vertexIndexA, true);
            }
          }
        }
      }
    }
  }
  /** Try to compute a unit normal for a facet accessible through a visitor.
   * * Unit normal is computed by `PolygonOps.unitNormal` with the points around the facet.
   */
  public static computeFacetUnitNormal(visitor: PolyfaceVisitor, facetIndex: number, result?: Vector3d): Vector3d | undefined {
    if (!result)
      result = Vector3d.create();
    if (visitor.moveToReadIndex(facetIndex)) {
      if (PolygonOps.unitNormal(visitor.point, result))
        return result;
    }
    return undefined;
  }
  /**
  * * Mark all edge visibilities in the IndexedPolyface
  * @param mesh mesh to be marked
  * @param value true for visible, false for hidden
  */

  public static markAllEdgeVisibility(mesh: IndexedPolyface, value: boolean) {
    const data = mesh.data;
    for (let i = 0; i < data.edgeVisible.length; i++)
      data.edgeVisible[i] = value;
  }
  /**
   * * Examine adjacent facet orientations throughout the mesh
   * * If possible, reverse a subset to achieve proper pairing.
   * @param mesh
   */
  public static reorientVertexOrderAroundFacetsForConsistentOrientation(mesh: IndexedPolyface): boolean {
    return FacetOrientationFixup.doFixup(mesh);
  }

  /**
   * Set up indexed normals with one normal in the plane of each facet of the mesh.
   * @param polyface
   */
  public static buildPerFaceNormals(polyface: IndexedPolyface) {
    BuildAverageNormalsContext.buildPerFaceNormals(polyface);
  }

  /**
  * * At each vertex of the mesh
  *   * Find clusters of almost parallel normals
  *   * Compute simple average of those normals
  *   * Index to the averages
  * * For typical meshes, this correctly clusters adjacent normals.
  * * One cam imagine a vertex with multiple "smooth cone-like" sets of incident facets such that averaging occurs among two nonadjacent cones.  But this does not seem to be a problem in practice.
  * @param polyface polyface to update.
  * @param toleranceAngle averaging is done between normals up to this angle.
  */
  public static buildAverageNormals(polyface: IndexedPolyface, toleranceAngle: Angle = Angle.createDegrees(31.0)) {
    BuildAverageNormalsContext.buildFastAverageNormals(polyface, toleranceAngle);
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

