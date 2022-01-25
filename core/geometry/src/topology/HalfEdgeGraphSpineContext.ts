/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Topology
 */
import { Geometry } from "../Geometry";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "./Graph";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { HalfEdgeGraphMerge } from "./Merging";
import { Triangulator } from "./Triangulation";
import { RegularizationContext } from "./RegularizeFace";
import { HalfEdgeGraphSearch, HalfEdgeMaskTester } from "./HalfEdgeGraphSearch";
import { Angle } from "../geometry3d/Angle";
// cSpell:disable
// const sSpineRelTol = 1.0e-8;
// const sSpineGraphAbsTol = 0.0;
// const sSpineGraphRelTol = 1.0e-10;

function createNPoints(n: number): Point3d[] {
  const points = [];
  for (let i = 0; i < n; i++)
    points.push(Point3d.create(0, 0, 0));
  return points;
}
function createNVectors(n: number): Vector3d[] {
  const points = [];
  for (let i = 0; i < n; i++)
    points.push(Vector3d.create(0, 0, 0));
  return points;
}
// Local struct to pair a graph node with a double as a sort key for std::sort
class NodeSortKey {
  private _a: number;
  private _node: HalfEdge;
  public get node() { return this._node; }

  public constructor(node: HalfEdge, b: number) {
    this._node = node;
    this._a = b;
  }
  public static compareForSort(dataA: NodeSortKey, dataB: NodeSortKey): number { return dataA._a - dataB._a; }
}

/**
 * Context manager to hold a vu graph and do spine operations
 *
 * Spine calculations determine both (a) a "skeletal" network of linework that follows the interior
 *      path through within the boundaries, and (b) a block decomposition into quads and triangles.
 *
 * Usage pattern:
 * ```
 *    const sc = new HalfEdgeGraphSpineContext();
 *   // Data setup ....
 *    foreach polygon or polyline
 *        {
 *        sc.InsertEdges (edgePoints, bClosed)
 *        }
 *   // Analysis steps ...
 *     * bParity = true to treat the data as a "polygon".  The interior is determined by parity rules
 *                   and the triangulation and spine are only constructed "inside"
 *     * bParity = false if "all" spaces are to be triangulated and spined.
 *     * minSplitRadians -- suggested value 0.3.  If this value is large, it will encourage add internal
 *     *     edges from a vertex to an edge 'across' the polygon even if it creates small angles.
 *     * minDiagonalAngle -- suggested value 1.0.  If this value is large (up to about 1.5 as max) it favors
 *     *     using triangles to navigate turns.  If it is small, it favors using skewed quadrilaterals.
 *    sc.TriangulateForSpine (bParity, minSplitRadians)
 *    sc.MarkBoxes (true, minDiagonalAngle);
 *    edges = sc.GetSpineEdges ();
 * ```
 * @internal
 */
export class HalfEdgeGraphSpineContext {
  /** The Evolving graph */
  private _spineGraph: HalfEdgeGraph;
  /** mask marking edges that have been paired into quads */
  private _diagonalMask: HalfEdgeMask;
  private _boxMask: HalfEdgeMask;
  public get graph() { return this._spineGraph; }
  /**
   * Create a context with an empty graph.
   * * Reserve masks for specialized markup.
   */
  public constructor() {
    this._spineGraph = new HalfEdgeGraph();
    // vu_setTol (_spineGraph, sSpineGraphAbsTol, sSpineGraphRelTol);
    this._diagonalMask = this._spineGraph.grabMask();
    this._boxMask = this._spineGraph.grabMask();
  }

  /**
   * Release resources to the graph.
   */
  public teardown() {
    this._spineGraph.dropMask(this._diagonalMask);
    this._spineGraph.dropMask(this._boxMask);
    this._spineGraph.decommission();
  }

  //  an edge (as new bvector<DPoint3d> at back, with cloned points>
  private addEdge(xyzOut: Point3d[][], xyzA: Point3d, xyzB: Point3d) {
    const newArray = [];
    newArray.push(xyzA.clone());
    newArray.push(xyzB.clone());
    xyzOut.push(newArray);
  }

  private getBoxCorners(diagonalNode: HalfEdge,
    nodes: HalfEdge[],
    points: Point3d[]): boolean {
    const diagonalMate = diagonalNode.edgeMate;
    nodes.length = 0;
    points.length = 0;
    if (!diagonalNode.getMask(HalfEdgeMask.BOUNDARY_EDGE)
      && diagonalNode.countEdgesAroundFace() === 3
      && diagonalMate.countEdgesAroundFace() === 3) {
      const nodeA = diagonalMate.faceSuccessor;
      nodes.push(nodeA);
      nodes.push(nodeA.faceSuccessor);
      const nodeB = diagonalNode.faceSuccessor;
      nodes.push(nodeB);
      nodes.push(nodeB.faceSuccessor);
      for (let i = 0; i < 4; i++)
        points.push(Point3d.create(nodes[i].x, nodes[i].y));
      return true;
    }
    return false;
  }

  // Compute bisectors of the quad.
  // function key is the smaller absolute angle between the bisectors.
  // (pi/2 is max possible value).
  private diagonalKeyFunc(pDiagonalNode: HalfEdge): number {

    const nodes: HalfEdge[] = [];
    const points: Point3d[] = [];
    if (this.getBoxCorners(pDiagonalNode, nodes, points)) {
      const xyzA = points[0];
      const xyzB = points[1];
      const xyzC = points[2];
      const xyzD = points[3];
      const xyzAB = xyzA.interpolate(0.5, xyzB);
      const xyzBC = xyzB.interpolate(0.5, xyzC);
      const xyzCD = xyzC.interpolate(0.5, xyzD);
      const xyzDA = xyzD.interpolate(0.5, xyzA);

      const vectorAB = Vector3d.createStartEnd(xyzA, xyzB);
      const vectorBC = Vector3d.createStartEnd(xyzB, xyzC);
      const vectorCD = Vector3d.createStartEnd(xyzC, xyzD);
      const vectorDA = Vector3d.createStartEnd(xyzD, xyzA);

      const vectorABToCD = Vector3d.createStartEnd(xyzCD, xyzAB);
      const vectorBCToDA = Vector3d.createStartEnd(xyzDA, xyzBC);
      vectorABToCD.z = 0.0;
      vectorBCToDA.z = 0.0;
      const thetaAB = vectorABToCD.smallerUnorientedAngleTo(vectorAB).radians;
      const thetaBC = vectorBCToDA.smallerUnorientedAngleTo(vectorBC).radians;
      const thetaCD = vectorABToCD.smallerUnorientedAngleTo(vectorCD).radians;
      const thetaDA = vectorBCToDA.smallerUnorientedAngleTo(vectorDA).radians;

      const alpha = thetaAB < thetaCD ? thetaAB : thetaCD;
      const beta = thetaBC < thetaDA ? thetaBC : thetaDA;
      return alpha < beta ? alpha : beta;
    }

    return Number.NEGATIVE_INFINITY;
  }

  // Select a branch point in a triangle.
  // This may be the centroid or the midpoint of an edge joining midpoints of a pair of edges.
  private selectTriangleInteriorPoint(pXYZ: Point3d[]): Point3d {

    const xyz = createNPoints(6);
    const xyzMid = createNPoints(6);     // Midpoints of each edge.
    const interiorCandidate = createNPoints(4);   // for i in {012}, [i] is midpoint of midpoint[i+1] and midpoint[i+2].
    // [3] is centroid.
    const edgeVector = createNVectors(6);
    const centroid = Point3d.create();
    for (let i = 0; i < 3; i++) {
      xyz[i] = xyz[i + 3] = pXYZ[i];
      centroid.addInPlace(xyz[i]);
    }
    centroid.scaleInPlace(1.0 / 3.0);

    // Edge midpoints ...
    for (let i = 0; i < 3; i++) {
      xyzMid[i] = xyz[i].interpolate(0.5, xyz[i + 1]);
      xyzMid[i + 3] = xyzMid[i];
      edgeVector[i] = Vector3d.createStartEnd(xyz[i], xyz[i + 1]);    // use wraparound
      edgeVector[i + 3] = edgeVector[i];
    }

    // Midpoints of midpoint-to-midpoint connections ..
    for (let i = 0; i < 3; i++) {
      const i1 = i + 1;
      const i2 = i + 2;
      interiorCandidate[i] = xyzMid[i1].interpolate(0.5, xyzMid[i2]);
    }

    interiorCandidate[3] = centroid;

    let bestAngle = Number.NEGATIVE_INFINITY;
    let bestIndex = -1;
    const theta: number[] = [0, 0, 0];
    let thetaMin;
    for (let k: number = 0; k < 4; k++) {
      // Measure angles from edge midpoints towards interior candidate.
      thetaMin = Number.POSITIVE_INFINITY;
      for (let i: number = 0; i < 3; i++) {
        const edgeToInterior = Vector3d.createStartEnd(xyzMid[i], interiorCandidate[k]);
        theta[i] = edgeVector[i].smallerUnorientedAngleTo(edgeToInterior).radians;
        if (theta[i] < thetaMin)
          thetaMin = theta[i];
      }
      if (thetaMin > bestAngle) {
        bestAngle = thetaMin;
        bestIndex = k;
      }
    }
    return interiorCandidate[bestIndex];
  }

  private markBox(pA: HalfEdge): void {

    const pB = pA.edgeMate;
    pA.setMask(this._diagonalMask);
    pB.setMask(this._diagonalMask);
    pA.setMaskAroundFace(this._boxMask);
    pB.setMaskAroundFace(this._boxMask);
  }

  private setSortedDiagonalMasks(minA: number): number {

    const candidates: NodeSortKey[] = [];
    let numDiagonal = 0;
    for (const node of this._spineGraph.allHalfEdges) {
      const b = this.diagonalKeyFunc(node);
      if (b > minA)
        candidates.push(new NodeSortKey(node, b));
    }

    candidates.sort(NodeSortKey.compareForSort);

    let key;
    while (undefined !== (key = candidates.pop())) {
      const pA = key.node;
      const pB = pA.edgeMate;
      if (!pA.getMask(this._boxMask)
        && !pB.getMask(this._boxMask)) {
        this.markBox(pA);
        numDiagonal++;
      }
    }
    return numDiagonal;
  }

  /// <param name="xyzA">Vertex whose angle is being split</param>
  private splitOK(xyzA: Point3d, xyzB: Point3d, xyzQ: Point3d, xyzC: Point3d, minAngle: number): boolean {

    const vectorAB = Vector3d.createStartEnd(xyzA, xyzB);
    const vectorAQ = Vector3d.createStartEnd(xyzA, xyzQ);
    const vectorAC = Vector3d.createStartEnd(xyzA, xyzC);
    const angleBAQ = vectorAB.angleToXY(vectorAQ).radians;
    const angleQAC = vectorAQ.angleToXY(vectorAC).radians;
    return Math.abs(angleBAQ) > minAngle && Math.abs(angleQAC) > minAngle;
  }

  // Search a triangulation for vertices which have
  //   (a) pre-split angle greater than 90 degrees
  // (b) the opposite edge is a boundary.
  //  (c) each post split angle is less than minSplitRadians
  // Drop a perpenedicular to that boundary.
  // return the number of edges added.
  private addPerpendicularsToBoundaries(minSplitRadians: number, minCandidateRadians: number): number {

    let numAdd = 0;
    for (const pA of this._spineGraph.allHalfEdges) {
      const pB = pA.faceSuccessor;
      const pC = pB.faceSuccessor;
      if (!pA.getMask(HalfEdgeMask.EXTERIOR)
        && !pA.getMask(HalfEdgeMask.BOUNDARY_EDGE)   // ?? prevent deep recursion
        && !pC.getMask(HalfEdgeMask.BOUNDARY_EDGE)   // ?? prevent deep recursion
        && pB.getMask(HalfEdgeMask.BOUNDARY_EDGE)
        && pC.faceSuccessor === pA
      ) {
        const vectorAB = pA.getVector2dAlongEdge();
        const vectorBC = pB.getVector2dAlongEdge();
        const vectorCA = pC.getVector2dAlongEdge();
        const candidateRadians = Math.PI - vectorCA.angleTo(vectorAB).radians;
        // const candidateDot = vectorCA.DotProduct (vectorAB);
        if (candidateRadians > minCandidateRadians) { // vectorCA.DotProduct (vectorAB) > 0.0)
          const bb = vectorBC.dotProduct(vectorBC);
          const ba = -vectorBC.dotProduct(vectorAB);
          const s = Geometry.conditionalDivideFraction(ba, bb);
          if (s !== undefined && s > 0.0 && s < 1.0) {
            const xyzA = pA.getPoint3d();
            const xyzB = pB.getPoint3d();
            const xyzC = pC.getPoint3d();
            const xyzE = xyzB.interpolate(s, xyzC);
            if (this.splitOK(xyzA, xyzB, xyzE, xyzC, minSplitRadians)) {
              const pE = this._spineGraph.splitEdgeAtFraction(pB, s);
              const pA1 = this._spineGraph.createEdgeHalfEdgeHalfEdge(pA, 0, pE, 0);
              pA1.setXYZFrom(pA);
              pE.setXYZAroundVertex(xyzE.x, xyzE.y, xyzE.z);
              numAdd++;
            }
          }
        }
      }
    }
    return numAdd;
  }

  private getSpineEdgesInQuad(
    pFace: HalfEdge,
    xyzOut: Point3d[][],
    bIncludeInterior: boolean,
    // true to include the edge to boundary when the qued is a dead end.
    bIncludeFinal: boolean,
    // true to include the two adjacent edges to boundary if the quad is at a corner.
    bIncludeCornerSpokes: boolean): boolean {

    if (pFace.countEdgesAroundFace() !== 4)
      return false;
    const pNode: HalfEdge[] = [];
    const xyz = createNPoints(8);
    const midpoint = createNPoints(8);
    pNode[0] = pNode[4] = pFace;
    pNode[1] = pNode[5] = pNode[0].faceSuccessor;
    pNode[2] = pNode[6] = pNode[1].faceSuccessor;
    pNode[3] = pNode[7] = pNode[2].faceSuccessor;
    let numBoundary = 0;
    let numInterior = 0;
    const iBoundary: number[] = [];
    const iInterior: number[] = [];
    const bIsBoundary: boolean[] = [];
    const centroid = Point3d.create();
    for (let i: number = 0; i < 4; i++) {
      bIsBoundary[i] = 0 !== pNode[i].getMask(HalfEdgeMask.BOUNDARY_EDGE);
      if (pNode[i].getMask(HalfEdgeMask.BOUNDARY_EDGE))
        iBoundary[numBoundary++] = i;
      else
        iInterior[numInterior++] = i;
      xyz[i] = pNode[i].getPoint3d();
      xyz[i + 4] = xyz[i];
      centroid.addInPlace(xyz[i]);
    }
    for (let i: number = 0; i < 4; i++) {
      midpoint[i] = xyz[i].interpolate(0.5, xyz[i + 1]);
      midpoint[i + 4] = midpoint[i];
    }

    centroid.scaleInPlace(0.25);
    if (numBoundary === 0 || numBoundary === 1) {
      for (let i: number = 0; i < numInterior; i++)
        if (bIncludeInterior)
          this.addEdge(xyzOut, midpoint[iInterior[i]], centroid);
    } else if (numBoundary === 4) {
      for (let i: number = 0; i < numBoundary; i++)
        if (bIncludeFinal)
          this.addEdge(xyzOut, midpoint[i], centroid);
    } else if (numBoundary === 2) {
      if (iInterior[1] === iInterior[0] + 2) {
        // Spine enters one end, exits the other ..
        if (bIncludeInterior)
          this.addEdge(xyzOut, midpoint[iInterior[0]], midpoint[iInterior[1]]);
      } else {
        // Block sits as exterior corner.  Let the two spines continue to their opposite faces ..
        for (let i: number = 0; i < 4; i++)
          if ((bIsBoundary[i] && bIncludeCornerSpokes)
            || (!bIsBoundary[i] && bIncludeInterior))
            this.addEdge(xyzOut, midpoint[i], centroid);
      }
    } else if (numBoundary === 3) {
      if (bIncludeInterior)
        this.addEdge(xyzOut, midpoint[iInterior[0]], centroid);
      if (bIncludeFinal)
        this.addEdge(xyzOut, centroid, midpoint[iInterior[0] + 2]);
    }
    return true;
  }

  private getSpineEdgesInTriangle(
    pFace: HalfEdge, xyzOut: Point3d[][],
    bIncludeInterior: boolean,
    bIncludeFinal: boolean): boolean {

    if (pFace.countEdgesAroundFace() !== 3)
      return false;
    let n = 0;
    const xyzMidpoint = createNPoints(6);
    const xyz = createNPoints(6);
    const xyzCentroid = Point3d.createZero();
    const isBoundary: boolean[] = [];
    let numBoundary = 0;
    let lastBoundary = -1;
    let lastInterior = -1;
    let currentEdge = pFace;
    do {
      xyz[n] = currentEdge.getPoint3d();
      xyzCentroid.addInPlace(xyz[n]);
      isBoundary[n] = false;
      if (currentEdge.getMask(HalfEdgeMask.BOUNDARY_EDGE)) {
        isBoundary[n] = true;
        numBoundary++;
        lastBoundary = n;
      } else {
        lastInterior = n;
      }
      xyz[n + 3] = xyz[n];
      isBoundary[n + 3] = isBoundary[n];
      n++;
    } while ((currentEdge = currentEdge.faceSuccessor) !== pFace);

    for (let i: number = 0; i < 3; i++) {
      xyzMidpoint[i] = xyz[i].interpolate(0.5, xyz[i + 1]);
      xyzMidpoint[i + 3] = xyzMidpoint[i];
    }

    xyzCentroid.scaleInPlace(1.0 / 3.0);

    if (numBoundary === 0) {
      // Interior branch
      const xyzInterior = this.selectTriangleInteriorPoint(xyz);
      if (bIncludeInterior) {
        this.addEdge(xyzOut, xyzMidpoint[0], xyzInterior);
        this.addEdge(xyzOut, xyzMidpoint[1], xyzInterior);
        this.addEdge(xyzOut, xyzMidpoint[2], xyzInterior);
      }
    } else if (numBoundary === 1) {
      if (bIncludeInterior)
        this.addEdge(xyzOut, xyzMidpoint[lastBoundary + 1], xyzMidpoint[lastBoundary + 2]);
    } else if (numBoundary === 2) {
      if (bIncludeFinal && lastInterior >= 0)
        this.addEdge(xyzOut, xyzMidpoint[lastInterior], xyz[lastInterior + 2]);
    } else if (numBoundary === 3) {
      const xyzInterior = this.selectTriangleInteriorPoint(xyz);
      if (bIncludeFinal) {
        this.addEdge(xyzOut, xyzMidpoint[0], xyzInterior);
        this.addEdge(xyzOut, xyzMidpoint[1], xyzInterior);
        this.addEdge(xyzOut, xyzMidpoint[2], xyzInterior);
      }
    }
    return true;
  }

  /** Add a polyline to the graph.
   * * This may be called multiple times
   */
  public insertEdges(xyzIn: Point3d[], bClosed: boolean): void {
    let pPreviousB, pFirstA;
    for (let i: number = 1; i < xyzIn.length; i++) {
      const nodeA = this._spineGraph.createEdgeXYZXYZ(
        xyzIn[i - 1].x, xyzIn[i - 1].y, 0, 0,
        xyzIn[i].x, xyzIn[i].y, 0, 0);
      const nodeB = nodeA.faceSuccessor;
      nodeA.setMask(HalfEdgeMask.BOUNDARY_EDGE);
      nodeB.setMask(HalfEdgeMask.BOUNDARY_EDGE);
      if (pPreviousB === undefined) {
        pFirstA = nodeA;
      } else {
        HalfEdge.pinch(pPreviousB, nodeA);
      }
      pPreviousB = nodeB;
    }
    if (bClosed && pFirstA !== undefined && pPreviousB !== undefined)
      HalfEdge.pinch(pPreviousB, pFirstA);
  }
  /**
   * Look for trivial (2 edge) faces that have exteriorMask and non-masked on both sides.
   * * clear the mask
   * @param exteriorMask
   */
  private purgeNullFaces(exteriorMask: HalfEdgeMask) {
    for (const nodeA of this._spineGraph.allHalfEdges) {
      const nodeB = nodeA.faceSuccessor;
      const nodeC = nodeB.faceSuccessor;
      if (nodeB !== nodeA && nodeC === nodeA) {
        if (nodeA.getMask(exteriorMask) && nodeB.getMask(exteriorMask)) {
          const mateA = nodeA.edgeMate;
          const mateB = nodeB.edgeMate;
          if (!mateA.getMask(exteriorMask) && !mateB.getMask(exteriorMask)) {
            nodeA.clearMask(exteriorMask);
            nodeB.clearMask(exteriorMask);
          }
        }
      }
    }
  }
  private static _regularize1 = true;
  private static _regularize2 = false;
  /**
   * Triangulate the graph for the edges that have been inserted.
   * @param applyParity if true ()
   * @param minSplitRadians smallest allowed angle in the split sector that is split.
   */
  public triangulateForSpine(applyParity: boolean = true, minSplitRadians: number = 0.3): void {

    const sMaxSplit = 20;
    const sMinCandidateRadians = 1.0;
    let numSplit = 0;
    HalfEdgeGraphMerge.splitIntersectingEdges(this.graph);
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(this.graph);

    const context1 = new RegularizationContext(this.graph);
    context1.regularizeGraph(HalfEdgeGraphSpineContext._regularize1, false);
    const context2 = new RegularizationContext(this.graph);
    context2.regularizeGraph(false, HalfEdgeGraphSpineContext._regularize2);
    if (applyParity) {
      HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(this.graph,
        new HalfEdgeMaskTester(HalfEdgeMask.BOUNDARY_EDGE), HalfEdgeMask.EXTERIOR);
      this.purgeNullFaces(HalfEdgeMask.EXTERIOR);
    }

    Triangulator.triangulateAllPositiveAreaFaces(this.graph);
    Triangulator.flipTriangles(this.graph);

    while (numSplit++ < sMaxSplit) {
      const numPerp = this.addPerpendicularsToBoundaries(minSplitRadians, sMinCandidateRadians);
      if (numPerp <= 0)
        break;
      Triangulator.flipTriangles(this.graph);
    }
  }

  // Find pseudo spine edges
  // Optionally include pure internal midline segments.
  // Optionally include midline segments into "dead end"
  // Optionally include adjacent spokes to corner.
  /**
   * Retrieve edges of the spine as arrays of points.
   * @param bIncludeInterior true to include fully internal segments
   * @param bIncludeFinal true to include segments that terminate at a boundary
   * @param bIncludeCornerSpokes
   * @return array of line data.
   */
  public getSpineEdges(bIncludeInterior: boolean = true, bIncludeFinal: boolean = true, bIncludeCornerSpokes: boolean = true): Point3d[][] {
    const xyzOut: Point3d[][] = [];
    this._spineGraph.announceFaceLoops(
      (_graph: HalfEdgeGraph, faceSeed: HalfEdge) => {
        if (!faceSeed.getMask(HalfEdgeMask.EXTERIOR)) {
          if (this.getSpineEdgesInTriangle(faceSeed, xyzOut, bIncludeInterior, bIncludeFinal)) {
          } else if (this.getSpineEdgesInQuad(faceSeed, xyzOut, bIncludeInterior, bIncludeFinal, bIncludeCornerSpokes)) {
          }
        }
        return true;
      });
    return xyzOut;
  }

  /**
   * Intermediate markup step to identify quads between corresponding boundary edges.
   * * search for and mark triangle edges that should be treated as diagonal of a quad
   * * Angle logic is:
   *   * In a candidate quad (formed by joining triangles that share an edge)
   *   * form segments between opposite edges of the quad.
   *   * compute angles between these segments and the edges of their quads.
   *   * if this angle is larger than minAngleRadians, accept this as a quad.
   *   * recommended angle is between 15 and 5 degrees; 50 degrees is typical
   * @param bDeleteDiagonals if true, eliminate the diagonals.
   * @param minAngleRadians angle tolerance, as described above.
   */
  public consolidateTrianglesToQuads(bDeleteDiagonals: boolean, minAngle: Angle = Angle.createDegrees(50)): number {

    const numDiagonal = this.setSortedDiagonalMasks(minAngle.radians);
    if (bDeleteDiagonals && numDiagonal > 0) {
      this.graph.yankAndDeleteEdges(
        (node: HalfEdge) => node.getMask(this._diagonalMask));
    }
    return numDiagonal;
  }
}
