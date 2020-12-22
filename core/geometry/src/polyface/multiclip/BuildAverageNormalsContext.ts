/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { IndexedPolyface } from "../Polyface";
import { Geometry } from "../../Geometry";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Angle } from "../../geometry3d/Angle";

/**
 * Normal vector with area (or other numeric) and source index
 * @internal
 */
class IndexedAreaAndNormal {
  public constructor(index: number, area: number, normal: Vector3d) {
    this.index = index;
    this.area = area;
    this.normal = normal;
  }
  public index: number;
  public area: number;
  public normal: Vector3d;

  public addWeightedNormal(weight: number, normal: Vector3d) {
    this.area += weight;
    this.normal.addScaledInPlace(normal, weight);
  }
  public divideNormalByArea() {
    this.normal.scaleInPlace(1.0 / this.area);
  }
}

/**
 * index data for a single sector of some facet.
 * @internal
 */
class SectorData {
  private constructor(facetData: IndexedAreaAndNormal, sectorIndex: number, vertexIndex: number) {
    this.facetData = facetData;
    this.sectorClusterData = undefined;
    this.sectorIndex = sectorIndex;
    this.vertexIndex = vertexIndex;
  }
  public facetData: IndexedAreaAndNormal;
  public sectorIndex: number;
  public vertexIndex: number;
  public sectorClusterData: IndexedAreaAndNormal | undefined;
  public static cbSectorSort(left: SectorData, right: SectorData): number { return left.sectorIndex - right.sectorIndex; }
  public static cbVertexSort(left: SectorData, right: SectorData): number { return left.vertexIndex - right.vertexIndex; }
  public static pushToArray(data: SectorData[], facetData: IndexedAreaAndNormal, sectorIndex: number, vertexIndex: number) {
    data.push(new SectorData(facetData, sectorIndex, vertexIndex));
  }
}
/**
 * Helper context for normal averaging.
 * All methods are static.
 * @internal
 */

export class BuildAverageNormalsContext {
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
  public static buildFastAverageNormals(polyface: IndexedPolyface, toleranceAngle: Angle) {
    // We ASSUME that the visitor order matches index order in polyface.data .....
    const visitor = polyface.createVisitor(0);
    const defaultNormal = Vector3d.create(0, 0, 1);
    const smallArea = Geometry.smallMetricDistanceSquared;    // I DO NOT LIKE THIS TOLERANCE
    const sectors: SectorData[] = [];
    let facetIndex = 0;
    let sectorIndex = 0;
    // create one IndexedAreaNormal structure for each facet.
    // At each sector of each face, notate (a) IndexedAreaNormal of the facet, (b) the sector index, (c) the point index.

    while (visitor.moveToNextFacet()) {
      const facetNormal = PolygonOps.areaNormalGo(visitor.point)!;
      let area = facetNormal.magnitude();
      if (area < smallArea) {
        facetNormal.setFromVector3d(defaultNormal);
        area = 0.0;
      } else {
        facetNormal.scaleInPlace(1.0 / area);
      }
      const facetData = new IndexedAreaAndNormal(facetIndex++, area, facetNormal);
      for (let i = 0; i < visitor.pointCount; i++) {
        SectorData.pushToArray(sectors, facetData, sectorIndex++, visitor.clientPointIndex(i));
      }
    }
    // Sort by the vertex index so all the sectors around each vertex are clustered . .
    sectors.sort(SectorData.cbVertexSort);

    // Walk the sectors around each vertex .  ..
    // For each unassigned sector
    //     walk to further sectors of the same vertex with near-parallel normals, accumulating average normal.
    //     notate all sectors in the cluster with the averaged-normal structure.
    const clusters: IndexedAreaAndNormal[] = [];
    let toleranceRadians = toleranceAngle.radians;
    if (toleranceRadians < 0.0001)
      toleranceRadians = 0.0001;

    let clusterIndex = 0;
    for (let baseSectorIndex = 0; baseSectorIndex < sectors.length; baseSectorIndex++) {
      const baseData = sectors[baseSectorIndex];
      const vertexIndex = baseData.vertexIndex;
      const baseFacetData = baseData.facetData;
      if (baseData.sectorClusterData === undefined) {
        const clusterNormal = new IndexedAreaAndNormal(clusterIndex++, 0.0, Vector3d.createZero());
        clusters.push(clusterNormal);
        // Accumulate with equal weights . . .
        clusterNormal.addWeightedNormal(1.0, baseData.facetData.normal.clone());
        for (let candidateSectorIndex = baseSectorIndex;
          candidateSectorIndex < sectors.length;
          candidateSectorIndex++) {
          const candidateSector = sectors[candidateSectorIndex];
          if (candidateSector.vertexIndex !== vertexIndex)
            break;
          if (candidateSector.facetData.normal.angleTo(baseFacetData.normal).radians > toleranceRadians)
            continue;
          if (candidateSector.sectorClusterData === undefined) {
            clusterNormal.addWeightedNormal(1.0, candidateSector.facetData.normal);
            candidateSector.sectorClusterData = clusterNormal;
          }
        }
      }
    }
    // Resort by original sector index.
    sectors.sort(SectorData.cbSectorSort);
    // normalize the sums and emplace in the facets  . . .
    polyface.data.normalIndex = [];
    polyface.data.normal = new GrowableXYZArray(sectors.length);
    for (const cluster of clusters) {
      cluster.divideNormalByArea();
      cluster.index = polyface.data.normal.length;
      polyface.data.normal.push(cluster.normal);
    }
    // emplace the indices
    for (const sector of sectors) {
      polyface.data.normalIndex.push(sector.sectorClusterData!.index);
    }
  }
  /**
   * Set up indexed normals with one normal in the plane of each facet of the mesh.
   * @param polyface mesh to modify
   */
  public static buildPerFaceNormals(polyface: IndexedPolyface) {
    const visitor = polyface.createVisitor(0);
    const facetNormal = Vector3d.create(0, 0, 1);
    const defaultNormal = Vector3d.create(0, 0, 1);
    // polyface.data.clearNormals();
    const newNormals = new GrowableXYZArray(polyface.faceCount);
    const newIndices: number[] = [];
    while (visitor.moveToNextFacet()) {
      const thisNormalIndex = newNormals.length;
      if (PolygonOps.unitNormal(visitor.point, facetNormal))
        newNormals.push(facetNormal);
      else
        newNormals.push(defaultNormal);
      for (let i = 0; i < visitor.pointCount; i++)
        newIndices.push(thisNormalIndex);
    }
    polyface.data.normalIndex = newIndices;
    polyface.data.normal = newNormals;
  }
}
