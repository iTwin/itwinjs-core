/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Polyface
 */

import { SmallSystem } from "../../numerics/Polynomials";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Ray3d } from "../../geometry3d/Ray3d";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphFromIndexedLoopsContext } from "../../topology/HalfEdgeGraphFromIndexedLoopsContext";
import { IndexedPolyface } from "../Polyface";
import { PolyfaceBuilder } from "../PolyfaceBuilder";
import { XYAndZ } from "../../geometry3d/XYZProps";
import { Geometry } from "../../Geometry";
import { OffsetMeshOptions } from "../PolyfaceQuery";
import { PolylineCompressionContext } from "../../geometry3d/PolylineCompressionByEdgeOffset";
import { BuildAverageNormalsContext } from "./BuildAverageNormalsContext";
import { Angle } from "../../geometry3d/Angle";

function isDefinedAndTrue(value: boolean | undefined): boolean {
  if (value === undefined)
    return false;
  return value;
}
/**
 * Function to be called for debugging observations at key times during offset computation.
 */
type FacetOffsetGraphDebugFunction = (message: string, Graph: HalfEdgeGraph, breakMaskA: HalfEdgeMask, breakMaskB: HalfEdgeMask) => void;

type FacetOffsetDebugString = (message: string) => void;

class AverageNormalData {
  constructor() {
    this.numActiveSectors = 0;
    this.numInactiveSectorsSectors = 0; // exterior and sling.
    this.averageNormal = Vector3d.create();
    this.maxDeviationRadiansFromAverage = 0.0;
  }
  public clear() {
    this.numActiveSectors = 0;
    this.numInactiveSectorsSectors = 0; // exterior and sling.
    this.averageNormal.setZero();
    this.maxDeviationRadiansFromAverage = 0.0;
  }
  public numActiveSectors: number;
  public numInactiveSectorsSectors: number;
  public averageNormal: Vector3d;
  public maxDeviationRadiansFromAverage: number;
  /** Add a normal to the evolving sum */
  public accumulateNormal(normal: Vector3d, isActive: boolean) {
    if (isActive) {
      this.averageNormal.addInPlace(normal);
      this.numActiveSectors++;
    } else {
      this.numInactiveSectorsSectors++;
    }
  }
  /** normalize the accumulated normals. */
  public finishNormalAveraging(): boolean {
    if (this.numActiveSectors > 0 && this.averageNormal.normalizeInPlace()) {
      return true;
    }
    return false;
  }
  /** Compute the deviation from average.   update max deviation member */
  public recordDeviation(normal: Vector3d, isActive: boolean) {
    if (isActive) {
      const radians = this.averageNormal.radiansTo(normal);
      this.maxDeviationRadiansFromAverage = Math.max(Math.abs(this.maxDeviationRadiansFromAverage), radians);
    } else {
    }
  }
  /** Return the max deviation as computed on prior calls to recordDeviation */
  public get maxDeviationRadians(): number { return this.maxDeviationRadiansFromAverage; }
}
// facet properties used during offset.
//
export class FacetOffsetProperties {
  public constructor(facetIndex: number, normal: Ray3d) {
    this.facetIndex = facetIndex;
    this.facetNormal = normal;
  }
  public facetIndex: number;
  public facetNormal: Ray3d;
}
/**
 * Sector properties during offset.
 * * this.normal may be initially assigned as the facet normal but can mutate by
 *     averaging with neighbors.
 * * this.xyz is initially the base mesh xyz but is expected to move along the normal.
 * * this.count is used locally in computations.
 */
export class SectorOffsetProperties {
  public constructor(normal: Vector3d, xyz: Point3d) {
    this.xyz = xyz;
    this.normal = normal;
    this.count = 0;
  }
  public normal: Vector3d;
  public xyz: Point3d;
  public count: number;
  /**
   * Compute the angle between plane normals on opposite sides of the edge.
   * * parallel normals have zero angle.
   * * if the edge cuts inward to the volume behind the faces, the angle is negative.
   * * if the edge is outward (a convex edge) the the volume, the angle is positive.
   * @param edgeNodeA node on one side of the edge
   * @param edgeVector pre-allocated vector to receive vector along edge.
   * @param averageNormal pre-allocated vector to receive the average normal for a chamfer of the offset edge.
   * @param
   * @param radiansTolerance tolerance for large angle between normals.
   * @returns true if this edge has SectorOffsetProperties on both sides and the dihedral angle exceeds radiansTolerance.
   */
  public static edgeHasLargeExteriorAngleBetweenNormals(edgeNodeA: HalfEdge,
    edgeVector: Vector3d,
    averageNormal: Vector3d,
    offsetDistance: number,
    radiansTolerance: number = Math.PI * 0.5): boolean {
    const propsA = edgeNodeA.edgeTag as SectorOffsetProperties;
    const edgeNodeB = edgeNodeA.edgeMate;
    const propsB = edgeNodeB.edgeTag as SectorOffsetProperties;
    if (propsA !== undefined && propsB !== undefined) {
      edgeNodeA.vectorToFaceSuccessor(edgeVector);
      const radians = propsA.normal.signedRadiansTo(propsB.normal, edgeVector);
      if (Geometry.split3WaySign(offsetDistance, -1, 1, 1) * radians >= radiansTolerance) {
        Vector3d.createAdd2Scaled(propsA.normal, 1.0, propsB.normal, 1.0, averageNormal);
        if (averageNormal.normalizeInPlace())
          return true;
      }
    }
    return false;
  }

  public static almostEqualNormals(sectorA: SectorOffsetProperties, sectorB: SectorOffsetProperties, radiansTolerance: number = Geometry.smallAngleRadians): boolean {
    return sectorA.normal.radiansTo(sectorB.normal) <= radiansTolerance;
  }
  public static radiansBetweenNormals(sectorA: SectorOffsetProperties, sectorB: SectorOffsetProperties): number {
    return sectorA.normal.radiansTo(sectorB.normal);
  }
  // Set the offset point this.xyz as sum of the nodeXyz + distance * this.normal
  public setOffsetPointAtDistanceAtHalfEdge(halfEdge: HalfEdge, distance: number) {
    halfEdge.getPoint3d(this.xyz);
    this.xyz.addScaledInPlace(this.normal, distance);
  }
  // Copy xyz from parameter into (preexisting object) xyz
  public static setXYZAtHalfEdge(halfEdge: HalfEdge, xyz: Vector3d | undefined) {
    const props = halfEdge.edgeTag as SectorOffsetProperties;
    if (props !== undefined && xyz !== undefined)
      props.xyz.set(xyz.x, xyz.y, xyz.z);
  }

  // Set the offset point this.xyz directly
  public setXYAndZ(xyz: XYAndZ) {
    this.xyz.set(xyz.x, xyz.y, xyz.z);
  }
  // Look through the half edge to its properties.  Set the normal there.  Optionally set xyz from node xyz and offset distance
  public static setNormalAtHalfEdge(halfEdge: HalfEdge, uvw: Vector3d, distance?: number) {
    const props = halfEdge.edgeTag as SectorOffsetProperties;
    if (props !== undefined) {
      props.normal.set(uvw.x, uvw.y, uvw.z);
      if (distance !== undefined)
        props.setOffsetPointAtDistanceAtHalfEdge(halfEdge, distance);
    }
  }

  // Look through the half edge to its properties.  return (if possible) the coordinates
  public static getSectorPointAtHalfEdge(halfEdge: HalfEdge, xyz: Point3d | undefined, xyzArray: GrowableXYZArray | undefined): boolean {
    const props = halfEdge.edgeTag as SectorOffsetProperties;
    if (props !== undefined) {
      if (xyz !== undefined)
        xyz.setFromPoint3d(props.xyz);
      if (xyzArray !== undefined)
        xyzArray.push(props.xyz);
      return true;
    }
    return false;
  }
  // access the XYZ and push to the array (which makes copies, not reference)
  // return pointer to the SectorOffsetProperties
  public static pushXYZ(xyzArray: GrowableXYZArray, halfEdge: HalfEdge): SectorOffsetProperties {
    const sector = halfEdge.edgeTag as SectorOffsetProperties;
    if (sector !== undefined)
      xyzArray.push(sector.xyz);
    return sector;
  }
  // Dereference to execute:       accumulatingVector += halfEdge.edgeTag.normal * scale
  public static accumulateScaledNormalAtHalfEdge(halfEdge: HalfEdge, scale: number, accumulatingVector: Vector3d) {
    const sector = halfEdge.edgeTag as SectorOffsetProperties;
    if (sector !== undefined)
      accumulatingVector.addScaledInPlace(sector.normal, scale);
  }
}

export class OffsetMeshContext {
  private constructor(basePolyface: IndexedPolyface, baseGraph: HalfEdgeGraph,
    options: OffsetMeshOptions) {
    this._basePolyface = basePolyface;
    this._baseGraph = baseGraph;
    this._breakMaskA = baseGraph.grabMask();
    this._breakMaskB = baseGraph.grabMask();

    this._insideOfChamferFace = baseGraph.grabMask();
    this._outsideOfChamferFace = baseGraph.grabMask();
    this._insideEndOfChamferFace = baseGraph.grabMask();
    this._outsideEndOfChamferFace = baseGraph.grabMask();
    this._exteriorMask = HalfEdgeMask.EXTERIOR;
    this._offsetCoordinatesAssigned = baseGraph.grabMask();
    this._smoothSingleDihedralAngleRadians = options.smoothSingleDihedralAngle.radians;
    this._chamferTurnRadians = options.chamferTurnAngle.radians;
    this._smoothAccumulatedDihedralAngleRadians = options.smoothAccumulatedDihedralAngle.radians;
  }
  private _basePolyface: IndexedPolyface;
  private _baseGraph: HalfEdgeGraph;
  /** "Exterior" side of a bare edge of the mesh */
  public get exteriorMask(): HalfEdgeMask { return this._exteriorMask; }
  private _exteriorMask: HalfEdgeMask;

  /** Mask indicating a a sector's coordinates have been reassigned at offset distance. */
  private _offsetCoordinatesAssigned: HalfEdgeMask;

  /** "First" sector of a smooth sequence. */
  public get breakMaskA(): HalfEdgeMask { return this._breakMaskA; }
  private _breakMaskA: HalfEdgeMask;

  /** "Last" sector of a smooth sequence. */
  public get breakMaskB(): HalfEdgeMask { return this._breakMaskB; }
  private _breakMaskB: HalfEdgeMask;

  /** This edge is on a chamfered face, and along the original edge */
  public get insideOfChamferFace(): HalfEdgeMask { return this._insideOfChamferFace; }
  private _insideOfChamferFace: HalfEdgeMask;

  /** This is the original edge of a chamfer face */
  public get outsideOfChamferFace(): HalfEdgeMask { return this._outsideOfChamferFace; }
  private _outsideOfChamferFace: HalfEdgeMask;

  /** This edge is on a chamfered face, and at the end -- other side may be a sling */
  public get insideEndOfChamferFace(): HalfEdgeMask { return this._insideEndOfChamferFace; }
  private _insideEndOfChamferFace: HalfEdgeMask;

  /** This is the outside of the end of a chamfer face -- i.e. the inside of a new face-at-vertex */
  public get outsideEndOfChamferFace(): HalfEdgeMask { return this._outsideEndOfChamferFace; }
  private _outsideEndOfChamferFace: HalfEdgeMask;

  private _smoothSingleDihedralAngleRadians: number;
  private _smoothAccumulatedDihedralAngleRadians: number;
  private _chamferTurnRadians: number;
  public static graphDebugFunction?: FacetOffsetGraphDebugFunction;
  public static stringDebugFunction?: FacetOffsetDebugString;
  /**
   * * build a mesh offset by given distance.
   * * output the mesh to the given builder.
   * @param basePolyface original mesh
   * @param builder polyface builder to receive the new mesh.
   * @param distance signed offset distance.
   */
  public static buildOffsetMesh(
    basePolyface: IndexedPolyface,
    builder: PolyfaceBuilder,
    distance: number,
    options: OffsetMeshOptions) {
    const baseGraph = this.buildBaseGraph(basePolyface);
    if (baseGraph !== undefined) {
      const offsetBuilder = new OffsetMeshContext(basePolyface, baseGraph, options);
      if (OffsetMeshContext.graphDebugFunction !== undefined)
        OffsetMeshContext.graphDebugFunction("BaseGraph", baseGraph, offsetBuilder._breakMaskA, offsetBuilder._breakMaskB);

      offsetBuilder.computeSectorOffsetPoints(distance);

      if (OffsetMeshContext.graphDebugFunction !== undefined)
        OffsetMeshContext.graphDebugFunction("after computeSectorOffsetPoints", baseGraph, offsetBuilder._breakMaskA, offsetBuilder._breakMaskB);

      const outputSelector = options.outputSelector ? options.outputSelector : {
        outputOffsetsFromFaces: true,
        outputOffsetsFromEdges: true,
        outputOffsetsFromVertices: true,
      };

      if (isDefinedAndTrue(outputSelector.outputOffsetsFromFaces))
        offsetBuilder.announceOffsetLoopsByFace(builder);
      if (isDefinedAndTrue(outputSelector.outputOffsetsFromEdges))
        offsetBuilder.announceOffsetLoopsByEdge(builder);
      if (isDefinedAndTrue(outputSelector.outputOffsetsFromVertices))
        offsetBuilder.announceOffsetLoopsByVertex(builder);
    }
  }

  // At each node . .
  // * Find the sector data
  // * recompute the sector point using node XYZ and sectorData normal.
  private applyFaceNormalOffsetsToSectorData(distance: number) {
    this._baseGraph.announceNodes((_graph: HalfEdgeGraph, node: HalfEdge) => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData !== undefined) {
        sectorData.setOffsetPointAtDistanceAtHalfEdge(node, distance);
      }
      return true;
    });
  }

  /**
   * * build a mesh offset by given distance.
   * * output the mesh to the given builder.
   * @param basePolyface original mesh
   * @param builder polyface builder to receive the new mesh.
   * @param distance signed offset distance.
   */
  public static buildOffsetMeshWithEdgeChamfers(
    basePolyface: IndexedPolyface,
    builder: PolyfaceBuilder,
    distance: number,
    options: OffsetMeshOptions) {
    const baseGraph = this.buildBaseGraph(basePolyface);
    if (baseGraph !== undefined) {
      const offsetBuilder = new OffsetMeshContext(basePolyface, baseGraph, options);
      offsetBuilder.applyFaceNormalOffsetsToSectorData(distance);
      if (OffsetMeshContext.graphDebugFunction !== undefined)
        OffsetMeshContext.graphDebugFunction("BaseGraph", baseGraph, offsetBuilder._breakMaskA, offsetBuilder._breakMaskB);

      const outputSelector = options.outputSelector ? options.outputSelector : {
        outputOffsetsFromFaces: true,
        outputOffsetsFromEdges: true,
        outputOffsetsFromVertices: true,
      };

      if (isDefinedAndTrue(outputSelector.outputOffsetsFromFacesBeforeChamfers))
        offsetBuilder.announceFacetsWithSectorCoordinatesAroundFaces(builder);

      offsetBuilder.addChamferTopologyToAllEdges(options, distance);
      offsetBuilder.computeOffsetFacetIntersections(distance);

      if (OffsetMeshContext.graphDebugFunction !== undefined)
        OffsetMeshContext.graphDebugFunction("after computeEdgeChamfers", baseGraph, offsetBuilder._breakMaskA, offsetBuilder._breakMaskB);

      if (isDefinedAndTrue(outputSelector.outputOffsetsFromFaces))
        offsetBuilder.announceFacetsWithSectorCoordinatesAroundFaces(builder);
      if (isDefinedAndTrue(outputSelector.outputOffsetsFromEdges))
        offsetBuilder.announceFacetsWithSectorCoordinatesAroundEdges(builder);
      if (isDefinedAndTrue(outputSelector.outputOffsetsFromVertices))
        offsetBuilder.announceFacetsWithSectorCoordinatesAroundVertices(builder);
    }
  }

  /**
 * For each face of the graph, shift vertices by offsetDistance and emit to the builder as a facet
 * @param polyfaceBuilder
 */
  public announceSimpleOffsetFromFaces(polyfaceBuilder: PolyfaceBuilder, offsetDistance: number) {
    const xyzLoop = new GrowableXYZArray();
    const xyz = Point3d.create();    // reused at each point around each facet.
    const uvw = Vector3d.create();   // reused once per facet
    const announceNodeAroundFace = (node: HalfEdge): number => {
      node.getPoint3d(xyz);
      xyz.addInPlace(uvw);
      xyzLoop.push(xyz);
      return 0;
    };
    this._baseGraph.announceFaceLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean => {
        if (!seed.isMaskSet(HalfEdgeMask.EXTERIOR)) {
          const facetProperties = seed.faceTag as FacetOffsetProperties;
          uvw.setFromVector3d(facetProperties.facetNormal.direction);
          uvw.scaleInPlace(offsetDistance);
          xyzLoop.length = 0;
          seed.sumAroundFace(announceNodeAroundFace);
          polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
        }
        return true;
      });
  }

  /**
 * For each face of the graph, output the xyz of the sector data
 * @param polyfaceBuilder
 */
  public announceFacetsWithSectorCoordinatesAroundFaces(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    // For face loop visits .. get the point from the sector data.
    const announceNodeAroundFace = (node: HalfEdge): number => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData !== undefined) {
        xyzLoop.push(sectorData.xyz);
      }
      return 0;
    };
    this._baseGraph.announceFaceLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean => {
        if (!seed.isMaskSet(HalfEdgeMask.EXTERIOR)) {
          xyzLoop.length = 0;
          seed.sumAroundFace(announceNodeAroundFace);
          if (xyzLoop.length > 2)
            polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
        }
        return true;
      });
  }
  private countBits(mask: HalfEdgeMask): number {
    let n = 0;
    let mask1 = mask;
    while (mask1 !== 0) {
      if (mask1 & 0x01) n++;
      mask1 = mask1 >> 1;
    }
    return n;
  }
  /**
 * For each edge of the graph . .
 * * Collect coordinates in 4 sectors going around the edge
 * * Compress with tight tolerance so adjacent sectors with clean point match reduce to a single point.
 * * Emit as a facet.
 * @param polyfaceBuilder
 */
  public announceFacetsWithSectorCoordinatesAroundEdges(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    const primaryCompressionTolerance = Geometry.smallMetricDistance;
    const allMasksForEdgesToIgnore = this._exteriorMask
      | this._outsideEndOfChamferFace
      | this._outsideOfChamferFace
      | this._insideOfChamferFace
      | this._insideEndOfChamferFace;
    this._baseGraph.announceEdges(
      (_graph: HalfEdgeGraph, nodeA: HalfEdge): boolean => {
        // This starts by looking for EXTERIOR on both sides ...
        if (nodeA.findMaskAroundEdge(this._exteriorMask) !== undefined) {
          return true;
        } else if (!nodeA.isMaskSet(allMasksForEdgesToIgnore)) {    // By design, we believe that these two test for  allMasksForEdgesToIgnore condition would catch the EXTERIOR case above
          const nodeB = nodeA.faceSuccessor;
          const nodeC = nodeA.edgeMate;
          if (!nodeC.isMaskSet(allMasksForEdgesToIgnore)) {
            const nodeD = nodeC.faceSuccessor;
            xyzLoop.clear();
            SectorOffsetProperties.getSectorPointAtHalfEdge(nodeA, undefined, xyzLoop);
            SectorOffsetProperties.getSectorPointAtHalfEdge(nodeB, undefined, xyzLoop);
            SectorOffsetProperties.getSectorPointAtHalfEdge(nodeC, undefined, xyzLoop);
            SectorOffsetProperties.getSectorPointAtHalfEdge(nodeD, undefined, xyzLoop);
            PolylineCompressionContext.compressInPlaceByShortEdgeLength(xyzLoop, primaryCompressionTolerance);
            if (xyzLoop.length > 2) {
              polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
            }
          }
        } else {
          return true;
        }
        return true;
      });
  }

  private getCoordinateString(node: HalfEdge, showXYZ: boolean = true, showFaceSuccessorXYZ: boolean = false): string {
    const s = "";
    if (showXYZ) {
      if (showFaceSuccessorXYZ) {
        return `${HalfEdge.nodeToIdXYZString(node)} ==> ${HalfEdge.nodeToIdXYZString(node.faceSuccessor)}`;
      } else {
        return `${HalfEdge.nodeToIdXYZString(node)}`;
      }
    } else {
      if (showFaceSuccessorXYZ) {
        return `==> ${HalfEdge.nodeToIdXYZString(node.faceSuccessor)}`;
      } else {
        return "";
      }
    }

  }
  private inspectMasks(node: HalfEdge, showXYZ: boolean = true, showFaceSuccessorXYZ: boolean = false): string {
    const s = "[";
    const v = s.concat(
      node.id.toString(),
      node.isMaskSet(this._exteriorMask) ? "X" : "",
      node.isMaskSet(this.breakMaskA) ? "A" : "",
      node.isMaskSet(this.breakMaskB) ? "B" : "",
      node.isMaskSet(this.insideEndOfChamferFace) ? "(sling)" : "",
      node.isMaskSet(this.insideOfChamferFace) ? "(in chamfer)" : "",
      node.isMaskSet(this.outsideEndOfChamferFace) ? "(@sling)" : "",
      node.isMaskSet(this.outsideOfChamferFace) ? "(@chamfer)" : "",
      this.getCoordinateString(node, showXYZ, showFaceSuccessorXYZ),
      "]"
    );
    return v;
  }
  /**
 * For each face of the graph, output the xyz of the sector data
 * @param polyfaceBuilder
 */
  public announceFacetsWithSectorCoordinatesAroundVertices(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    const primaryCompressionTolerance = Geometry.smallMetricDistance;
    this._baseGraph.announceVertexLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean => {
        if (!seed.findMaskAroundVertex(this._exteriorMask)) {
          xyzLoop.length = 0;
          seed.sumAroundVertex((node: HalfEdge) => {
            this.inspectMasks(node);
            if (!node.isMaskSet(this._insideEndOfChamferFace))
              SectorOffsetProperties.getSectorPointAtHalfEdge(node, undefined, xyzLoop);
            return 0.0;
          });
          PolylineCompressionContext.compressInPlaceByShortEdgeLength(xyzLoop, primaryCompressionTolerance);
          if (xyzLoop.length > 2) {
            polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
          }
        }
        return true;
      });
  }
  /**
   * For each face of the graph, announce facets using xyz recorded in the sectors associated with the 4 nodes
   * @param polyfaceBuilder
   */
  public announceOffsetLoopsByEdge(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    const announceNode = (node: HalfEdge): number => {
      const sector = node.edgeTag as SectorOffsetProperties;
      xyzLoop.push(sector.xyz);
      return 0;
    };
    this._baseGraph.announceEdges(
      (_graph: HalfEdgeGraph, nodeA0: HalfEdge): boolean => {
        const nodeB0 = nodeA0.edgeMate;
        if (!nodeA0.isMaskSet(HalfEdgeMask.EXTERIOR)
          && !nodeB0.isMaskSet(HalfEdgeMask.EXTERIOR)) {
          const nodeA1 = nodeA0.faceSuccessor;
          const nodeB1 = nodeB0.faceSuccessor;
          xyzLoop.length = 0;
          announceNode(nodeA1);
          announceNode(nodeA0);
          announceNode(nodeB1);
          announceNode(nodeB0);
          polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
        }
        return true;
      });
  }

  /**
   * @param polyfaceBuilder
   */
  public announceOffsetLoopsByFace(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    const announceNode = (node: HalfEdge): number => {
      SectorOffsetProperties.pushXYZ(xyzLoop, node);
      return 0;
    };
    this._baseGraph.announceFaceLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean => {
        if (!seed.isMaskSet(HalfEdgeMask.EXTERIOR)) {
          xyzLoop.length = 0;
          seed.sumAroundFace(announceNode);
          polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
        }
        return true;
      });
  }
  /**
   * @param polyfaceBuilder
   */
  public announceOffsetLoopsByVertex(polyfaceBuilder: PolyfaceBuilder) {
    const xyzLoop = new GrowableXYZArray();
    const breakEdges: HalfEdge[] = [];
    this._baseGraph.announceVertexLoops(
      (_graph: HalfEdgeGraph, seed: HalfEdge): boolean => {
        if (seed.countMaskAroundVertex(this._exteriorMask) === 0) {
          seed.collectMaskedEdgesAroundVertex(this._breakMaskA, true, breakEdges);
          if (breakEdges.length > 3) {
            xyzLoop.clear();
            for (const node of breakEdges)
              SectorOffsetProperties.pushXYZ(xyzLoop, node);
            polyfaceBuilder.addPolygonGrowableXYZArray(xyzLoop);
          }
        }
        return true;
      });
  }

  /**
     * * Exterior half edges have HalfEdgeMask.EXTERIOR
     * * All interior half edge around a facet have facetTag pointing to a facetProperties object for that facet.
     *    * the facetOffsetProperties object has the simple facet normal.
     * * Each half edge has edgeTag pointing to to a sectorOffsetProperties object
     *    * the sectorOffsetProperties has a copy of the facet normal.
     * @param polyface
     * @returns graph
     */
  public static buildBaseGraph(polyface: IndexedPolyface): HalfEdgeGraph | undefined {
    const graphBuilder = new HalfEdgeGraphFromIndexedLoopsContext();
    const visitor = polyface.createVisitor();
    const xyzA = Point3d.create();
    const xyzB = Point3d.create();
    for (visitor.reset(); visitor.moveToNextFacet();) {
      const normal = PolygonOps.centroidAreaNormal(visitor.point);
      if (normal !== undefined) {
        const edgeA = graphBuilder.insertLoop(visitor.pointIndex,
          (insideHalfEdge: HalfEdge) => {
            const mate = insideHalfEdge.edgeMate;
            polyface.data.getPoint(insideHalfEdge.i, xyzA);
            insideHalfEdge.setXYZ(xyzA);
            polyface.data.getPoint(mate.i, xyzB);
            mate.setXYZ(xyzB);
          });
        const facetProperties = new FacetOffsetProperties(visitor.currentReadIndex(), normal);
        if (edgeA !== undefined) {
          edgeA.sumAroundFace(
            (edgeB: HalfEdge) => {
              edgeB.faceTag = facetProperties;
              edgeB.edgeTag = new SectorOffsetProperties(normal.direction.clone(), edgeB.getPoint3d());
              return 0;
            });
        }
      }
    }
    return graphBuilder.graph;
  }
  private setOffsetAtDistanceAroundVertex(vertexSeed: HalfEdge, distance: number) {
    vertexSeed.sumAroundVertex((nodeAroundVertex: HalfEdge) => {
      const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
      if (props !== undefined)
        props.setOffsetPointAtDistanceAtHalfEdge(nodeAroundVertex, distance);
      return 0.0;
    }
    );
  }

  private setOffsetXYAndZAroundVertex(vertexSeed: HalfEdge, xyz: XYAndZ) {
    vertexSeed.sumAroundVertex((nodeAroundVertex: HalfEdge) => {
      const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
      if (props !== undefined) {
        props.setXYAndZ(xyz);
        nodeAroundVertex.setMask(this._offsetCoordinatesAssigned);
      }
      return 0.0;
    }
    );
  }

  /**
  *  * start at vertexSeed.
  *  * set the offset point at up to (and including) one with (a) this._breakMaskB or (b) this._exteriorMask
  *  *
  * @param vertexSeed first node to mark.
  * @param f function to call to announce each node and its sector properties.
  * @returns number of nodes marked.
  */
  private announceNodeAndSectorPropertiesInSmoothSector(vertexSeed: HalfEdge, f: (node: HalfEdge, properties: SectorOffsetProperties) => void): number {
    let n = 0;
    for (let currentNode = vertexSeed; ; currentNode = currentNode.vertexSuccessor) {
      const props = currentNode.edgeTag as SectorOffsetProperties;
      n++;
      if (props !== undefined) {
        f(currentNode, props);
        n++;
      }
      if (currentNode.isMaskSet(this._breakMaskB))
        return n;
      // REMARK: these additional exit conditions should not happen if (a) the graph is properly marked and (b) the start node is not exterior.
      if (currentNode.isMaskSet(this._exteriorMask))
        return n;
      if (currentNode === vertexSeed && n === 0)
        return n;
    }
  }

  private computeAverageNormalAndMaxDeviationAroundVertex(vertexSeed: HalfEdge, data: AverageNormalData): number | undefined {
    data.clear();
    const inactiveNodeMask = this._exteriorMask | this._insideEndOfChamferFace;
    vertexSeed.sumAroundVertex((node: HalfEdge) => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData)
        data.accumulateNormal(sectorData.normal, !node.isMaskSet(inactiveNodeMask));
      return 0.0;
    }
    );
    if (!data.finishNormalAveraging()) {
      return undefined;
    }
    vertexSeed.sumAroundVertex((node: HalfEdge) => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData)
        data.recordDeviation(sectorData.normal, !node.isMaskSet(inactiveNodeMask));
      return 0.0;
    }
    );
    return data.maxDeviationRadians;
  }

  private assignOffsetByAverageNormalAroundVertex(vertexSeed: HalfEdge,
    maxAllowedDeviationRadians: number,
    data: AverageNormalData,
    distance: number): boolean {
    const maxDeviationRadians = this.computeAverageNormalAndMaxDeviationAroundVertex(vertexSeed, data);
    if (maxDeviationRadians === undefined || maxDeviationRadians > maxAllowedDeviationRadians)
      return false;
    vertexSeed.sumAroundVertex((node: HalfEdge) => {
      SectorOffsetProperties.setNormalAtHalfEdge(node, data.averageNormal, distance);
      return 0;
    });
    return true;
  }

  /** Search around a vertex for a sector which has a different normal from its vertexPredecessor.
 * * The seed will be the first candidate considered
*/
  private markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed: HalfEdge) {
    vertexSeed.clearMaskAroundVertex(this._breakMaskA);
    vertexSeed.clearMaskAroundVertex(this._breakMaskB);

    const smoothSingleDihedralAngleRadians = this._smoothSingleDihedralAngleRadians;
    const smoothAccumulatedDihedralAngleRadians = this._smoothAccumulatedDihedralAngleRadians;

    // Step 1: Examine the edge between nodeA and the sector on its vertex predecessor side.  This (alone) determines single angle breaks.
    let numBreaks = 0;
    let nodeA = vertexSeed;
    let _numSmooth = 0;
    do {
      const nodeB = nodeA.edgeMate;
      const nodeC = nodeB.faceSuccessor;    // same as nodeA.vertexPredecessor
      if (nodeA.isMaskSet(this._exteriorMask)) {
        if (!nodeB.isMaskSet(this._exteriorMask)) {
          nodeC.setMask(this._breakMaskB);
          numBreaks++;
        }
      } else {
        if (nodeA.isMaskSet(this._outsideOfChamferFace)) {
          nodeA.setMask(this._breakMaskA);
        } else if (nodeA.isMaskSet(this._outsideEndOfChamferFace)) {
          nodeA.setMask(this._breakMaskA);
          nodeA.setMask(this._breakMaskB);
        } else if (nodeA.isMaskSet(this._insideEndOfChamferFace)) {
          // This is the sling.   It's normal is along edge -- not really a break.
        } else if (nodeA.isMaskSet(this._insideOfChamferFace)) {
          nodeA.setMask(this._breakMaskA);
          nodeA.setMask(this._breakMaskB);
          nodeC.setMask(this._breakMaskB);
        } else if (nodeB.isMaskSet(this._exteriorMask)) {
          numBreaks++;
          nodeA.setMask(this._breakMaskA);
        } else if (!SectorOffsetProperties.almostEqualNormals(
          nodeA.edgeTag as SectorOffsetProperties,
          nodeC.edgeTag as SectorOffsetProperties,
          smoothSingleDihedralAngleRadians)) {
          nodeA.setMask(this._breakMaskA);
          numBreaks++;
          nodeC.setMask(this._breakMaskB);
        } else {
          _numSmooth++;
        }
      }
      nodeA = nodeA.vertexSuccessor;
    } while (nodeA !== vertexSeed);
    if (OffsetMeshContext.stringDebugFunction !== undefined)
      OffsetMeshContext.stringDebugFunction(`   numSkip   ${_numSmooth} `);
    if (numBreaks === 0) {
      // make the first vertex a break so subsequent searches have a place to start
      vertexSeed.setMask(this._breakMaskA);
      vertexSeed.vertexPredecessor.setMask(this._breakMaskB);
      numBreaks = 1;
    }
    // Step 2: At each single break, sweep forward to its closing breakB.  Insert breaks at accumulated angles.
    // (minor TODO: for the insertion case, try to split more equally.)
    nodeA = vertexSeed;
    const nodeAStart = nodeA.findMaskAroundVertex(this._breakMaskA);
    do {
      if (nodeA.isMaskSet(this._breakMaskA) && !nodeA.isMaskSet(this._breakMaskB)) {
        let accumulatedRadians = 0.0;
        do {
          const nodeB = nodeA.vertexSuccessor;
          accumulatedRadians += SectorOffsetProperties.radiansBetweenNormals(
            nodeA.edgeTag as SectorOffsetProperties,
            nodeB.edgeTag as SectorOffsetProperties,
          );
          if (accumulatedRadians > smoothAccumulatedDihedralAngleRadians) {
            nodeA.setMask(this._breakMaskB);
            nodeB.setMask(this._breakMaskA);
            numBreaks++;
            accumulatedRadians = 0.0;
          }
          nodeA = nodeB;
        } while (!nodeA.isMaskSet(this._breakMaskB));
      } else {
        nodeA = nodeA.vertexSuccessor;
      }
    } while (nodeA !== nodeAStart);

    if (numBreaks > 0) {
      // In each compound sector, accumulate and install average normal.
      nodeA = nodeAStart;
      const averageNormal = Vector3d.create();
      const edgeVectorU = Vector3d.create();
      const edgeVectorV = Vector3d.create();
      averageNormal.setZero();
      do {
        if (nodeA.isMaskSet(this._breakMaskA) && !nodeA.isMaskSet(this._breakMaskB)) {
          let nodeQ = nodeA;
          for (; ;) {
            nodeQ.vectorToFaceSuccessor(edgeVectorU);
            nodeQ.vectorToFacePredecessor(edgeVectorV);
            let singleSectorRadians = edgeVectorU.signedRadiansTo(edgeVectorV, (nodeQ.faceTag as FacetOffsetProperties).facetNormal.direction);
            if (singleSectorRadians < 0.0)
              singleSectorRadians += Math.PI * 2;
            SectorOffsetProperties.accumulateScaledNormalAtHalfEdge(nodeQ, singleSectorRadians, averageNormal);
            if (nodeQ.isMaskSet(this._breakMaskB))
              break;
            nodeQ = nodeQ.vertexSuccessor;
          }
          if (averageNormal.normalizeInPlace()) {
            nodeQ = nodeA;
            for (; ;) {
              SectorOffsetProperties.setNormalAtHalfEdge(nodeQ, averageNormal);
              if (nodeQ.isMaskSet(this._breakMaskB))
                break;
              nodeQ = nodeQ.vertexSuccessor;
            }
          }
        }
        nodeA = nodeA.vertexSuccessor;
      } while (nodeA !== vertexSeed);

    }
  }

  /** Compute the point of intersection of the planes in the sectors of 3 half edges */
  private compute3SectorIntersection(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge, result?: Vector3d): Vector3d | undefined {
    const sectorA = nodeA.edgeTag as SectorOffsetProperties;
    const sectorB = nodeB.edgeTag as SectorOffsetProperties;
    const sectorC = nodeC.edgeTag as SectorOffsetProperties;
    const vector = SmallSystem.intersect3Planes(
      sectorA.xyz, sectorA.normal,
      sectorB.xyz, sectorB.normal,
      sectorC.xyz, sectorC.normal,
      result);
    return vector;
  }
  /** Compute the point of intersection of the planes in the sectors of 3 half edges */
  private compute3SectorIntersectionDebug(nodeA: HalfEdge, nodeB: HalfEdge, nodeC: HalfEdge, result?: Vector3d): Vector3d | undefined {
    if (OffsetMeshContext.stringDebugFunction !== undefined)
      OffsetMeshContext.stringDebugFunction(`compute3${this.inspectMasks(nodeA)}${this.inspectMasks(nodeB)}${this.inspectMasks(nodeC)} `);
    const vector = this.compute3SectorIntersection(nodeA, nodeB, nodeC, result);

    if (OffsetMeshContext.stringDebugFunction !== undefined) {
      if (vector === undefined)
        OffsetMeshContext.stringDebugFunction(" NO INTERSECTION");
      else
        OffsetMeshContext.stringDebugFunction(` ComputedVector ${vector} `);
    }
    return vector;
  }

  /** Compute the point of intersection of the planes in the sectors of 2 half edges, using cross product of their normals to resolve */
  private compute2SectorIntersection(nodeA: HalfEdge, nodeB: HalfEdge, result?: Vector3d): Vector3d | undefined {
    const sectorA = nodeA.edgeTag as SectorOffsetProperties;
    const sectorB = nodeB.edgeTag as SectorOffsetProperties;
    const normalC = sectorA.normal.crossProduct(sectorB.normal);
    return SmallSystem.intersect3Planes(
      sectorA.xyz, sectorA.normal,
      sectorB.xyz, sectorB.normal,
      sectorB.xyz, normalC,
      result);
  }
  /**
   * * at input, graph has all original faces and edges
   *   * each sector points to a faceProperties with original facet normal
   * * at exit:
   *    * new "chamfer faces" are added outside of edges with dihedral angle in excess of options.dihedralAngleForChamferTrigger
   *    * the original edge is split along its length to create space
   *      * one edge "along" each direction inside the slit.
   *      * a sling edge at each end of the slit.
   *          * outside of the sling is part of the slit face loop.
   *          * inside is a single-node face
   *    * thus the slit itself has 4 nodes.
   *    * the two nodes at each end can thus contain the two distinct points at that end of the chamfer.
   *    * all 4 nodes of the slit face point to a new FacetOffsetProperties with the average normal.
   *    * the inside of each sling face has
   *        * original vertex coordinates in the node
   *        * face properties with a normal pointing outward from that end of the original edge -- hence define a plane that can clip the chamfer
   *    * the two points at each end of the chamfer are computed as the intersection of
   *        * chamfer plane
   *        * sling plane
   *        * adjacent plane of the face on the other side of the edge being chamfered.
   * @param distance distance to offset.  The sign of this is important in the chamfer construction.
   */
  private addChamferTopologyToAllEdges(options: OffsetMeshOptions, distance: number) {
    const edgesToChamfer: HalfEdge[] = [];
    const chamferRadians = options.chamferTurnAngle.radians;
    const vertexXYZ = Point3d.create();  // reuse
    const edgeVector = Vector3d.create();  // reuse
    const outwardEdgeVector = Vector3d.create(); // reuse
    const averageNormal = Vector3d.create(); // reuse
    // collect all the edges with sharp dihedral angle.
    this._baseGraph.announceEdges(
      (_graph: HalfEdgeGraph, edgeNode: HalfEdge) => {
        if (SectorOffsetProperties.edgeHasLargeExteriorAngleBetweenNormals(edgeNode, edgeVector, averageNormal,
          distance,
          chamferRadians)) {
          edgesToChamfer.push(edgeNode);
          return true;
        }
        return true;
      });
    // Create sliver faces.
    // Sliver face gets an average normal from its neighbors.
    for (const outsideA of edgesToChamfer) {
      // remark: this recomputes as in collection round.
      if (SectorOffsetProperties.edgeHasLargeExteriorAngleBetweenNormals(outsideA, edgeVector, averageNormal, chamferRadians)) {
        // This copies coordinates and vertex id .... sectorOffsetProperties are delayed until late in the 2-pass loop below
        const insideA = this._baseGraph.splitEdgeCreateSliverFace(outsideA);
        const insideB = insideA.facePredecessor;
        const offsetPoint = insideA.getPoint3d();
        offsetPoint.addScaledInPlace(averageNormal, distance);
        const ray = Ray3d.createCapture(offsetPoint, averageNormal.clone());
        const facetProperties = new FacetOffsetProperties(-1, ray);
        // for each side (hence end) of the sliver face, set mask and install a sling loop for the anticipated end of the chamfer face
        let s = -1.0;
        for (const nodeE of [insideA, insideB]) {
          edgeVector.scale(s, outwardEdgeVector);
          nodeE.getPoint3d(vertexXYZ);
          const nodeF = nodeE.edgeMate;
          nodeE.setMask(this._insideOfChamferFace);
          nodeF.setMask(this._outsideOfChamferFace);
          // mark and reference the chamfer face.
          nodeE.faceTag = facetProperties;
          // sling at this end
          const outsideOfSling = this._baseGraph.splitEdge(undefined, vertexXYZ.x, vertexXYZ.y, vertexXYZ.z, nodeE.i);
          const insideOfSling = outsideOfSling.edgeMate;
          outsideOfSling.setMask(this._outsideEndOfChamferFace);
          outsideOfSling.faceTag = facetProperties;
          insideOfSling.setMask(this._insideEndOfChamferFace);
          HalfEdge.pinch(nodeE, outsideOfSling);
          const endNormal = Ray3d.create(vertexXYZ, outwardEdgeVector);  // clones the inputs
          const slingFaceProperties = new FacetOffsetProperties(-1, endNormal);
          insideOfSling.faceTag = slingFaceProperties;
          outsideOfSling.faceTag = facetProperties;
          // initialize sectors with existing vertex point.
          nodeE.edgeTag = new SectorOffsetProperties(averageNormal.clone(), vertexXYZ.clone());
          outsideOfSling.edgeTag = new SectorOffsetProperties(averageNormal.clone(), vertexXYZ.clone());
          insideOfSling.edgeTag = new SectorOffsetProperties(outwardEdgeVector.clone(), vertexXYZ.clone());
          // OffsetMeshContext.stringDebugFunction("Chamfer Setup");
          const chamferPointE = this.compute3SectorIntersection(nodeE, nodeE.edgeMate, insideOfSling);
          const chamferPointF = this.compute3SectorIntersection(outsideOfSling, outsideOfSling.vertexSuccessor, insideOfSling);
          nodeE.edgeTag = new SectorOffsetProperties(averageNormal.clone(), vertexXYZ.clone());
          SectorOffsetProperties.setXYZAtHalfEdge(nodeE, chamferPointE);
          SectorOffsetProperties.setXYZAtHalfEdge(outsideOfSling, chamferPointF);
          s *= -1.0;
        }
      }
    }
  }
  /**
   * * at input:
   *   * Each node points to sectorOffsetProperties with appropriate unit normal
   * * at exit:
   *    * Each sectorOffsetProperties has an offset point computed with consideration of offset planes in the neighborhood.
   * @param distance distance to offset.
   */
  private computeSectorOffsetPoints(distance: number) {
    const breakEdges: HalfEdge[] = [];
    this._baseGraph.clearMask(this._offsetCoordinatesAssigned);
    this._baseGraph.announceVertexLoops((_graph: HalfEdgeGraph, vertexSeed: HalfEdge) => {
      this.markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed);
      this.setOffsetAtDistanceAroundVertex(vertexSeed, distance);
      vertexSeed.collectMaskedEdgesAroundVertex(this._breakMaskA, true, breakEdges);
      if (breakEdges.length <= 1) {
        // just one smooth sequence.
        // everything is set already.
      } else if (breakEdges.length === 2) {
        // exterior vertex with two incident smooth
        const vectorFromOrigin = this.compute2SectorIntersection(breakEdges[0], breakEdges[1]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
          vertexSeed.setMaskAroundVertex(this._offsetCoordinatesAssigned);
        }
      } else if (breakEdges.length === 3) {
        const vectorFromOrigin = this.compute3SectorIntersectionDebug(breakEdges[0], breakEdges[1], breakEdges[2]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
          vertexSeed.setMaskAroundVertex(this._offsetCoordinatesAssigned);
        }
        // simple 3-face corner . . .
      } else {
        // Lots and Lots of edges
        // each set of 3 sectors independently generates an offset for its central sector.
        // make the array wrap 2 nodes.
        breakEdges.push(breakEdges[0]);
        breakEdges.push(breakEdges[1]);
        for (let i = 0; i + 2 < breakEdges.length; i++) {
          const vectorFromOrigin = this.compute3SectorIntersectionDebug(breakEdges[i], breakEdges[i + 1], breakEdges[i + 2]);
          if (vectorFromOrigin !== undefined) {
            this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[i],
              (node: HalfEdge, properties: SectorOffsetProperties) => {
                properties.setXYAndZ(vectorFromOrigin);
                node.setMask(this._offsetCoordinatesAssigned);
              });
          }
        }
      }
      return true;
    });
  }

  /**
   * * at input:
   *   * Each node points to sectorOffsetProperties with previously computed XYZ (presumably mismatched)
   * * at exit:
   *    * Each sectorOffsetProperties has an offset point computed with consideration of offset planes in the neighborhood.
   * @param distance distance to offset.
   */
  private computeOffsetFacetIntersections(distance: number) {
    if (OffsetMeshContext.stringDebugFunction !== undefined)
      OffsetMeshContext.stringDebugFunction("*****                                 recompute intersections");
    const breakEdges: HalfEdge[] = [];
    const vertexXYZ = Point3d.create();
    const maxVertexMove = 2.0 * distance;
    const averageNormalData = new AverageNormalData();
    const maxAllowedNormalDeviationRadians = Angle.degreesToRadians(25.0);
    this._baseGraph.announceVertexLoops((_graph: HalfEdgeGraph, vertexSeedA: HalfEdge) => {
      // reposition to an important vertex.
      // first choice: a chamfer face.
      let vertexSeed = vertexSeedA.findMaskAroundVertex(this._outsideEndOfChamferFace);
      if (vertexSeed === undefined)
        vertexSeed = vertexSeedA.findMaskAroundVertex(this._breakMaskA);
      if (vertexSeed === undefined)
        vertexSeed = vertexSeedA;
      if (OffsetMeshContext.stringDebugFunction !== undefined) {
        OffsetMeshContext.stringDebugFunction(` VERTEX LOOP   ${vertexSeed.getPoint3d().toJSON()} `);
        vertexSeed.sumAroundVertex(
          (node: HalfEdge) => { OffsetMeshContext.stringDebugFunction!(this.inspectMasks(node, false, true)); return 0; });
      }
      // Take care of the easiest vertices directly . . .
      if (this.assignOffsetByAverageNormalAroundVertex(vertexSeed, maxAllowedNormalDeviationRadians, averageNormalData, distance))
        return true;

      this.markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed);
      this.setOffsetAtDistanceAroundVertex(vertexSeed, distance);
      vertexSeed.collectMaskedEdgesAroundVertex(this._breakMaskA, true, breakEdges);
      if (OffsetMeshContext.stringDebugFunction !== undefined) {
        OffsetMeshContext.stringDebugFunction(` BREAK EDGES from ${this.inspectMasks(vertexSeed, true, false)}`);
        for (const node of breakEdges) { OffsetMeshContext.stringDebugFunction(this.inspectMasks(node, false, true)); }
      }
      if (breakEdges.length <= 1) {
        // just one smooth sequence.
        // everything is set already.
      } else if (breakEdges.length === 2) {
        // exterior vertex with two incident smooth
        const vectorFromOrigin = this.compute2SectorIntersection(breakEdges[0], breakEdges[1]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
        }
      } else if (breakEdges.length === 3) {
        if (OffsetMeshContext.stringDebugFunction !== undefined)
          OffsetMeshContext.stringDebugFunction(` Vertex Update just ${breakEdges.length} `);
        const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[0], breakEdges[1], breakEdges[2]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
        }
        // simple 3-face corner . . .
      } else {
        // Lots and Lots of edges
        // each set of 3 sectors independently generates an offset for its central sector.
        if (OffsetMeshContext.stringDebugFunction !== undefined)
          OffsetMeshContext.stringDebugFunction(` Vertex Update breakEdges ${breakEdges.length} `);
        vertexSeed.getPoint3d(vertexXYZ);
        for (let i = 0; i + 2 < breakEdges.length; i++) {
          const i0 = i;
          const i1 = (i0 + 1) % breakEdges.length;
          const i2 = (i1 + 1) % breakEdges.length;
          if (this.isInsideSling(breakEdges[i0]))
            continue;
          if (OffsetMeshContext.stringDebugFunction !== undefined)
            OffsetMeshContext.stringDebugFunction(`    Intersection Fixup ${this.inspectMasks(breakEdges[i0])} ${this.inspectMasks(breakEdges[i1])} ${this.inspectMasks(breakEdges[i2])} `);
          const chamferState = this.chamferParse(breakEdges[i0], breakEdges[i1], breakEdges[i2]);
          if (chamferState === 1) {
            const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[i0], breakEdges[i1], breakEdges[i2]);
            if (vectorFromOrigin !== undefined) {
              // Treat all 3 spots as possibly compound sequences
              for (const iOutput of [i0, i1, i2]) {
                this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[iOutput],
                  (node: HalfEdge, properties: SectorOffsetProperties) => {
                    properties.setXYAndZ(vectorFromOrigin);
                    node.setMask(this._offsetCoordinatesAssigned);
                  });
              }
              // Since all three were reset, skip past.  This is done on the acyclic integer that controls the loop.
              i += 2;
            }
          } else if (chamferState === 2) {
            // Let these get updated otherwise . . .
          } else if (chamferState === 3) {
            // Let these get updated otherwise . . .
          } else {
            const vectorFromOrigin = this.compute3SectorIntersectionDebug(breakEdges[i0], breakEdges[i1], breakEdges[i2]);
            if (vectorFromOrigin !== undefined) {
              if (vertexXYZ.distance(vectorFromOrigin) < maxVertexMove) {
                this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[i1],
                  (_node: HalfEdge, properties: SectorOffsetProperties) => {
                    properties.setXYAndZ(vectorFromOrigin);
                  });
              }
            }
          }
        }
      }
      if (OffsetMeshContext.stringDebugFunction !== undefined) {
        const n0 = vertexSeed.countMaskAroundFace(this._offsetCoordinatesAssigned, false);
        const n1 = vertexSeed.countMaskAroundFace(this._offsetCoordinatesAssigned, true);
        const message = `   **** Vertex offset mask counts(TRUE ${n1})(FALSE ${n0})`;
        OffsetMeshContext.stringDebugFunction(message);
      }
      return true;
    });
  }
  private chamferParse(node0: HalfEdge, node1: HalfEdge, node2: HalfEdge): number {
    if (this.isChamferB(node0) && this.isChamferC(node1) && this.isChamferA(node2))
      return 1;
    if (this.isChamferC(node0) && this.isChamferA(node1) && this.isChamferB(node2))
      return 2;
    if (this.isChamferA(node0) && this.isChamferB(node1) && this.isChamferC(node2))
      return 3;
    return 0;
  }
  // return true if this is "first" inside" a chamfer node in CCW sweep
  private isChamferA(node0: HalfEdge): boolean { return node0.isMaskSet(this._insideOfChamferFace); }
  // return true if this is "second" inside" a chamfer node in CCW sweep starting from insideOfChamferFace
  private isChamferB(node0: HalfEdge): boolean { return node0.isMaskSet(this._outsideEndOfChamferFace); }
  // return true if this is "third" node from start at  insideOfChamferFace
  private isChamferC(node0: HalfEdge): boolean { return node0.isMaskSet(this._outsideOfChamferFace); }
  // return true if this is "third" node from start at  insideOfChamferFace
  private isInsideSling(node0: HalfEdge): boolean { return node0.isMaskSet(this._insideEndOfChamferFace); }

  /**
   * * at input:
   *   * Each node points to sectorOffsetProperties with appropriate unit normal
   * * at exit:
   *    * Each sectorOffsetProperties has an offset point computed with consideration of offset planes in the neighborhood.
   * @param distance distance to offset.
   */
  private computeSectorOffsetPointAfterFaceAndChamferOffsets(distance: number) {
    const breakEdges: HalfEdge[] = [];
    this._baseGraph.announceVertexLoops((_graph: HalfEdgeGraph, vertexSeed: HalfEdge) => {
      this.markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed);
      this.setOffsetAtDistanceAroundVertex(vertexSeed, distance);
      vertexSeed.collectMaskedEdgesAroundVertex(this._breakMaskA, true, breakEdges);
      if (breakEdges.length <= 1) {
        // just one smooth sequence.
        // everything is set already.
      } else if (breakEdges.length === 2) {
        // exterior vertex with two incident smooth
        const vectorFromOrigin = this.compute2SectorIntersection(breakEdges[0], breakEdges[1]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
        }
      } else if (breakEdges.length === 3) {
        const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[0], breakEdges[1], breakEdges[2]);
        if (vectorFromOrigin !== undefined) {
          this.setOffsetXYAndZAroundVertex(vertexSeed, vectorFromOrigin);
        }
        // simple 3-face corner . . .
      } else {
        // Lots and Lots of edges
        // each set of 3 sectors independently generates an offset for its central sector.
        // make the array wrap 2 nodes.
        breakEdges.push(breakEdges[0]);
        breakEdges.push(breakEdges[1]);
        for (let i = 0; i + 2 < breakEdges.length; i++) {
          const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[i], breakEdges[i + 1], breakEdges[i + 2]);
          if (vectorFromOrigin !== undefined) {
            this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[i + 1],
              (_node: HalfEdge, properties: SectorOffsetProperties) => {
                properties.setXYAndZ(vectorFromOrigin);
              });
          }
        }
      }
      return true;
    });
  }

}

function _checkMask(node: HalfEdge, mask: HalfEdgeMask, trueReturn: boolean = true, falseReturn: boolean = true) {
  const value = node.isMaskSet(mask);
  if (value)
    return trueReturn;
  else
    return falseReturn;
}
