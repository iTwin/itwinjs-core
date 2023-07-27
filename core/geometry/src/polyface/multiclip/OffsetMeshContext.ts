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
    this.numInactiveSectors = 0; // exterior and sling.
    this.averageNormal = Vector3d.create();
    this.radiansSum = 0.0;
    this.maxDeviationRadiansFromAverage = 0.0;
  }
  public clear() {
    this.numActiveSectors = 0;
    this.numInactiveSectors = 0; // exterior and sling.
    this.averageNormal.setZero();
    this.radiansSum = 0.0;
    this.maxDeviationRadiansFromAverage = 0.0;
  }
  public numActiveSectors: number;
  public numInactiveSectors: number;
  public averageNormal: Vector3d;
  public maxDeviationRadiansFromAverage: number;
  public radiansSum;
  /** Add a normal to the evolving sum, scaled by radians in the corner */
  public accumulateNormal(node: HalfEdge, normal: Vector3d, inactiveMask: HalfEdgeMask) {
    if (node.isMaskSet(inactiveMask)) {
      this.numInactiveSectors++;
    } else {
      const sectorSweepRadians = HalfEdge.sectorSweepRadiansXYZ(node, normal);
      this.averageNormal.addScaledInPlace(normal, sectorSweepRadians);
      this.radiansSum += sectorSweepRadians;
      this.numActiveSectors++;
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
function emitSector(sector: SectorOffsetProperties) {
  if (OffsetMeshContext.stringDebugFunction !== undefined) {
    OffsetMeshContext.stringDebugFunction(`    Sector xyz    ${sector.xyz.x},${sector.xyz.y},${sector.xyz.z} `);
    OffsetMeshContext.stringDebugFunction(`           normal ${sector.normal.x},${sector.normal.y},${sector.normal.z} `);
  }

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
   * @param offsetDistance distance of offset being constructed.  The sign of this resolves angle ambiguity.
   * @param radiansTolerance tolerance for large angle between normals.
   * @returns true if this edge has SectorOffsetProperties on both sides and the angle between normals angle exceeds radiansTolerance.
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
  // Look through the half edge and its vertex successor to properties.  Get the two normals. Return the angle sweeping from one to the next
  public static sweepRadiansAroundNormal(nodeA: HalfEdge, upVector: Vector3d): number | undefined {
    const propsA = nodeA.edgeTag as SectorOffsetProperties;
    const propsB = nodeA.vertexSuccessor.edgeTag as SectorOffsetProperties;
    if (propsA !== undefined && propsB !== undefined) {
      return propsA.normal.planarRadiansTo(propsB.normal, upVector);
    }
    return undefined;
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
/*
About Chamfer Edges ..... as constructed in addChamferTopologyToAllEdges

When edge vertex X to vertex Y has a sharp angle between normals, a "chamfer face" must be created to "fatten" it.

The original half edges (nodes) for the edge are AX and AY.  These are "mates" in the halfEdge mental model. As always,
AX is (as needed)
   (i) the preferred half edge for the left side of the edge moving from X to Y. (i.e. above the edge)
   (ii) a part of the face loop for the face to the left when proceeding CCW around the face to the above the drawn edge
   (iii) a part of the vertex loop around X
Likewise, AY is (as needed)
   (i) the preferred half edge for the left side of the edge moving from Y to X (i.e. below the edge)
   (ii) a part of the face loop for the face to the left of the edge when proceeding CCW around the face below the edge.
   (iii) a part of the vertex loop around Y

      AX------>
X______________________________________________________________________Y
                                                      <---AY

When the chamfer face is created, it needs to have a sliver face "inside the edge" -- something in the space here

      AX------>
  _____________________________________________________________________
 /                                                                     \
X                                                                       Y
 \_____________________________________________________________________/
                                                      <---AY

The chamfer face will have a plane normal is the average of the two faces' plane normals.

The creation sequence for the chamfer face puts a slit "inside the edge" as above   HalfEdges AX and AY remain as parts
of their respective face loops.   In addition, at each end a singleton edge "sling" face is inserted at each
end of the sliver face.

The sequence is:

  STEP 1: splitEdgeCreateSliver creates the sliver face with 2 half edges DX and DY
  STEP 2: splitEdge (with undefined as the "prior" edge) creates a sling with HalfEdge CX "inside" and BX "outside".
             (The sling face is not yet attached to X -- briefly floating in space)
  STEP 3: pinch of HalfEdges BX and DX inserts the sling face "inside" the slit face at the X end.

  Steps 2 and 3 are executed from each end.   Due to the symmetric structure, a 2-pass loop can apply the logic at each end without distinct names in code.

         AX------>
     _______________________________________________________________
    /                                              <---DY           \
   /                                                                 \
  /    BX--->                                                         \
 / _______________                                    _______________  \
| /               \                                  /     <----CY   \ |
|/                 \                                /                 \|
X                   |                              |                   Y
|\   CX--->         /                               \                 /|
| \_______________/                                  \_______________/ |
 \                                                         <---BY     /
  \                                                                   /
   \      DX--->                                                     /
    \ ______________________________________________________________/
                                                    <---AY

During the construction, the letters ABCD are used as above, but with prefixes emphasizing their role
outsideAX, outsideAY
slingB, slingC, sliverD

The "inside" sling faces (CX and CY) each have their own FacetOffsetProperties and SectorOffsetProperties.
The sliver face has its own FacetOffsetProperties which are referenced by DX, BY, DY, BX.
Each of those 4 has its own SectorOffSetProperties.

Important properties during offset construction:
1) the original graph always has original topology and coordinates
2) Each face of the original graph has a FacetOffsetProperties with a representative point and a normal.  These are unchanged during the computation.
3) Each node has its own SectorOffsetProperties with a coordinate and normal independent of the parent node.
   3.1 The first offset coordinates in each node are directly offset by face normal.
   3.2 This creates mismatch across edges and around vertices.
   3.3 Various sweeps "around each vertex" try to do intersections among appropriate offset planes to find
        common coordinates in place of the initial mismatches.
4) The independence of all the sectors allows the offset construction to fix things up in any order it chooses.
5) During the construction, the xyz in SectorOffsetProperties around a single vertex do NOT have to match.
6) At output time, there are three sweeps:
   6.1: By face:  Go around the face and output a facet with the coordinates in the various sectors.
   6.2: By edge: For each edge, if the sector xyz match across both ends output nothing.  If not, output a triangle or quad
   6.3: By vertex:  At each vertex, if all vertex coordinates match  output nothing.   Otherwise output a facet with all the coordinates.
*/
export class OffsetMeshContext {
  private constructor(basePolyface: IndexedPolyface, baseGraph: HalfEdgeGraph,
    options: OffsetMeshOptions) {
    this._basePolyface = basePolyface;
    this._baseGraph = baseGraph;
    this._breakMaskA = baseGraph.grabMask();
    this._breakMaskB = baseGraph.grabMask();

    this._insideOfChamferFace = baseGraph.grabMask();
    this._outsideOfChamferFace = baseGraph.grabMask();
    this._insideChamferSling = baseGraph.grabMask();
    this._outsideEndOfChamferFace = baseGraph.grabMask();
    this._exteriorMask = HalfEdgeMask.EXTERIOR;
    this._offsetCoordinatesReassigned = baseGraph.grabMask();
    this._smoothRadiansBetweenNormals = options.smoothSingleAngleBetweenNormals.radians;
    this._chamferTurnRadians = options.chamferAngleBetweenNormals.radians;
    this._smoothAccumulatedRadiansBetweenNormals = options.smoothAccumulatedAngleBetweenNormals.radians;
  }
  private _basePolyface: IndexedPolyface;
  private _baseGraph: HalfEdgeGraph;
  /** "Exterior" side of a bare edge of the mesh */
  public get exteriorMask(): HalfEdgeMask { return this._exteriorMask; }
  private _exteriorMask: HalfEdgeMask;

  /** Mask indicating a a sector's coordinates have been reassigned at offset distance. */
  private _offsetCoordinatesReassigned: HalfEdgeMask;

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
  public get insideChamferSling(): HalfEdgeMask { return this._insideChamferSling; }
  private _insideChamferSling: HalfEdgeMask;

  /** This is the outside of the end of a chamfer face -- i.e. the inside of a new face-at-vertex */
  public get outsideEndOfChamferFace(): HalfEdgeMask { return this._outsideEndOfChamferFace; }
  private _outsideEndOfChamferFace: HalfEdgeMask;

  // On a CCW vertex loop, the mask sequence at a chamfered edge (which was expanded to a chamfer face) is
  // * the INBOUND edge of the original edge (at its far node !!) _outsideOfChamferFace
  // * the OUTBOUND edge inside the chamfer face has _insideOfChamferFace
  // * the inside of the sling face has _insideChamferSling
  // * the "outside" of the sling face - i.e. inside the chamfer face and at this vertex - has _outsideEndOfChamferFace
  // * the "outside" of the outgoing edge has _outsideOfChamferFace.
  private _smoothRadiansBetweenNormals: number;
  private _smoothAccumulatedRadiansBetweenNormals: number;
  private _chamferTurnRadians: number;
  public static graphDebugFunction?: FacetOffsetGraphDebugFunction;
  public static stringDebugFunction?: FacetOffsetDebugString;

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
      | this._insideChamferSling;
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
      node.isMaskSet(this.insideChamferSling) ? "(sling)" : "",
      node.isMaskSet(this.insideOfChamferFace) ? "(in chamfer)" : "",
      node.isMaskSet(this.outsideEndOfChamferFace) ? "(@sling)" : "",
      node.isMaskSet(this.outsideOfChamferFace) ? "(@chamfer)" : "",
      this.getCoordinateString(node, showXYZ, showFaceSuccessorXYZ),
      "]",
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
            if (!node.isMaskSet(this._insideChamferSling))
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
  private setOffsetAtDistanceAroundVertex(vertexSeed: HalfEdge, distance: number, ignoreChamfers: boolean = false) {
    vertexSeed.sumAroundVertex((nodeAroundVertex: HalfEdge) => {
      const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
      if (props !== undefined) {
        if (ignoreChamfers && this.isInsideChamferOrSling(vertexSeed)) {
          // SKIP !!
        } else {
          props.setOffsetPointAtDistanceAtHalfEdge(nodeAroundVertex, distance);
        }
      }
      return 0.0;
    },
    );
  }

  private setOffsetXYAndZAroundVertex(vertexSeed: HalfEdge, xyz: XYAndZ) {
    vertexSeed.sumAroundVertex((nodeAroundVertex: HalfEdge) => {
      const props = nodeAroundVertex.edgeTag as SectorOffsetProperties;
      if (props !== undefined) {
        props.setXYAndZ(xyz);
        nodeAroundVertex.setMask(this._offsetCoordinatesReassigned);
      }
      return 0.0;
    },
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
    const inactiveNodeMask = this._exteriorMask | this._insideChamferSling;
    vertexSeed.sumAroundVertex((node: HalfEdge) => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData)
        data.accumulateNormal(node, sectorData.normal, inactiveNodeMask);
      return 0.0;
    },
    );
    if (!data.finishNormalAveraging()) {
      return undefined;
    }
    vertexSeed.sumAroundVertex((node: HalfEdge) => {
      const sectorData = node.edgeTag as SectorOffsetProperties;
      if (sectorData)
        data.recordDeviation(sectorData.normal, !node.isMaskSet(inactiveNodeMask));
      return 0.0;
    },
    );
    return data.maxDeviationRadians;
  }

  private assignOffsetByAverageNormalAroundVertex(vertexSeed: HalfEdge,
    maxAllowedDeviationRadians: number,
    data: AverageNormalData,
    distance: number): boolean {
    const maxDeviationRadians = this.computeAverageNormalAndMaxDeviationAroundVertex(vertexSeed, data);
    if (OffsetMeshContext.stringDebugFunction) {
      OffsetMeshContext.stringDebugFunction(`XYZ ${HalfEdge.nodeToIdXYZString(vertexSeed)} Average Normal ${data.averageNormal.toJSON()}`);
      OffsetMeshContext.stringDebugFunction(`           angle ratio ${data.radiansSum / (2 * Math.PI)}   maxDeviation ${data.maxDeviationRadiansFromAverage}`);
    }
    if (maxDeviationRadians !== undefined && maxDeviationRadians <= maxAllowedDeviationRadians) {
      vertexSeed.sumAroundVertex((node: HalfEdge) => {
        SectorOffsetProperties.setNormalAtHalfEdge(node, data.averageNormal, distance);
        return 0;
      });
      return true;
    }
    return false;
  }

  /** Search around a vertex for a sector which has a different normal from its vertexPredecessor.
   * * The seed will be the first candidate considered
  */
  private markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed: HalfEdge) {
    vertexSeed.clearMaskAroundVertex(this._breakMaskA);
    vertexSeed.clearMaskAroundVertex(this._breakMaskB);

    const smoothSingleSmoothRadiansBetweenNormals = this._smoothRadiansBetweenNormals;
    const accumulatedRadiansBetweenNormals = this._smoothAccumulatedRadiansBetweenNormals;

    // Step 1: Examine the edge between nodeA and the sector on its vertex predecessor side.  This (alone) determines single angle breaks.
    let numBreaks = 0;
    let nodeP = vertexSeed;
    let _numSmooth = 0;
    do {
      const nodeQ = nodeP.edgeMate;
      const nodeR = nodeQ.faceSuccessor;    // same as nodeA.vertexPredecessor
      if (nodeP.isMaskSet(this._exteriorMask)) {
        if (!nodeQ.isMaskSet(this._exteriorMask)) {
          nodeR.setMask(this._breakMaskB);
          numBreaks++;
        }
      } else {
        if (nodeP.isMaskSet(this._outsideOfChamferFace)) {
          nodeP.setMask(this._breakMaskA);
        } else if (nodeP.isMaskSet(this._outsideEndOfChamferFace)) {
          nodeP.setMask(this._breakMaskA);
          nodeP.setMask(this._breakMaskB);
        } else if (nodeP.isMaskSet(this._insideChamferSling)) {
          // This is the sling.   It's normal is along edge -- not really a break.
        } else if (nodeP.isMaskSet(this._insideOfChamferFace)) {
          nodeP.setMask(this._breakMaskA);
          nodeP.setMask(this._breakMaskB);
          nodeR.setMask(this._breakMaskB);
        } else if (nodeQ.isMaskSet(this._exteriorMask)) {
          numBreaks++;
          nodeP.setMask(this._breakMaskA);
        } else if (!SectorOffsetProperties.almostEqualNormals(
          nodeP.edgeTag as SectorOffsetProperties,
          nodeR.edgeTag as SectorOffsetProperties,
          smoothSingleSmoothRadiansBetweenNormals)) {
          nodeP.setMask(this._breakMaskA);
          numBreaks++;
          nodeR.setMask(this._breakMaskB);
        } else {
          _numSmooth++;
        }
      }
      nodeP = nodeP.vertexSuccessor;
    } while (nodeP !== vertexSeed);
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
    const nodeAStart = nodeP.findMaskAroundVertex(this._breakMaskA);
    if (nodeAStart !== undefined) {
      nodeP = nodeAStart;
      do {
        if (nodeP.isMaskSet(this._breakMaskA) && !nodeP.isMaskSet(this._breakMaskB)) {
          let accumulatedRadians = 0.0;
          do {
            const nodeB = nodeP.vertexSuccessor;
            accumulatedRadians += SectorOffsetProperties.radiansBetweenNormals(
              nodeP.edgeTag as SectorOffsetProperties,
              nodeB.edgeTag as SectorOffsetProperties,
            );
            if (accumulatedRadians > accumulatedRadiansBetweenNormals) {
              nodeP.setMask(this._breakMaskB);
              nodeB.setMask(this._breakMaskA);
              numBreaks++;
              accumulatedRadians = 0.0;
            }
            nodeP = nodeB;
          } while (!nodeP.isMaskSet(this._breakMaskB));
        } else {
          nodeP = nodeP.vertexSuccessor;
        }
      } while (nodeP !== nodeAStart);
    }

    if (numBreaks > 0 && nodeAStart !== undefined) {
      // In each compound sector, accumulate and install average normal.
      nodeP = nodeAStart;
      const averageNormal = Vector3d.create();
      const edgeVectorU = Vector3d.create();
      const edgeVectorV = Vector3d.create();
      averageNormal.setZero();
      do {
        if (nodeP.isMaskSet(this._breakMaskA) && !nodeP.isMaskSet(this._breakMaskB)) {
          let nodeQ = nodeP;
          averageNormal.setZero();
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
            nodeQ = nodeP;
            for (; ;) {
              SectorOffsetProperties.setNormalAtHalfEdge(nodeQ, averageNormal);
              if (nodeQ.isMaskSet(this._breakMaskB))
                break;
              nodeQ = nodeQ.vertexSuccessor;
            }
          }
        }
        nodeP = nodeP.vertexSuccessor;
      } while (nodeP !== nodeAStart);

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
    const sectorA = nodeA.edgeTag as SectorOffsetProperties;
    const sectorB = nodeB.edgeTag as SectorOffsetProperties;
    const sectorC = nodeC.edgeTag as SectorOffsetProperties;
    if (OffsetMeshContext.stringDebugFunction !== undefined) {
      OffsetMeshContext.stringDebugFunction(`compute3${this.inspectMasks(nodeA)}${this.inspectMasks(nodeB)}${this.inspectMasks(nodeC)} `);
      for (const sector of [sectorA, sectorB, sectorC])
        emitSector(sector);
    }

    const vector = SmallSystem.intersect3Planes(
      sectorA.xyz, sectorA.normal,
      sectorB.xyz, sectorB.normal,
      sectorC.xyz, sectorC.normal,
      result);

    if (OffsetMeshContext.stringDebugFunction !== undefined) {
      if (vector === undefined)
        OffsetMeshContext.stringDebugFunction(" NO INTERSECTION");
      else
        OffsetMeshContext.stringDebugFunction(` ComputedVector ${vector.x},${vector.y},${vector.z} `);
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
   *    * new "chamfer faces" are added outside of edges with angle between normal sin excess of options.chamferTurnAngleBetweenNormals
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
    const chamferRadians = options.chamferAngleBetweenNormals.radians;
    const vertexXYZ = Point3d.create();  // reuse
    const edgeVector = Vector3d.create();  // reuse
    const outwardEdgeVector = Vector3d.create(); // reuse
    const averageNormal = Vector3d.create(); // reuse
    // collect all the edges with sharp turn angle.
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
    //  outsideA is the HalfEdge labeled A in the diagram.
    // sliverDX and sliverDY are the edges "inside the sliver" at the respective X and Y ends.
    for (const outsideA of edgesToChamfer) {
      // remark: this recomputes as in collection round.
      if (SectorOffsetProperties.edgeHasLargeExteriorAngleBetweenNormals(outsideA, edgeVector, averageNormal, chamferRadians)) {
        // This copies coordinates and vertex id .... sectorOffsetProperties are delayed until late in the 2-pass loop below.
        // The returned HalfEdge is labeled D in the diagram
        const sliverDX = this._baseGraph.splitEdgeCreateSliverFace(outsideA);
        const sliverDY = sliverDX.facePredecessor;
        const offsetPoint = sliverDX.getPoint3d();
        offsetPoint.addScaledInPlace(averageNormal, distance);
        const ray = Ray3d.createCapture(offsetPoint, averageNormal.clone());
        const facetProperties = new FacetOffsetProperties(-1, ray);
        // for each side (hence end) of the sliver face, set mask and install a sling loop for the anticipated end of the chamfer face
        // new node names in the loop omit X or Y suffix because that is implied by which pass is running.
        let s = -1.0;
        for (const sliverD of [sliverDX, sliverDY]) {
          edgeVector.scale(s, outwardEdgeVector);
          sliverD.getPoint3d(vertexXYZ);
          sliverD.setMask(this._insideOfChamferFace);
          sliverD.edgeMate.setMask(this._outsideOfChamferFace);
          // mark and reference the chamfer face.
          sliverD.faceTag = facetProperties;
          // sling at this end
          const slingB = this._baseGraph.splitEdge(undefined, vertexXYZ.x, vertexXYZ.y, vertexXYZ.z, sliverD.i);
          const slingC = slingB.edgeMate;
          slingB.setMask(this._outsideEndOfChamferFace);
          slingB.faceTag = facetProperties;
          slingC.setMask(this._insideChamferSling);
          HalfEdge.pinch(sliverD, slingB);
          const endNormal = Ray3d.create(vertexXYZ, outwardEdgeVector);  // clones the inputs
          const slingFaceProperties = new FacetOffsetProperties(-1, endNormal);
          slingC.faceTag = slingFaceProperties;
          // initialize sectors with existing vertex point.
          sliverD.edgeTag = new SectorOffsetProperties(averageNormal.clone(), offsetPoint.clone());
          slingB.edgeTag = new SectorOffsetProperties(averageNormal.clone(), offsetPoint.clone());
          slingC.edgeTag = new SectorOffsetProperties(outwardEdgeVector.clone(), vertexXYZ.clone());
          // OffsetMeshContext.stringDebugFunction("Chamfer Setup");
          const chamferPointE = this.compute3SectorIntersection(sliverD, sliverD.edgeMate, slingC);
          const chamferPointF = this.compute3SectorIntersection(slingB, slingB.vertexSuccessor, slingC);
          // sliverD.edgeTag = new SectorOffsetProperties(averageNormal.clone(), vertexXYZ.clone());
          SectorOffsetProperties.setXYZAtHalfEdge(sliverD, chamferPointE);
          SectorOffsetProperties.setXYZAtHalfEdge(slingB, chamferPointF);
          s *= -1.0;
        }
      }
    }
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
    const chamferXYZ = Point3d.create();
    const maxVertexMove = 2.0 * distance;
    const averageNormalData = new AverageNormalData();
    const maxAllowedNormalDeviationRadians = Angle.degreesToRadians(25.0);
    //
    // FOR EACH VERTEX
    //
    this._baseGraph.announceVertexLoops((_graph: HalfEdgeGraph, vertexSeedA: HalfEdge) => {
      // reposition to an important vertex.
      // first choice: a chamfer face.
      let vertexSeed = vertexSeedA.findMaskAroundVertex(this._outsideEndOfChamferFace);
      if (vertexSeed === undefined)
        vertexSeed = vertexSeedA.findMaskAroundVertex(this._breakMaskA);
      if (vertexSeed === undefined)
        vertexSeed = vertexSeedA;
      if (OffsetMeshContext.stringDebugFunction !== undefined) {
        OffsetMeshContext.stringDebugFunction("");
        OffsetMeshContext.stringDebugFunction(` VERTEX LOOP   ${vertexSeed.getPoint3d().toJSON()} `);
        vertexSeed.sumAroundVertex(
          (node: HalfEdge) => { OffsetMeshContext.stringDebugFunction!(this.inspectMasks(node, false, true)); return 0; });
      }
      // Take care of the easiest vertices directly . . . note that this returns from the lambda, not computeOffsetFacetIntersections
      if (this.assignOffsetByAverageNormalAroundVertex(vertexSeed, maxAllowedNormalDeviationRadians, averageNormalData, distance))
        return true;

      this.markBreakEdgesAndSaveAverageNormalsAroundVertex(vertexSeed);
      this.setOffsetAtDistanceAroundVertex(vertexSeed, distance, true);
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
        // Pass 1 -- look for intersection among multiple chamfers
        for (let i = 0; i < breakEdges.length; i++) {
          const i0 = i;
          const i1 = (i0 + 1) % breakEdges.length;
          const i2 = (i1 + 1) % breakEdges.length;

          if (breakEdges[i0].isMaskSet(this._outsideEndOfChamferFace)
            && breakEdges[i1].isMaskSet(this._outsideOfChamferFace)
            && breakEdges[i2].isMaskSet(this._insideOfChamferFace)) {
            if (OffsetMeshContext.stringDebugFunction !== undefined)
              OffsetMeshContext.stringDebugFunction(`    ChamferChamfer Fixup ${this.inspectMasks(breakEdges[i0])} ${this.inspectMasks(breakEdges[i1])} ${this.inspectMasks(breakEdges[i2])} `);
            const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[i0], breakEdges[i1], breakEdges[i2]);
            if (vectorFromOrigin !== undefined) {
              // Treat all 3 spots as possibly compound sequences
              for (const iOutput of [i0, i1, i2]) {
                this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[iOutput],
                  (node: HalfEdge, properties: SectorOffsetProperties) => {
                    properties.setXYAndZ(vectorFromOrigin);
                    node.setMask(this._offsetCoordinatesReassigned);
                  });
              }
              // Since all three were reset, skip past.  This is done on the acyclic integer that controls the loop.
              i += 2;
            }
          }
        }

        // Pass 2 -- look for unassigned nodes just before or after a chamfer.
        //  The chamfer wins
        for (let i = 0; i < breakEdges.length; i++) {
          const i0 = i;
          const i1 = (i0 + 1) % breakEdges.length;
          if (this.isInsideSling(breakEdges[i0], breakEdges[i1]))
            continue;
          if (!this.isOffsetAssigned(breakEdges[i0])
            && breakEdges[i1].isMaskSet(this.insideOfChamferFace)) {
            this.transferXYZFromNodeToSmoothSector(breakEdges[i1], breakEdges[i0], "push left from chamfer", chamferXYZ);
          } else if (!this.isOffsetAssigned(breakEdges[i1])
            && breakEdges[i0].isMaskSet(this.outsideEndOfChamferFace)) {
            this.transferXYZFromNodeToSmoothSector(breakEdges[i0], breakEdges[i1], "push right from chamfer", chamferXYZ);
          }

        }

        // Pass 3 -- look for unassigned nodes as middle of 3-face intersections
        for (let i = 0; i < breakEdges.length; i++) {
          const i0 = i;
          const i1 = (i0 + 1) % breakEdges.length;
          const i2 = (i1 + 1) % breakEdges.length;
          if (this.isInsideSling(breakEdges[i0], breakEdges[i1], breakEdges[i2]))
            continue;
          if (this.isOffsetAssigned(breakEdges[i1]))
            continue;
          if (OffsetMeshContext.stringDebugFunction !== undefined)
            OffsetMeshContext.stringDebugFunction(`    Intersection Fixup ${this.inspectMasks(breakEdges[i0])} ${this.inspectMasks(breakEdges[i1])} ${this.inspectMasks(breakEdges[i2])} `);
          const vectorFromOrigin = this.compute3SectorIntersection(breakEdges[i0], breakEdges[i1], breakEdges[i2]);
          if (vectorFromOrigin !== undefined) {
            if (vertexXYZ.distance(vectorFromOrigin) < maxVertexMove) {
              this.announceNodeAndSectorPropertiesInSmoothSector(breakEdges[i1],
                (node: HalfEdge, properties: SectorOffsetProperties) => {
                  properties.setXYAndZ(vectorFromOrigin);
                  node.setMask(this._offsetCoordinatesReassigned);
                });
            }
          }
        }
      }
      if (OffsetMeshContext.stringDebugFunction !== undefined) {
        const n0 = vertexSeed.countMaskAroundVertex(this._offsetCoordinatesReassigned, false);
        const n1 = vertexSeed.countMaskAroundVertex(this._offsetCoordinatesReassigned, true);
        const message = `   **** Vertex offset mask counts(TRUE ${n1})(FALSE ${n0})`;
        OffsetMeshContext.stringDebugFunction(message);
      }
      return true;
    });
  }
  // return true if any of these nodes is "inside" the sling at the end of a chamfer.
  private isInsideSling(node0: HalfEdge,
    node1?: HalfEdge,
    node2?: HalfEdge): boolean {
    return node0.isMaskSet(this._insideChamferSling)
      || (node1 !== undefined && node1.isMaskSet(this._insideChamferSling))
      || (node2 !== undefined && node2.isMaskSet(this._insideChamferSling));
  }
  // return true if any of these nodes is "inside" the sling at the end of a chamfer.
  private isInsideChamferOrSling(node0: HalfEdge): boolean {
    return node0.isMaskSet(this._insideChamferSling)
      || node0.isMaskSet(this._insideOfChamferFace)
      || node0.isMaskSet(this._outsideEndOfChamferFace);
  }
  private isOffsetAssigned(node0: HalfEdge,
    node1?: HalfEdge,
    node2?: HalfEdge): boolean {
    return node0.isMaskSet(this._offsetCoordinatesReassigned)
      || (node1 !== undefined && node1.isMaskSet(this._offsetCoordinatesReassigned))
      || (node2 !== undefined && node2.isMaskSet(this._offsetCoordinatesReassigned));
  }

  /**
   *
   * @param sourceNode node with good xyz
   * @param destinationStartNode first of a sequence of nodes to set (delimited by masks)
   * @param description string for debug
   * @param workPoint point to use for coordinate transfer.
   */
  private transferXYZFromNodeToSmoothSector(
    sourceNode: HalfEdge,
    destinationStartNode: HalfEdge,
    description: string,
    workPoint: Point3d,
  ) {
    if (OffsetMeshContext.stringDebugFunction !== undefined)
      OffsetMeshContext.stringDebugFunction(`    ${description} ${this.inspectMasks(sourceNode)} to ${this.inspectMasks(destinationStartNode)}} `);
    SectorOffsetProperties.getSectorPointAtHalfEdge(sourceNode, workPoint, undefined);
    this.announceNodeAndSectorPropertiesInSmoothSector(destinationStartNode,
      (node: HalfEdge, properties: SectorOffsetProperties) => {
        properties.setXYAndZ(workPoint);
        node.setMask(this._offsetCoordinatesReassigned);
      });
  }
}
