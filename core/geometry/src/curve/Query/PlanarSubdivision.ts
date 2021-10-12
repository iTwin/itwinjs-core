/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { HalfEdge, HalfEdgeGraph } from "../../topology/Graph";
import { HalfEdgeGraphSearch } from "../../topology/HalfEdgeGraphSearch";
import { HalfEdgeGraphMerge } from "../../topology/Merging";
import { CurveLocationDetail, CurveLocationDetailPair } from "../CurveLocationDetail";
import { CurvePrimitive } from "../CurvePrimitive";
import { Loop, LoopCurveLoopCurve, SignedLoops } from "../Loop";
import { RegionOps } from "../RegionOps";

/** @packageDocumentation
 * @module Curve
 */

class MapCurvePrimitiveToCurveLocatioNDetailPairArray {
  public primitiveToPair = new Map<CurvePrimitive, CurveLocationDetailPair[]>();
  // index assigned to this primitive for this calculation.
  public primitiveToIndex = new Map<CurvePrimitive, number>();
  private _numIndexedPrimitives: number = 0;
  public assignPrimitiveIndex(primitive: CurvePrimitive | undefined) {
    if (primitive !== undefined) {
      const index = this.primitiveToIndex.get(primitive);
      if (index === undefined) {
        this.primitiveToIndex.set(primitive, this._numIndexedPrimitives++);
      }
    }
  }
  public insertPrimitiveToPair(primitive: CurvePrimitive | undefined, pair: CurveLocationDetailPair) {
    if (primitive) {
      const priorPairs = this.primitiveToPair.get(primitive);
      this.assignPrimitiveIndex(primitive);
      if (!priorPairs) {
        this.primitiveToPair.set(primitive, [pair]);
      } else {
        priorPairs.push(pair);
      }
    }
  }
  public insertPair(pair: CurveLocationDetailPair) {
    const primitiveA = pair.detailA.curve;
    if (primitiveA)
      this.insertPrimitiveToPair(primitiveA, pair);
    const primitiveB = pair.detailB.curve;
    if (primitiveB)
      this.insertPrimitiveToPair(primitiveB, pair);
  }
}
/*
  function getDetailString(detail: CurveLocationDetail | undefined): string {
    if (!detail)
      return "{}";
    else return tagString("primitive", this.primitiveToIndex.get(detail.curve!)) + tagString("f0", detail.fraction) + tagString("f1", detail.fraction1);
  }
}
function tagString(name: string, value: number | undefined): string {
  if (value !== undefined)
    return "(" + name + " " + value + ")";
  return "";
}
*/
/**
 * @internal
 */
export class PlanarSubdivision {
  public static assembleHalfEdgeGraph(_primitives: CurvePrimitive[], allPairs: CurveLocationDetailPair[]): HalfEdgeGraph {
    const detailByPrimitive = new MapCurvePrimitiveToCurveLocatioNDetailPairArray();   // map from key CurvePrimitive to CurveLocationDetailPair.
    for (const p of _primitives)
      detailByPrimitive.assignPrimitiveIndex(p);
    for (const pair of allPairs) {
      detailByPrimitive.insertPair(pair);
    }
    const graph = new HalfEdgeGraph();
    for (const entry of detailByPrimitive.primitiveToPair.entries()) {
      const p = entry[0];
      const details = entry[1];
      details.sort((pairA: CurveLocationDetailPair, pairB: CurveLocationDetailPair) => {
        const fractionA = getFractionOnCurve(pairA, p);
        const fractionB = getFractionOnCurve(pairB, p);
        if (fractionA === undefined || fractionB === undefined)
          return -1000.0;
        return fractionA - fractionB;
      });
      let detail0 = getDetailOnCurve(details[0], p)!;
      for (let i = 1; i < details.length; i++) {
        // create (both sides of) a graph edge . . .
        const detail1 = getDetailOnCurve(details[i], p)!;
        if (detail0.point.isAlmostEqual(detail1.point)) {

        } else {
          const halfEdge = graph.createEdgeXYAndZ(detail0.point, 0, detail1.point, 0);
          const detail01 = CurveLocationDetail.createCurveEvaluatedFractionFraction(p, detail0.fraction, detail1.fraction);
          const mate = halfEdge.edgeMate;
          halfEdge.edgeTag = detail01;
          halfEdge.sortData = 1.0;
          mate.edgeTag = detail01;
          mate.sortData = -1.0;
          halfEdge.sortAngle = sortAngle(detail01.curve!, detail01.fraction, false);
          mate.sortAngle = sortAngle(detail01.curve!, detail01.fraction1!, true);
        }
        detail0 = detail1;
      }
    }
    HalfEdgeGraphMerge.clusterAndMergeXYTheta(graph, (he: HalfEdge) => he.sortAngle!);
    return graph;
  }

  // based on computed (and toleranced) area, push the loop (pointer) onto the appropriate array of positive, negative, or sliver loops.
  // return the area (forced to zero if within tolerance)
  public static collectSignedLoop(loop: Loop, signedAreas: SignedLoops, zeroAreaTolerance: number = 1.0e-10): number{
    let area = RegionOps.computeXYArea(loop);
    if (area === undefined)
      area = 0;
    if (Math.abs(area) < zeroAreaTolerance)
      area = 0.0;
    (loop as any).computedAreaInPlanarSubdivision = area;
    if (area > 0)
      signedAreas.positiveAreaLoops.push(loop);
    else if (area < 0)
      signedAreas.negativeAreaLoops.push(loop);
    else
      signedAreas.slivers.push(loop);
    return area;
  }
  public static createLoopInFace(faceSeed: HalfEdge,
    announce?: (he: HalfEdge, curve: CurvePrimitive, loop: Loop) => void): Loop {
    let he = faceSeed;
    const loop = Loop.create();
    do {
      const detail = he.edgeTag as CurveLocationDetail;
      if (detail) {
        let curve;
        if (he.sortData! > 0)
          curve = detail.curve!.clonePartialCurve(detail.fraction, detail.fraction1!);
        else
          curve = detail.curve!.clonePartialCurve(detail.fraction1!, detail.fraction);
        if (curve) {
          if (announce !== undefined)
            announce(he, curve, loop);
          loop.tryAddChild(curve);
        }
      }
      he = he.faceSuccessor;
    } while (he !== faceSeed);
    return loop;
  }
// return true if there are only two edges.
  // In a line-only graph, this is a null-area face.
  private static isNullFace(he: HalfEdge): boolean {
    return he.faceSuccessor.faceSuccessor === he;
  }
  // Look  across edge mates (possibly several) for a nonnull mate face.
  private static nonNullEdgeMate(_graph: HalfEdgeGraph, e: HalfEdge): HalfEdge | undefined {
    if (this.isNullFace (e))
      return undefined;
    let e1 = e.edgeMate;
    while (this.isNullFace(e1)){
      e1 = e1.faceSuccessor.edgeMate;
      if (e1 === e)
        return undefined;
    }
    return e1;
  }
  public static collectSignedLoopSetsInHalfEdgeGraph(graph: HalfEdgeGraph, zeroAreaTolerance: number = 1.0e-10): SignedLoops[] {
    const q = HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(graph, undefined);
    const result: SignedLoops[] = [];
    const edgeMap = new Map<HalfEdge, LoopCurveLoopCurve>();
    for (const faceSeeds of q) {
      const componentAreas: SignedLoops = { positiveAreaLoops: [], negativeAreaLoops: [], slivers: [] };
      const edges: LoopCurveLoopCurve[] = [];
      for (const faceSeed of faceSeeds) {
        const loop = this.createLoopInFace(faceSeed, (he: HalfEdge, curveC: CurvePrimitive, loopC: Loop) => {
          if (this.isNullFace(he)) {
            // Ignore all edges of null faces.
          } else {
            const mate = this.nonNullEdgeMate(graph, he);
              if (mate !== undefined){
                const e = edgeMap.get(mate);
                if (e === undefined) {
                  // Record this as loopA,edgeA of a shared edge to be completed later from the other side of the edge
                  const e1 = new LoopCurveLoopCurve(loopC, curveC, undefined, undefined);
                  edgeMap.set(he, e1);
                } else if (e instanceof LoopCurveLoopCurve) {
                  e.setB(loopC, curveC);
                  edges.push(e);
                  edgeMap.delete(mate);
                }
            }
          }
        });
        this.collectSignedLoop(loop, componentAreas, zeroAreaTolerance);
      }
      componentAreas.edges = edges;
      result.push(componentAreas);
      edgeMap.clear();
    }
    return result;
  }
}

function sortAngle(curve: CurvePrimitive, fraction: number, reverse: boolean): number {
  const ray = curve.fractionToPointAndDerivative(fraction);
  const s = reverse ? -1.0 : 1.0;
  return Math.atan2(s * ray.direction.y, s * ray.direction.x);
}

function getFractionOnCurve(pair: CurveLocationDetailPair, curve: CurvePrimitive): number | undefined {
  if (pair.detailA.curve === curve)
    return pair.detailA.fraction;
  if (pair.detailB.curve === curve)
    return pair.detailB.fraction;
  return undefined;
}
function getDetailOnCurve(pair: CurveLocationDetailPair, curve: CurvePrimitive): CurveLocationDetail | undefined {
  if (pair.detailA.curve === curve)
    return pair.detailA;
  if (pair.detailB.curve === curve)
    return pair.detailB;
  return undefined;
}
