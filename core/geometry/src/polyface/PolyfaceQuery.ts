/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Polyface
 */

/* eslint-disable @typescript-eslint/naming-convention, no-empty */

import { BagOfCurves, CurveCollection } from "../curve/CurveCollection";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";
import { CurveOps } from "../curve/CurveOps";
import { LinearCurvePrimitive } from "../curve/CurvePrimitive";
import { AnyChain } from "../curve/CurveTypes";
import { MultiChainCollector } from "../curve/internalContexts/MultiChainCollector";
import { LineSegment3d } from "../curve/LineSegment3d";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";
import { BarycentricTriangle, TriangleLocationDetail } from "../geometry3d/BarycentricTriangle";
import { FrameBuilder } from "../geometry3d/FrameBuilder";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3dArrayCarrier } from "../geometry3d/Point3dArrayCarrier";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { PolygonLocationDetail, PolygonOps } from "../geometry3d/PolygonOps";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { MomentData } from "../geometry4d/MomentData";
import { UnionFindContext } from "../numerics/UnionFind";
import { ChainMergeContext } from "../topology/ChainMerge";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../topology/Graph";
import { HalfEdgeGraphFromIndexedLoopsContext } from "../topology/HalfEdgeGraphFromIndexedLoopsContext";
import { HalfEdgeGraphSearch, HalfEdgeMaskTester } from "../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge } from "../topology/Merging";
import { SpacePolygonTriangulation } from "../topology/SpaceTriangulation";
import {
  ConvexFacetLocationDetail, FacetIntersectOptions, FacetLocationDetail, NonConvexFacetLocationDetail, TriangularFacetLocationDetail,
} from "./FacetLocationDetail";
import { FacetOrientationFixup } from "./FacetOrientation";
import { IndexedEdgeMatcher, SortableEdge, SortableEdgeCluster } from "./IndexedEdgeMatcher";
import { IndexedPolyfaceSubsetVisitor } from "./IndexedPolyfaceVisitor";
import { BuildAverageNormalsContext } from "./multiclip/BuildAverageNormalsContext";
import { OffsetMeshContext } from "./multiclip/OffsetMeshContext";
import { Range2dSearchInterface } from "./multiclip/Range2dSearchInterface";
import { ClipSweptLineStringContext, EdgeClipData, SweepLineStringToFacetContext } from "./multiclip/SweepLineStringToFacetContext";
import { XYPointBuckets } from "./multiclip/XYPointBuckets";
import { IndexedPolyface, Polyface, PolyfaceVisitor } from "./Polyface";
import { PolyfaceBuilder } from "./PolyfaceBuilder";
import { RangeLengthData } from "./RangeLengthData";

/**
 * Options carrier for sweeping linework onto meshes.
 * * The create method initializes all options.
 * @public
 */
export class SweepLineStringToFacetsOptions {
  /** vector "towards the eye"
   * * In the common case of sweeping to an XY (e.g. ground or DTM) mesh,
   *    use the positive Z vector as an up vector.
   * * In general case, this is a vector from the mesh towards an eye at infinity.
   */
  public vectorToEye: Vector3d;
  /** true to collect edges from facets that face towards the eye */
  public collectOnForwardFacets: boolean;
  /** true to collect facets that are "on the side", i.e. their outward vector is perpendicular to vectorToEye. */
  public collectOnSideFacets: boolean;
  /** true to collect facets that face away from the eye */
  public collectOnRearFacets: boolean;
  /** (small) angle to use as tolerance for deciding if a facet is "on the side".  Default (if given in degrees) is Geometry.smallAngleDegrees */
  public sideAngle: Angle;
  /** option to assemble lines into chains */
  public assembleChains: boolean;

  /** constructor -- captures fully-checked parameters from static create method.
  */
  private constructor(vectorToEye: Vector3d, sideAngle: Angle, assembleChains: boolean, collectOnForwardFacets: boolean, collectOnSideFacets: boolean, collectOnRearFacets: boolean) {
    this.vectorToEye = vectorToEye;
    this.sideAngle = sideAngle;
    this.assembleChains = assembleChains;
    this.collectOnForwardFacets = collectOnForwardFacets;
    this.collectOnSideFacets = collectOnSideFacets;
    this.collectOnRearFacets = collectOnRearFacets;
  }

  /** Create an options structure.
   * * Default vectorToEye is positive Z
   * * Default sideAngle has radians value Geometry.smallAngleRadians
   * * Default assembleChains is true
   * * Default collectOnForwardFacets, collectOnSideFacets, collectOnRearFacets are all true.
   */
  public static create(vectorToEye?: Vector3d, sideAngle?: Angle, assembleChains?: boolean,
    collectOnForwardFacets?: boolean,
    collectOnSideFacets?: boolean,
    collectOnRearFacets?: boolean) {
    return new SweepLineStringToFacetsOptions(
      vectorToEye === undefined ? Vector3d.unitZ() : vectorToEye.clone(),
      sideAngle === undefined ? Angle.createRadians(Geometry.smallAngleRadians) : sideAngle.clone(),
      Geometry.resolveValue(assembleChains, true),
      Geometry.resolveValue(collectOnForwardFacets, true),
      Geometry.resolveValue(collectOnSideFacets, true),
      Geometry.resolveValue(collectOnRearFacets, true),
    );
  }
  /** Return true if all outputs are requested */
  public get collectAll() { return this.collectOnForwardFacets === true && this.collectOnRearFacets === true && this.collectOnRearFacets === true; }

  /** Decide if the instance flags accept this facet.
   * * Facets whose facet normal have positive, zero, or negative dot product with the vectorToEye are forward, side, and rear.
   * * Undefined facet normal returns false
  */
  public collectFromThisFacetNormal(facetNormal: Vector3d | undefined): boolean {
    if (facetNormal === undefined)
      return false;
    const theta = facetNormal.angleFromPerpendicular(this.vectorToEye);
    if (theta.isMagnitudeLessThanOrEqual(this.sideAngle))
      return this.collectOnSideFacets;
    return facetNormal.dotProduct(this.vectorToEye) > 0 ? this.collectOnForwardFacets : this.collectOnRearFacets;
  }
}

/**
 * Options carrier for [[fillSimpleHoles]]
 * @public
 */
export interface HoleFillOptions {
  /** REJECT hole candidates if its boundary chain is longer than this limit. */
  maxPerimeter?: number;
  /** REJECT hole candidates if they have more than this number of edges */
  maxEdgesAroundHole?: number;
  /** REJECT hole candidates if their orientation is not COUNTERCLOCKWISE around this vector.
   * * For instance, use an upward Z vector for a DTM whose facets face upward.  This suppresses incorrectly treating the outer boundary as a hole.
   */
  upVector?: Vector3d;
  /** requests that all content from the original mesh be copied to the mesh with filled holes. */
  includeOriginalMesh?: boolean;
}
/**  Selective output options for PolyfaceQuery.cloneOffset:
*  * undefined means the usual facets in the expected offset mesh.
*  * if present as a json object, the various booleans select respective outputs.
*  * @public
*/
export interface OffsetMeshSelectiveOutputOptions {
  outputOffsetsFromFacesBeforeChamfers?: boolean;
  outputOffsetsFromFaces?: boolean;
  outputOffsetsFromEdges?: boolean;
  outputOffsetsFromVertices?: boolean;
}
/**
 * Options carrier for [[PolyfaceQuery.cloneOffset]].
 * * Default options are strongly recommended.
 * * The option most likely to be changed is chamferTurnAngle
 * @public
 */
export class OffsetMeshOptions {
  /** max angle between normals to be considered smooth */
  public smoothSingleAngleBetweenNormals: Angle;
  /** max accumulation of angle between normals to be considered smooth */
  public smoothAccumulatedAngleBetweenNormals: Angle;
  /** When crossing an edge, this turn angle (typically 120 degrees) triggers a chamfer */
  public chamferAngleBetweenNormals: Angle;
  /** optional control structure for selective output.
   * * If undefined, output all expected offset facets.
   */
  public outputSelector?: OffsetMeshSelectiveOutputOptions;

  /** Constructor -- CAPTURE parameters ... */
  private constructor(
    smoothSingleAngleBetweenNormals: Angle = Angle.createDegrees(25),
    smoothAccumulatedAngleBetweenNormals: Angle = Angle.createDegrees(60),
    chamferTurnAngle: Angle = Angle.createDegrees(90)) {
    this.smoothSingleAngleBetweenNormals = smoothSingleAngleBetweenNormals.clone();
    this.smoothAccumulatedAngleBetweenNormals = smoothAccumulatedAngleBetweenNormals.clone();
    this.chamferAngleBetweenNormals = chamferTurnAngle.clone();
  }
  /** construct and return an OffsetMeshOptions with given parameters.
   * * Angles are forced to minimum values.
   * * Clones of the angles are given to the constructor.
   * @param smoothSingleRadiansBetweenNormals an angle larger than this (between facets) is considered a sharp edge
   * @param smoothAccumulatedAngleBetweenNormals angles that sum to this much may be consolidated for average normal
   * @param chamferTurnAngleBetweenNormals when facets meet with larger angle, a chamfer edge may be added if the angle between facet normals is larger than this.
   */
  public static create(
    smoothSingleAngleBetweenNormals: Angle = Angle.createDegrees(25),
    smoothAccumulatedAngleBetweenNormals: Angle = Angle.createDegrees(60),
    chamferTurnAngleBetweenNormals: Angle = Angle.createDegrees(120)) {

    const mySmoothSingleRadiansBetweenNormals = smoothSingleAngleBetweenNormals.clone();
    const mySmoothAccumulatedRadiansBetweenNormals = smoothAccumulatedAngleBetweenNormals.clone();
    const myChamferTurnAngleBetweenNormals = chamferTurnAngleBetweenNormals.clone();
    if (mySmoothSingleRadiansBetweenNormals.degrees < 1)
      mySmoothAccumulatedRadiansBetweenNormals.setDegrees(1.0);
    if (mySmoothAccumulatedRadiansBetweenNormals.degrees < 1.0)
      mySmoothAccumulatedRadiansBetweenNormals.setDegrees(1.0);
    if (mySmoothAccumulatedRadiansBetweenNormals.degrees < 15.0)
      mySmoothAccumulatedRadiansBetweenNormals.setDegrees(15.0);
    return new OffsetMeshOptions(mySmoothSingleRadiansBetweenNormals, mySmoothAccumulatedRadiansBetweenNormals, myChamferTurnAngleBetweenNormals);
  }
}

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
  /** Return the sum of all facet areas.
   * @param vectorToEye compute sum of *signed* facet areas projected to a view plane perpendicular to this vector
  */
  public static sumFacetAreas(source: Polyface | PolyfaceVisitor | undefined, vectorToEye?: Vector3d): number {
    let s = 0;
    if (source !== undefined) {
      if (source instanceof Polyface)
        return PolyfaceQuery.sumFacetAreas(source.createVisitor(1), vectorToEye);
      let unitVectorToEye: Vector3d | undefined;
      if (vectorToEye !== undefined)
        unitVectorToEye = vectorToEye.normalize();
      source.reset();
      while (source.moveToNextFacet()) {
        const scaledNormal = PolygonOps.areaNormal(source.point.getPoint3dArray());
        s += unitVectorToEye ? scaledNormal.dotProduct(unitVectorToEye) : scaledNormal.magnitude();
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
  /** Determine whether all facets are convex.
   * @param source mesh to examine
   */
  public static areFacetsConvex(source: Polyface | PolyfaceVisitor): boolean {
    if (source instanceof Polyface)
      return this.areFacetsConvex(source.createVisitor(0));
    source.setNumWrap(0);
    source.reset();
    while (source.moveToNextFacet()) {
      if (source.pointCount > 3) {
        if (!PolygonOps.isConvex(source.point))
          return false;
      }
    }
    return true;
  }
  /**
   * Test for convex volume by dihedral angle tests on all edges.
   * * This tests if all dihedral angles are positive.
   * * In a closed solid, this is a strong test for overall convexity.
   * * With `ignoreBoundaries` true, this may be a useful test when all the facets are in a single edge-connected component, such as a pyramid with no underside.
   * * It is not a correct test if there are multiple, disjoint components.
   *   * Take the above-mentioned pyramid with no underside.
   *   * Within the same mesh, have a second pyramid placed to the side, still facing upward.
   *   * The angles will pass the dihedral convexity test, but the composite thing surely is not convex.
   * @param source mesh to examine
   * @param ignoreBoundaries if true, ignore simple boundary edges, i.e. allow unclosed meshes.
   * @returns true if the mesh is closed and has all dihedral angles (angle across edge) positive
   */
  public static isConvexByDihedralAngleCount(source: Polyface, ignoreBoundaries: boolean = false): boolean {
    return this.dihedralAngleSummary(source, ignoreBoundaries) > 0;
  }
  /**
  * Compute a number summarizing the dihedral angles in the mesh.
  * @see [[isConvexByDihedralAngleCount]] for comments about ignoreBoundaries===true when there are multiple connected components.
  * @param source mesh to examine
  * @param ignoreBoundaries if true, ignore simple boundary edges, i.e. allow unclosed meshes.
  * @returns a number summarizing the dihedral angles in the mesh.
  *   * Return 1 if all angles are positive or planar.  The mesh is probably convex with outward normals.
  *   * Return -1 if all angles are negative or planar.  The mesh is probably convex with inward normals.
  *   * Return 0 if
  *     * angles area mixed
  *     * any edge has other than 1 incident facet or more than 2 incident facets.
  *     * (but null edges are permitted -- These occur naturally at edges of quads at north or south pole)
  */
  public static dihedralAngleSummary(source: Polyface, ignoreBoundaries: boolean = false): number {
    const edges = new IndexedEdgeMatcher();
    const visitor = source.createVisitor(1);
    visitor.reset();
    const centroidNormal: Ray3d[] = [];
    let normalCounter = 0;
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount - 1;
      const normal = PolygonOps.centroidAreaNormal(visitor.point);
      if (normal === undefined)
        return 0;
      centroidNormal.push(normal);
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(visitor.clientPointIndex(i), visitor.clientPointIndex(i + 1), normalCounter);
      }
      normalCounter++;
    }
    const badClusters: SortableEdgeCluster[] = [];
    const manifoldClusters: SortableEdgeCluster[] = [];

    edges.sortAndCollectClusters(manifoldClusters,
      ignoreBoundaries ? undefined : badClusters, undefined, badClusters);
    if (badClusters.length > 0)
      return 0;
    let numPositive = 0;
    let numPlanar = 0;
    let numNegative = 0;
    const edgeVector = Vector3d.create();
    for (const cluster of manifoldClusters) {
      const sideA = cluster[0];
      const sideB = cluster[1];
      if (sideA instanceof SortableEdge
        && sideB instanceof SortableEdge
        && source.data.point.vectorIndexIndex(sideA.vertexIndexA, sideA.vertexIndexB, edgeVector)) {
        const dihedralAngle = centroidNormal[sideA.facetIndex].direction.signedAngleTo(
          centroidNormal[sideB.facetIndex].direction, edgeVector);
        if (dihedralAngle.isAlmostZero) numPlanar++;
        else if (dihedralAngle.radians > 0.0) numPositive++;
        else numNegative++;
      }
    }
    if (numPositive > 0 && numNegative === 0)
      return 1;
    if (numNegative > 0 && numPositive === 0)
      return -1;
    // problem case: if all edges have zero dihedral angle, record it as convex.
    if (numPlanar > 0 && numPositive === 0 && numNegative === 0)
      return 1;
    return 0;
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
   * * Any edge with 3 or more incident facets triggers `false` return.
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
   * construct a CurveCollection containing boundary edges.
   *   * each edge is a LineSegment3d
   * @param source polyface or visitor
   * @param includeTypical true to in include typical boundary edges with a single incident facet
   * @param includeMismatch true to include edges with more than 2 incident facets
   * @param includeNull true to include edges with identical start and end vertex indices.
   */
  public static boundaryEdges(source: Polyface | PolyfaceVisitor | undefined,
    includeTypical: boolean = true, includeMismatch: boolean = true, includeNull: boolean = true): CurveCollection | undefined {
    const result = new BagOfCurves();
    const announceEdge = (pointA: Point3d, pointB: Point3d, _indexA: number, _indexB: number, _readIndex: number) => {
      result.tryAddChild(LineSegment3d.create(pointA, pointB));
    };
    PolyfaceQuery.announceBoundaryEdges(source, announceEdge, includeTypical, includeMismatch, includeNull);
    if (result.children.length === 0)
      return undefined;
    return result;
  }
  /**
   * Collect boundary edges.
   * * Return the edges as the simplest collection of chains of line segments.
   * @param source facets
   * @param includeTypical true to in include typical boundary edges with a single incident facet
   * @param includeMismatch true to include edges with more than 2 incident facets
   * @param includeNull true to include edges with identical start and end vertex indices.
   */
  public static collectBoundaryEdges(source: Polyface | PolyfaceVisitor, includeTypical: boolean = true, includeMismatch: boolean = true, includeNull: boolean = true): AnyChain | undefined {
    const collector = new MultiChainCollector(Geometry.smallMetricDistance, Geometry.smallMetricDistance);
    PolyfaceQuery.announceBoundaryEdges(source, (ptA: Point3d, ptB: Point3d) => collector.captureCurve(LineSegment3d.create(ptA, ptB)), includeTypical, includeMismatch, includeNull);
    return collector.grabResult(true);
  }
  /**
   * Test if the facets in `source` occur in perfectly mated pairs, as is required for a closed manifold volume.
   * If not, extract the boundary edges as lines.
   * @param source polyface or visitor
   * @param announceEdge function to be called with each boundary edge. The announcement is start and end points, start and end indices, and facet index.
   * @param includeTypical true to announce typical boundary edges with a single incident facet
   * @param includeMismatch true to announce edges with more than 2 incident facets
   * @param includeNull true to announce edges with identical start and end vertex indices.
   */
  public static announceBoundaryEdges(source: Polyface | PolyfaceVisitor | undefined,
    announceEdge: (pointA: Point3d, pointB: Point3d, indexA: number, indexB: number, facetIndex: number) => void,
    includeTypical: boolean = true, includeMismatch: boolean = true, includeNull: boolean = true): void {
    if (source === undefined)
      return undefined;
    const edges = new IndexedEdgeMatcher();
    const visitor = source instanceof Polyface ? source.createVisitor(1) : source;
    visitor.setNumWrap(1);
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
    if (includeTypical && bad1.length > 0)
      badList.push(bad1);
    if (includeMismatch && bad2.length > 0)
      badList.push(bad2);
    if (includeNull && bad0.length > 0)
      badList.push(bad0);
    if (badList.length === 0)
      return undefined;
    const sourcePolyface = visitor.clientPolyface()!;
    const pointA = Point3d.create();
    const pointB = Point3d.create();
    for (const list of badList) {
      for (const e of list) {
        const e1 = e instanceof SortableEdge ? e : e[0];
        const indexA = e1.vertexIndexA;
        const indexB = e1.vertexIndexB;
        if (sourcePolyface.data.getPoint(indexA, pointA) && sourcePolyface.data.getPoint(indexB, pointB))
          announceEdge(pointA, pointB, indexA, indexB, e1.facetIndex);
      }
    }
  }
  /**
   * Invoke the callback on each manifold edge whose adjacent facet normals form vectorToEye dot products with opposite sign.
   * * The callback is not called on boundary edges.
   * @param source facets
   * @param announce callback function invoked on manifold silhouette edges
   * @param vectorToEye normal of plane in which to compute silhouette edges
   * @param sideAngle angular tolerance for perpendicularity test
   */
  public static announceSilhouetteEdges(
    source: Polyface | PolyfaceVisitor,
    announce: (pointA: Point3d, pointB: Point3d, vertexIndexA: number, vertexIndexB: number, facetIndex: number) => void,
    vectorToEye: Vector3d,
    sideAngle: Angle = Angle.createSmallAngle(),
  ): void {
    if (source instanceof Polyface)
      return this.announceSilhouetteEdges(source.createVisitor(1), announce, vectorToEye, sideAngle);
    const mesh = source.clientPolyface();
    if (undefined === mesh)
      return;
    source.setNumWrap(1);
    const allEdges = this.createIndexedEdges(source);
    const manifoldEdges: SortableEdgeCluster[] = [];
    allEdges.sortAndCollectClusters(manifoldEdges);

    const sideAngleTol = sideAngle.radians < 0.0 ? -sideAngle.radians : sideAngle.radians;
    const pointA = Point3d.create();
    const pointB = Point3d.create();
    const normal = Vector3d.create();
    const analyzeFace = (iFacet: number): { isSideFace: boolean, perpAngle: number } => {
      if (!PolyfaceQuery.computeFacetUnitNormal(source, iFacet, normal))
        return { isSideFace: false, perpAngle: 0.0 };
      const perpAngle = normal.radiansFromPerpendicular(vectorToEye);
      const isSideFace = Math.abs(perpAngle) <= sideAngleTol;
      return { isSideFace, perpAngle };
    };

    for (const pair of manifoldEdges) {
      if (!Array.isArray(pair) || pair.length !== 2)
        continue;
      const indexA = pair[0].vertexIndexA;
      const indexB = pair[0].vertexIndexB;
      if (!mesh.data.getPoint(indexA, pointA) || !mesh.data.getPoint(indexB, pointB))
        continue;
      const face0 = analyzeFace(pair[0].facetIndex);
      if (face0.isSideFace) {
        announce(pointA, pointB, indexA, indexB, pair[0].facetIndex);
        continue;
      }
      const face1 = analyzeFace(pair[1].facetIndex);
      if (face1.isSideFace) {
        announce(pointB, pointA, indexB, indexA, pair[1].facetIndex);
        continue;
      }
      if (face0.perpAngle * face1.perpAngle < 0.0) {  // normals straddle plane
        announce(pointA, pointB, indexA, indexB, pair[0].facetIndex);
        continue;
      }
    }
  }
  /**
   * Collect manifold edges whose adjacent facet normals form vectorToEye dot products with opposite sign.
   * * Does not return boundary edges.
   * * Return the edges as chains of line segments.
   * @param source facets
   * @param vectorToEye normal of plane in which to compute silhouette edges
   * @param sideAngle angular tolerance for perpendicularity test
   */
  public static collectSilhouetteEdges(source: Polyface | PolyfaceVisitor, vectorToEye: Vector3d, sideAngle: Angle = Angle.createSmallAngle()): AnyChain | undefined {
    const collector = new MultiChainCollector(Geometry.smallMetricDistance, Geometry.smallMetricDistance);
    PolyfaceQuery.announceSilhouetteEdges(source, (ptA: Point3d, ptB: Point3d) => collector.captureCurve(LineSegment3d.create(ptA, ptB)), vectorToEye, sideAngle);
    return collector.grabResult(true);
  }

  /** Find segments (within the linestring) which project to facets.
   * * Announce each pair of linestring segment and on-facet segment through a callback.
   * * Facets are ASSUMED to be convex and planar, and not overlap in the z direction.
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
  private static async continueAnnounceSweepLinestringToConvexPolyfaceXY(
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
   * * Facets are ASSUMED to be convex and planar, and not overlap in the z direction.
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
      while (0 < (workCount = await Promise.resolve(PolyfaceQuery.continueAnnounceSweepLinestringToConvexPolyfaceXY(context, visitor, announce)))) {
        workTotal += workCount;
        this.awaitBlockCount++;
        // GeometryCoreTestIO.consoleLog({ myWorkCount: workCount, myBlockCount: this.awaitBlockCount });
      }
    }
    // GeometryCoreTestIO.consoleLog({ myWorkTotal: workTotal, myBlockCount: this.awaitBlockCount });
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
  /**
   * Search for edges with only 1 incident facet.
   * * chain them into loops
   * * emit the loops to the announceLoop function
   * @param mesh
   */
  public static announceBoundaryChainsAsLineString3d(mesh: Polyface | PolyfaceVisitor,
    announceLoop: (points: LineString3d) => void) {
    const collector = new MultiChainCollector(Geometry.smallMetricDistance, 1000);
    PolyfaceQuery.announceBoundaryEdges(mesh,
      (pointA: Point3d, pointB: Point3d, _indexA: number, _indexB: number) => collector.captureCurve(LineSegment3d.create(pointA, pointB)),
      true, false, false);
    collector.announceChainsAsLineString3d(announceLoop);
  }

  /**
   * Return a mesh with
   *  * clusters of adjacent, coplanar facets merged into larger facets.
   *  * other facets included unchanged.
   * @param mesh existing mesh or visitor
   * @param maxSmoothEdgeAngle maximum dihedral angle across an edge between facets deemed coplanar. If undefined, uses `Geometry.smallAngleRadians`.
   * @returns
   */
  public static cloneWithMaximalPlanarFacets(mesh: Polyface | PolyfaceVisitor, maxSmoothEdgeAngle?: Angle): IndexedPolyface | undefined {
    if (mesh instanceof Polyface)
      return this.cloneWithMaximalPlanarFacets(mesh.createVisitor(0), maxSmoothEdgeAngle);
    const numFacets = PolyfaceQuery.visitorClientFacetCount(mesh);
    const smoothEdges = PolyfaceQuery.collectEdgesByDihedralAngle(mesh, maxSmoothEdgeAngle);
    const partitions = PolyfaceQuery.partitionFacetIndicesBySortableEdgeClusters(smoothEdges, numFacets);
    const builder = PolyfaceBuilder.create();
    const visitor = mesh;
    const planarPartitions: number[][] = [];
    for (const partition of partitions) {
      if (partition.length === 1) {
        if (visitor.moveToReadIndex(partition[0]))
          builder.addFacetFromVisitor(visitor);
      } else {
        // This is a non-trivial set of contiguous coplanar facets
        planarPartitions.push(partition);
      }
    }
    const fragmentPolyfaces = PolyfaceQuery.clonePartitions(mesh, planarPartitions);
    const gapTolerance = 1.0e-4;
    const planarityTolerance = 1.0e-4;
    for (const fragment of fragmentPolyfaces) {
      const edges: LineSegment3d[] = [];
      const edgeStrings: Point3d[][] = [];
      PolyfaceQuery.announceBoundaryEdges(fragment,
        (pointA: Point3d, pointB: Point3d, _indexA: number, _indexB: number) => {
          edges.push(LineSegment3d.create(pointA, pointB));
          edgeStrings.push([pointA.clone(), pointB.clone()]);
        });
      const chains = CurveOps.collectChains(edges, gapTolerance, planarityTolerance);
      if (chains) {
        const frameBuilder = new FrameBuilder();
        frameBuilder.announce(chains);
        const frame = frameBuilder.getValidatedFrame(false);
        if (frame !== undefined) {
          const inverseFrame = frame.inverse();
          if (inverseFrame !== undefined) {
            inverseFrame.multiplyPoint3dArrayArrayInPlace(edgeStrings);
            const graph = HalfEdgeGraphMerge.formGraphFromChains(edgeStrings, true, HalfEdgeMask.BOUNDARY_EDGE);
            if (graph) {
              HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(graph,
                new HalfEdgeMaskTester(HalfEdgeMask.BOUNDARY_EDGE), HalfEdgeMask.EXTERIOR);
              // this.purgeNullFaces(HalfEdgeMask.EXTERIOR);
              const polyface1 = PolyfaceBuilder.graphToPolyface(graph);
              builder.addIndexedPolyface(polyface1, false, frame);
            }
          }
        }
      }
    }
    return builder.claimPolyface(true);
  }

  /**
   * Return a mesh with "some" holes filled in with new facets.
   *  * Candidate chains are computed by [[announceBoundaryChainsAsLineString3d]].
   *  * Unclosed chains are rejected.
   *  * Closed chains are triangulated and returned as a mesh.
   *  * The options structure enforces restrictions on how complicated the hole filling can be:
   *     * maxEdgesAroundHole -- holes with more edges are skipped
   *     * maxPerimeter -- holes with larger summed edge lengths are skipped.
   *     * upVector -- holes that do not have positive area along this view are skipped.
   *     * includeOriginalMesh -- includes the original mesh in the output mesh, so the composite mesh is a clone with holes filled
   * @param mesh existing mesh
   * @param options options controlling the hole fill.
   * @param unfilledChains optional array to receive the points around holes that were not filled.
   * @returns
   */
  public static fillSimpleHoles(mesh: Polyface | PolyfaceVisitor, options: HoleFillOptions, unfilledChains?: LineString3d[]): IndexedPolyface | undefined {
    if (mesh instanceof Polyface)
      return this.fillSimpleHoles(mesh.createVisitor(0), options, unfilledChains);
    const builder = PolyfaceBuilder.create();
    const chains: LineString3d[] = [];
    PolyfaceQuery.announceBoundaryChainsAsLineString3d(mesh,
      (ls: LineString3d) => { ls.reverseInPlace(); chains.push(ls); });

    for (const c of chains) {
      const points = c.points;
      let rejected = false;
      if (!c.isPhysicallyClosed)
        rejected = true;
      else if (options.maxEdgesAroundHole !== undefined && points.length > options.maxEdgesAroundHole)
        rejected = true;
      else if (options.maxPerimeter !== undefined && Point3dArray.sumEdgeLengths(points, false) > options.maxPerimeter)
        rejected = true;
      else if (options.upVector !== undefined && PolygonOps.sumTriangleAreasPerpendicularToUpVector(points, options.upVector) <= 0.0)
        rejected = true;

      if (!rejected && SpacePolygonTriangulation.triangulateSimplestSpaceLoop(points,
        (_loop: Point3d[], triangles: Point3d[][]) => {
          for (const t of triangles)
            builder.addPolygon(t);
        },
      )) {
      } else {
        rejected = true;
      }
      if (rejected && unfilledChains !== undefined)
        unfilledChains.push(c);    // yes, capture it -- this scope owns the chains and has no further use for it.
    }
    if (options.includeOriginalMesh !== undefined && options.includeOriginalMesh) {
      for (mesh.reset(); mesh.moveToNextFacet();)
        builder.addFacetFromVisitor(mesh);
    }

    return builder.claimPolyface(true);
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
  /** Clone facets that pass a filter function */
  public static cloneFiltered(source: Polyface | PolyfaceVisitor, filter: (visitor: PolyfaceVisitor) => boolean): IndexedPolyface {
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
    for (; source.moveToNextFacet();) {
      if (filter(source))
        builder.addFacetFromVisitor(source);
    }
    return builder.claimPolyface(true);
  }
  /** Clone the facets with in-facet dangling edges removed. */
  public static cloneWithDanglingEdgesRemoved(source: Polyface | PolyfaceVisitor): IndexedPolyface {
    if (source instanceof Polyface)
      return this.cloneWithDanglingEdgesRemoved(source.createVisitor(0));

    const options = StrokeOptions.createForFacets();
    options.needNormals = source.normal !== undefined;
    options.needParams = source.param !== undefined;
    options.needColors = source.color !== undefined;
    options.needTwoSided = source.twoSided;
    const builder = PolyfaceBuilder.create(options);

    // Finds an odd palindrome in data as indexed by indices.
    // An odd palindrome in a face loop corresponds to dangling edges in the face.
    // If one is found, indices is mutated to excise the palindrome (data is untouched).
    // @returns whether indices array was mutated
    const removeFirstOddPalindrome = (indices: number[], data: number[]): boolean => {
      const n = indices.length;
      for (let i = 0; i < n; ++i) {
        let palLength = 1;
        let i0 = i; // look for odd palindrome centered at i
        let i1 = i; // and with extents i0..i1
        while (palLength + 2 <= n) {
          const iPrev = (i0 === 0) ? n - 1 : i0 - 1;
          const iNext = (i1 === n - 1) ? 0 : i1 + 1;
          if (data[indices[iPrev]] !== data[indices[iNext]])
            break;  // the maximal odd palindrome centered at i has length palLength and spans [i0,i1]
          i0 = iPrev;
          i1 = iNext;
          palLength += 2;
        }
        if (palLength > 1) { // excise the palindrome (but keep i1)
          if (i0 < i1) {
            indices.splice(i0, palLength - 1);  // remove entries [i0,i1)
          } else if (i0 > i1) {
            indices.splice(i0);     // remove entries [i0,n)
            indices.splice(0, i1);  // remove entries [0,i1)
          }
          return true;
        }
      }
      return false;
    };

    source.setNumWrap(0);
    source.reset();
    while (source.moveToNextFacet()) {
      const localIndices = [...Array(source.pointIndex.length).keys()]; // 0, 1, ... n-1;
      while (removeFirstOddPalindrome(localIndices, source.pointIndex)) { }
      builder.addFacetFromIndexedVisitor(source, localIndices);
    }
    return builder.claimPolyface(true);
  }
  /** If the visitor's client is a polyface, simply return its point array length.
   * If not a polyface, visit all facets to find the largest index.
   */
  public static visitorClientPointCount(visitor: Polyface | PolyfaceVisitor): number {
    if (visitor instanceof Polyface)
      return visitor.data.point.length;
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
  /** If the visitor's client is a polyface, simply return its facet count.
   * If not a polyface, visit all facets to accumulate a count.
   */
  public static visitorClientFacetCount(visitor: Polyface | PolyfaceVisitor): number {
    if (visitor instanceof Polyface) {
      if (visitor.facetCount !== undefined)
        return visitor.facetCount;
      visitor = visitor.createVisitor(0);
    }
    const polyface = visitor.clientPolyface();
    if (polyface !== undefined && polyface.facetCount !== undefined)
      return polyface.facetCount;
    let facetCount = 0;
    visitor.reset();
    while (visitor.moveToNextFacet())
      ++facetCount;
    return facetCount;
  }
  /** Partition the facet set into connected components such that two adjacent facets are in the same component if and only if they are adjacent across a clustered edge.
   * @param edgeClusters sorted and clustered edges (cf. `IndexedEdgeMatcher.sortAndCollectClusters`).
   * @param numFacets facet count in the parent mesh. In particular, `edge.facetIndex < numFacets` for every input edge.
   * @return collection of facet index arrays, one array per connected component
   */
  private static partitionFacetIndicesBySortableEdgeClusters(edgeClusters: SortableEdgeCluster[], numFacets: number): number[][] {
    const context = new UnionFindContext(numFacets);
    for (const cluster of edgeClusters) {
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
  /** Partition the facet set into connected components. Each facet in a given component shares an edge only with other facets in the component (or is a boundary edge).
   * @param polyface facets to partition
   * @param stopAtVisibleEdges whether to further split connected components by visible edges of the polyface
   * @return collection of facet index arrays, one per connected component
   */
  public static partitionFacetIndicesByEdgeConnectedComponent(polyface: Polyface | PolyfaceVisitor, stopAtVisibleEdges: boolean = false): number[][] {
    if (polyface instanceof Polyface) {
      return this.partitionFacetIndicesByEdgeConnectedComponent(polyface.createVisitor(0), stopAtVisibleEdges);
    }
    polyface.setNumWrap(1);
    const matcher = new IndexedEdgeMatcher();
    polyface.reset();
    let numFacets = 0;
    while (polyface.moveToNextFacet()) {
      const numEdges = polyface.pointCount - 1;
      numFacets++;
      for (let i = 0; i < numEdges; i++) {
        if (stopAtVisibleEdges && polyface.edgeVisible[i]) {

        } else {
          matcher.addEdge(polyface.clientPointIndex(i), polyface.clientPointIndex(i + 1), polyface.currentReadIndex());
        }
      }
    }
    const allEdges: SortableEdgeCluster[] = [];
    matcher.sortAndCollectClusters(allEdges, allEdges, allEdges, allEdges);
    return this.partitionFacetIndicesBySortableEdgeClusters(allEdges, numFacets);
  }
  /** Find segments (within the line string) which project to facets.
   * * Assemble each input segment paired with its projected segment/point as a quad/triangle facet in a new polyface.
   * * Input facets are ASSUMED to be convex and planar, and not overlap in the z direction.
   */
  public static sweepLineStringToFacetsXYReturnSweptFacets(lineStringPoints: GrowableXYZArray, polyface: Polyface): Polyface {
    const builder = PolyfaceBuilder.create();
    this.announceSweepLinestringToConvexPolyfaceXY(lineStringPoints, polyface,
      (_linestring: GrowableXYZArray, _segmentIndex: number,
        _polyface: Polyface, _facetIndex: number, points: Point3d[]) => {
        if (points.length === 4)
          builder.addQuadFacet(points);
        else if (points.length === 3)
          builder.addTriangleFacet(points);

      });
    return builder.claimPolyface(true);
  }
  /** @deprecated in 4.x. Use sweepLineStringToFacetsXYReturnSweptFacets instead. */
  public static sweepLinestringToFacetsXYreturnSweptFacets(linestringPoints: GrowableXYZArray, polyface: Polyface): Polyface {
    return this.sweepLineStringToFacetsXYReturnSweptFacets(linestringPoints, polyface);
  }

  /**
   * Sweep the line string to intersections with a mesh.
   * * Return collected line segments.
   * * If no options are given, the default sweep direction is the z-axis, and chains are assembled and returned.
   * * See [[SweepLineStringToFacetsOptions]] for input and output options, including filtering by forward/side/rear facets.
   * * Facets are ASSUMED to be convex and planar, and not overlap in the sweep direction.
   */
  public static sweepLineStringToFacets(linestringPoints: GrowableXYZArray, polyfaceOrVisitor: Polyface | PolyfaceVisitor, options?: SweepLineStringToFacetsOptions): LinearCurvePrimitive[] {
    let result: LinearCurvePrimitive[] = [];
    // setup default options:
    if (options === undefined)
      options = SweepLineStringToFacetsOptions.create(
        Vector3d.unitZ(),
        Angle.createRadians(Geometry.smallAngleRadians),   // tight geometry tolerance for vertical side facets
        true,   // assemble chains
        true, true, true); // accept all outputs
    let chainContext: ChainMergeContext | undefined;
    if (options.assembleChains)
      chainContext = ChainMergeContext.create();
    const context = ClipSweptLineStringContext.create(linestringPoints, options.vectorToEye);
    if (context) {
      let visitor: PolyfaceVisitor;
      if (polyfaceOrVisitor instanceof Polyface)
        visitor = polyfaceOrVisitor.createVisitor(0);
      else
        visitor = polyfaceOrVisitor;
      const workNormal = Vector3d.createZero();
      for (visitor.reset(); visitor.moveToNextFacet();) {
        if (options.collectFromThisFacetNormal(PolygonOps.areaNormalGo(visitor.point, workNormal))) {
          context.processPolygon(visitor.point.getArray(),
            (pointA: Point3d, pointB: Point3d) => {
              if (chainContext !== undefined)
                chainContext.addSegment(pointA, pointB);
              else
                result.push(LineSegment3d.create(pointA, pointB));
            });
        }
      }
      if (chainContext !== undefined) {
        chainContext.clusterAndMergeVerticesXYZ();
        result = chainContext.collectMaximalChains();
      }
    }
    return result;
  }
  /**
   * Sweep the line string in the z-direction to intersections with a mesh, using a search object for speedup.
   * @param lineStringPoints input line string to drape on the mesh
   * @param polyfaceOrVisitor mesh, or mesh visitor to traverse only part of a mesh
   * @param searchByReadIndex object for searching facet 2D ranges tagged by mesh read index
   * @example Using a 5x5 indexed search grid:
   * ```
   * const xyRange = Range2d.createFrom(myPolyface.range());
   * const searcher = GriddedRaggedRange2dSetWithOverflow.create<number>(xyRange, 5, 5)!;
   * for (const visitor = myPolyface.createVisitor(0); visitor.moveToNextFacet();) {
   *   searcher.addRange(visitor.point.getRange(), visitor.currentReadIndex());
   * }
   * const drapedLineStrings = PolyfaceQuery.sweepLineStringToFacetsXY(lineString, myPolyface, searcher);
   * ```
   * @returns collected line strings
   */
  public static sweepLineStringToFacetsXY(
    lineStringPoints: GrowableXYZArray | Point3d[],
    polyfaceOrVisitor: Polyface | PolyfaceVisitor,
    searchByReadIndex: Range2dSearchInterface<number>): LineString3d[] {
    const chainContext = ChainMergeContext.create();
    const sweepVector = Vector3d.create(0, 0, 1);
    const searchRange = Range3d.create();
    let visitor: PolyfaceVisitor;
    if (polyfaceOrVisitor instanceof Polyface)
      visitor = polyfaceOrVisitor.createVisitor(0);
    else
      visitor = polyfaceOrVisitor;
    let lineStringSource: IndexedXYZCollection;
    if (Array.isArray(lineStringPoints))
      lineStringSource = new Point3dArrayCarrier(lineStringPoints);
    else
      lineStringSource = lineStringPoints;
    for (let i = 1; i < lineStringSource.length; i++) {
      const point0 = lineStringSource.getPoint3dAtUncheckedPointIndex(i - 1);
      const point1 = lineStringSource.getPoint3dAtUncheckedPointIndex(i);
      const edgeClipper = EdgeClipData.createPointPointSweep(point0, point1, sweepVector);
      if (edgeClipper !== undefined) {
        Range3d.createNull(searchRange);
        searchRange.extendPoint(point0);
        searchRange.extendPoint(point1);
        searchByReadIndex.searchRange2d(searchRange,
          (_facetRange, readIndex) => {
            if (visitor.moveToReadIndex(readIndex))
              edgeClipper.processPolygon(visitor.point, (pointA, pointB) => chainContext.addSegment(pointA, pointB));
            return true;
          });
      }
    }
    chainContext.clusterAndMergeVerticesXYZ();
    return chainContext.collectMaximalChains();
  }

  /** Find segments (within the linestring) which project to facets.
    * * Return collected line segments.
    * * This calls [[sweepLineStringToFacets]] with options created by
    *   `const options = SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), Angle.createSmallAngle(),false, true, true, true);`
    * @deprecated in 4.x. Use [[sweepLineStringToFacets]] to get further options.
    */
  public static sweepLinestringToFacetsXYReturnLines(linestringPoints: GrowableXYZArray, polyface: Polyface): LineSegment3d[] {
    const options = SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), Angle.createSmallAngle(),
      false, true, true, true);
    const result = PolyfaceQuery.sweepLineStringToFacets(linestringPoints, polyface, options);
    return result as LineSegment3d[];
  }

  /** Find segments (within the linestring) which project to facets.
   * * Return chains.
   * * This calls [[sweepLineStringToFacets]] with options created by
   *   `const options = SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), Angle.createSmallAngle(),true, true, true, true);`
   * @deprecated in 4.x. Use [[sweepLineStringToFacets]] to get further options.
   */
  public static sweepLinestringToFacetsXYReturnChains(linestringPoints: GrowableXYZArray, polyface: Polyface): LineString3d[] {
    const options = SweepLineStringToFacetsOptions.create(Vector3d.unitZ(), Angle.createSmallAngle(),
      true, true, true, true);
    const result = PolyfaceQuery.sweepLineStringToFacets(linestringPoints, polyface, options);
    return result as LineString3d[];
  }

  /** Find segments (within the linestring) which project to facets.
   * * This is done as a sequence of "await" steps.
   * * Each "await" step deals with approximately PolyfaceQuery.asyncWorkLimit pairings of (linestring edge) with (facet edge)
   * * PolyfaceQuery.setAsyncWorkLimit() to change work blocks from default
   * * Return chains.
   * * Facets are ASSUMED to be convex and planar, and not overlap in the z direction.
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
        edgeRange.ensureMinLengths(Geometry.smallMetricDistance); // add some slop in case segment is axis-aligned
        rangeSearcher.announcePointsInRange(edgeRange, (index: number, _x: number, _y: number, _z: number) => {
          // x,y,z has x,y within the range of the search ... test for exact on (in full 3d!)
          polyface.data.point.getPoint3dAtUncheckedPointIndex(index, spacePoint);
          const detail = segment.closestPoint(spacePoint, false);
          if (undefined !== detail) {
            if (detail.fraction > 0.0 && detail.fraction < 1.0 && !detail.point.isAlmostEqual(point0) && !detail.point.isAlmostEqual(point1)
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
      builder.addFacetFromGrowableArrays(newFacetVisitor.point, newFacetVisitor.normal, newFacetVisitor.param, newFacetVisitor.color, newFacetVisitor.edgeVisible);
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
    facetIndexAndVertexIndices.sort((arrayA, arrayB) => this.compareFacetIndexAndVertexIndices(arrayA, arrayB));
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
        builder.addFacetFromGrowableArrays(newFacetVisitor.point, newFacetVisitor.normal, newFacetVisitor.param, newFacetVisitor.color, newFacetVisitor.edgeVisible);
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
   * @param vertexIndex vertex index (in vertex array) at which the edge starts
   * @param value visibility value.
   */
  public static setSingleEdgeVisibility(polyface: IndexedPolyface, facetIndex: number, vertexIndex: number, value: boolean) {
    const data = polyface.data;
    const index0 = polyface.facetIndex0(facetIndex);
    const index1 = polyface.facetIndex1(facetIndex);
    for (let i = index0; i < index1; i++)
      if (data.pointIndex[i] === vertexIndex)
        data.edgeVisible[i] = value;  // actually sets visibility on all edges in the face that start at this vertex
  }
  /**
   * Get the visibility of a particular edge of a particular facet.
   * @param polyface containing polyface
   * @param facetIndex facet index
   * @param vertexIndex vertex index (in vertex array) at which the edge starts
   */
  public static getSingleEdgeVisibility(polyface: IndexedPolyface, facetIndex: number, vertexIndex: number): boolean | undefined {
    const data = polyface.data;
    const index0 = polyface.facetIndex0(facetIndex);
    const index1 = polyface.facetIndex1(facetIndex);
    for (let i = index0; i < index1; i++)
      if (data.pointIndex[i] === vertexIndex)
        return data.edgeVisible[i]; // return visibility of first edge in the face that starts at this vertex
    return undefined;
  }
  /** Load all half edges from a mesh to an IndexedEdgeMatcher.
   * @param polyface a mesh, or a visitor assumed to have numWrap === 1
  */
  public static createIndexedEdges(polyface: Polyface | PolyfaceVisitor): IndexedEdgeMatcher {
    if (polyface instanceof Polyface)
      return this.createIndexedEdges(polyface.createVisitor(1));
    const edges = new IndexedEdgeMatcher();
    polyface.reset();
    while (polyface.moveToNextFacet()) {
      const numEdges = polyface.pointCount - 1;
      for (let i = 0; i < numEdges; i++) {
        edges.addEdge(polyface.clientPointIndex(i), polyface.clientPointIndex(i + 1), polyface.currentReadIndex());
      }
    }
    return edges;
  }
  /**
   * Return manifold edge pairs whose dihedral angle is bounded by the given angle.
   * * The dihedral angle of a manifold edge is measured between the normals of its two adjacent faces.
   * * Boundary edges are not returned as they are not manifold.
   * @param mesh existing polyface or visitor
   * @param maxSmoothEdgeAngle maximum dihedral angle of a smooth edge. If undefined, uses `Geometry.smallAngleRadians`.
   * @param sharpEdges true to reverse the angle threshold test and return sharp edges; otherwise return smooth edges (default)
   */
  public static collectEdgesByDihedralAngle(mesh: Polyface | PolyfaceVisitor, maxSmoothEdgeAngle?: Angle, sharpEdges: boolean = false): SortableEdgeCluster[] {
    if (mesh instanceof Polyface)
      return this.collectEdgesByDihedralAngle(mesh.createVisitor(1), maxSmoothEdgeAngle, sharpEdges);
    mesh.setNumWrap(1);
    const allEdges = this.createIndexedEdges(mesh);
    const manifoldEdges: SortableEdgeCluster[] = [];
    allEdges.sortAndCollectClusters(manifoldEdges);
    if (undefined === maxSmoothEdgeAngle || maxSmoothEdgeAngle.radians < 0)
      maxSmoothEdgeAngle = Angle.createRadians(Geometry.smallAngleRadians);
    const outEdges: SortableEdgeCluster[] = [];
    const normal0 = Vector3d.create();
    const normal1 = Vector3d.create();
    for (const pair of manifoldEdges) {
      if (Array.isArray(pair) && pair.length === 2) {
        const e0 = pair[0];
        const e1 = pair[1];
        if (undefined !== PolyfaceQuery.computeFacetUnitNormal(mesh, e0.facetIndex, normal0)
          && undefined !== PolyfaceQuery.computeFacetUnitNormal(mesh, e1.facetIndex, normal1)) {
          const edgeAngle = normal0.smallerUnorientedAngleTo(normal1);
          if (sharpEdges) {
            if (edgeAngle.radians > maxSmoothEdgeAngle.radians)
              outEdges.push(pair);
          } else {
            if (edgeAngle.radians <= maxSmoothEdgeAngle.radians)
              outEdges.push(pair);
          }
        }
      }
    }
    return outEdges;
  }

  /**
  * * Find mated pairs among facet edges.
  * * Mated pairs have the same vertex indices appearing in opposite order.
  * * Mark all non-mated pairs visible.
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
   * Create a HalfEdgeGraph with a face for each facet of the IndexedPolyface
   * @param mesh mesh to convert
   * @internal
   */
  public static convertToHalfEdgeGraph(mesh: IndexedPolyface) {
    const builder = new HalfEdgeGraphFromIndexedLoopsContext();
    const visitor = mesh.createVisitor(0);
    for (visitor.reset(); visitor.moveToNextFacet();) {
      builder.insertLoop(visitor.pointIndex);
    }
    const graph = builder.graph;
    const xyz = Point3d.create();
    graph.announceNodes((_graph: HalfEdgeGraph, halfEdge: HalfEdge) => {
      const vertexIndex = halfEdge.i;
      mesh.data.getPoint(vertexIndex, xyz);
      halfEdge.setXYZ(xyz);
      return true;
    },
    );
    return graph;
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
  * * One can imagine a vertex with multiple "smooth cone-like" sets of incident facets such that averaging occurs among two nonadjacent cones.  But this does not seem to be a problem in practice.
  * @param polyface polyface to update.
  * @param toleranceAngle averaging is done between normals up to this angle.
  */
  public static buildAverageNormals(polyface: IndexedPolyface, toleranceAngle: Angle = Angle.createDegrees(31.0)) {
    BuildAverageNormalsContext.buildFastAverageNormals(polyface, toleranceAngle);
  }

  /**
   * Offset the faces of the mesh.
   * @param source original mesh
   * @param signedOffsetDistance distance to offset
   * @param offsetOptions angle options.  The default options are recommended.
   * @returns shifted mesh.
   */
  public static cloneOffset(source: IndexedPolyface,
    signedOffsetDistance: number,
    offsetOptions: OffsetMeshOptions = OffsetMeshOptions.create()): IndexedPolyface {
    const strokeOptions = StrokeOptions.createForFacets();
    const offsetBuilder = PolyfaceBuilder.create(strokeOptions);
    OffsetMeshContext.buildOffsetMeshWithEdgeChamfers(source, offsetBuilder, signedOffsetDistance, offsetOptions);
    return offsetBuilder.claimPolyface();
  }

  private static _workTriangle?: BarycentricTriangle;
  private static _workTriDetail?: TriangleLocationDetail;
  private static _workPolyDetail?: PolygonLocationDetail;
  private static _workFacetDetail3?: TriangularFacetLocationDetail;
  private static _workFacetDetailC?: ConvexFacetLocationDetail;
  private static _workFacetDetailNC?: NonConvexFacetLocationDetail;

  /** Search facets for the first one that intersects the infinite line.
   * * To process _all_ intersections, callers can supply an `options.acceptIntersection` callback that always returns false.
   * In this case, `intersectRay3d` will return undefined, but the callback will be invoked for each intersection.
   * * Example callback logic:
   *    * Accept the first found facet that intersects the half-line specified by the ray: `return detail.a >= 0.0;`
   *    * Collect all intersections: `myIntersections.push(detail.clone()); return false;` Then after `intersectRay3d` returns, sort along `ray` with `myIntersections.sort((d0, d1) => d0.a - d1.a);`
   * @param visitor facet iterator
   * @param ray infinite line parameterized as a ray. The returned `detail.a` is the intersection parameter on the ray, e.g., zero at `ray.origin` and increasing in `ray.direction`.
   * @param options options for computing and populating an intersection detail, and an optional callback for accepting one
   * @return detail for the (accepted) intersection with `detail.IsInsideOrOn === true`, or `undefined` if no (accepted) intersection
   * @see PolygonOps.intersectRay3d
  */
  public static intersectRay3d(visitor: Polyface | PolyfaceVisitor, ray: Ray3d, options?: FacetIntersectOptions): FacetLocationDetail | undefined {
    if (visitor instanceof Polyface)
      return PolyfaceQuery.intersectRay3d(visitor.createVisitor(0), ray, options);
    let detail: FacetLocationDetail;
    visitor.setNumWrap(0);
    while (visitor.moveToNextFacet()) {
      const numEdges = visitor.pointCount;  // #vertices = #edges since numWrap is zero
      const vertices = visitor.point;
      if (3 === numEdges) {
        const tri = this._workTriangle = BarycentricTriangle.create(vertices.getPoint3dAtUncheckedPointIndex(0), vertices.getPoint3dAtUncheckedPointIndex(1), vertices.getPoint3dAtUncheckedPointIndex(2), this._workTriangle);
        const detail3 = this._workTriDetail = tri.intersectRay3d(ray, this._workTriDetail);
        tri.snapLocationToEdge(detail3, options?.distanceTolerance, options?.parameterTolerance);
        detail = this._workFacetDetail3 = TriangularFacetLocationDetail.create(visitor.currentReadIndex(), detail3, this._workFacetDetail3);
      } else {
        const detailN = this._workPolyDetail = PolygonOps.intersectRay3d(vertices, ray, options?.distanceTolerance, this._workPolyDetail);
        if (PolygonOps.isConvex(vertices))
          detail = this._workFacetDetailC = ConvexFacetLocationDetail.create(visitor.currentReadIndex(), numEdges, detailN, this._workFacetDetailC);
        else
          detail = this._workFacetDetailNC = NonConvexFacetLocationDetail.create(visitor.currentReadIndex(), numEdges, detailN, this._workFacetDetailNC);
      }
      if (detail.isInsideOrOn) {  // set optional caches, process the intersection
        if (options?.needNormal && visitor.normal)
          detail.getNormal(visitor.normal, vertices, options?.distanceTolerance);
        if (options?.needParam && visitor.param)
          detail.getParam(visitor.param, vertices, options?.distanceTolerance);
        if (options?.needColor && visitor.color)
          detail.getColor(visitor.color, vertices, options?.distanceTolerance);
        if (options?.needBarycentricCoordinates)
          detail.getBarycentricCoordinates(vertices, options?.distanceTolerance);
        if (options?.acceptIntersection && !options.acceptIntersection(detail, visitor))
          continue;
        return detail;
      }
    }
    return undefined; // no intersection
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

