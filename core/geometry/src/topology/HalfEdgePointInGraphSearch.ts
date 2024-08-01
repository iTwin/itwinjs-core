/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { assert } from "@itwin/core-bentley";
import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { HalfEdge, HalfEdgeMask } from "./Graph";
import { NodeXYZUV } from "./HalfEdgeNodeXYZUV";
import { HalfEdgePositionDetail } from "./HalfEdgePositionDetail";

/**
 * Return code from [PointSearchContext.reAimAroundFace]
 * @internal
 */
export enum RayClassification {
  noHits,
  targetOnVertex,
  targetOnEdge,
  bracket,
  targetBefore,
  targetAfter,
}

/**
 * Context for searching for the location of an xy-point in a graph.
 * * Assumptions: interior faces of the graph are convex, no edge has length less than `tol`.
 * @internal
 */
export class PointSearchContext {
  private _tol: number;
  private constructor(tol: number) {
    this._tol = tol;
  }
  public static create(tol: number = Geometry.smallMetricDistance) {
    return new PointSearchContext(tol);
  }
  private panic(): HalfEdgePositionDetail {
    return HalfEdgePositionDetail.create();
  }
  /**
   * Reposition `edgeHit` to an adjacent face or vertex, or another position on the edge, that is closer to the
   * target point.
   * @param edgeHit start position on a graph edge, updated and returned.
   * @param ray the ray to the target point.
   * @param targetDistance distance along the ray to the target point.
   * @return detail closer to the target point.
   */
  public reAimFromEdge(
    edgeHit: HalfEdgePositionDetail, ray: Ray3d, targetDistance: number,
  ): HalfEdgePositionDetail {
    const nodeA = edgeHit.node!;
    const dataA = NodeXYZUV.createNodeAndRayOrigin(nodeA, ray);
    const dataB = NodeXYZUV.createNodeAndRayOrigin(nodeA.edgeMate, ray);
    const sideA = -dataA.classifyV(0.0, this._tol);
    const sideB = -dataB.classifyV(0.0, this._tol);
    let result;
    if (sideA * sideB < 0) {
      // simple crossing; just aim into a face
      if (sideA > 0) {
        result = edgeHit.resetAsFace(dataA.node);
      } else {
        result = edgeHit.resetAsFace(dataB.node);
      }
    } else if (sideA === 0 || sideB === 0) {
      // the usual case is both 0 i.e. ray is clearly along the edge.
      const alongA = dataA.classifyU(targetDistance, this._tol);
      const alongB = dataB.classifyU(targetDistance, this._tol);
      if (alongA === 0 && sideA === 0) {
        result = edgeHit.resetAsVertex(dataA.node);
        result.setITag(1);
      } else if (alongB === 0 && sideB === 0) {
        result = edgeHit.resetAsVertex(dataB.node);
        result.setITag(1);
      } else if (alongA * alongB < 0) {
        // target is within edge (this is written for the case where both sideA and sideB are zero. If only one
        // is zero, this computes a close edge point but the strong "on" conclusion might be wrong)
        const edgeFraction = (targetDistance - dataA.u) / (dataB.u - dataA.u);
        result = edgeHit.resetAtEdgeAndFraction(dataA.node, edgeFraction);
        result.setITag(1);
      } else if (alongA < 0 && alongB < 0) {
        // target is beyond the edge -- move towards it.
        if (dataA.u > dataB.u)
          result = edgeHit.resetAsVertex(dataA.node);
        else
          result = edgeHit.resetAsVertex(dataB.node);
      } else {
        // this shouldn't happen; maybe as if the initial edge point was not within the edge?
        if (Math.abs(dataA.u) < this._tol
          && Math.abs(dataA.v) < this._tol
        ) {
          result = edgeHit.resetAsVertex(dataA.node);
        } else if (Math.abs(dataB.u) < this._tol
          && Math.abs(dataB.v) < this._tol
        ) {
          result = edgeHit.resetAsVertex(dataB.node);
        } else {
          edgeHit.resetAsUnknown();
          result = this.panic();
        }
      }
    } else {
      // both vertices are to same side of the line; this can't happen for edge point between nodes
      edgeHit.resetAsUnknown();
      result = this.panic();
    }
    return result;
  }
  /**
   * Reposition `vertexHit` to an adjacent face, edge, or vertex that is closer to the target point.
   * @param vertexHit start position at a graph vertex, updated and returned.
   * @param ray the ray to the target point, assumed to start exactly at the vertex.
   * @param targetDistance distance along the ray to the target point.
   * @return detail closer to the target point.
   */
  public reAimFromVertex(
    vertexHit: HalfEdgePositionDetail, ray: Ray3d, targetDistance: number,
  ): HalfEdgePositionDetail {
    assert(ray.origin.isExactEqual(vertexHit));
    const vertexNode = vertexHit.node;
    let result;
    let outboundEdge = vertexNode!;
    do { // examine the sectors around this vertex
      if (!outboundEdge.isMaskSet(HalfEdgeMask.EXTERIOR)) {
        const data0 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.faceSuccessor, ray);   // outBoundEdge vector
        const data1 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.facePredecessor, ray); // lookBack vector
        const u0 = data0.u;
        const u1 = data1.u;
        const v0 = data0.v;
        const v1 = data1.v;
        // examine dot and cross of ray with both edges defining this sector to see if ray lies between them
        if (Math.abs(v0) <= this._tol) { // ray parallel to outBoundEdge
          if (Math.abs(u0 - targetDistance) <= this._tol) {
            // direct hit at far end of outBoundEdge
            result = vertexHit.resetAsVertex(data0.node);
            result.setITag(1);
            return result;
          } else if (u0 > targetDistance) {
            // direct hit within outBoundEdge
            const edgeFraction = targetDistance / u0;
            result = vertexHit.resetAtEdgeAndFraction(outboundEdge, edgeFraction);
            return result;
          } else if (u0 > this._tol) {
            // advance to far end of outBoundEdge
            result = vertexHit.resetAsVertex(data0.node);
            return result;
          }
          // NOTE: the remaining cases just proceed to next sector:
          // * If u0 < -this._tol, then ray points opposite outBoundEdge, so by our convexity assumption, the only way
          //   that ray lies in this sector is if lookBack vector points in the same direction as ray, but this is
          //   handled in the next sector.
          // * If |u0| <= tol, then outBoundEdge has unexpected magnitude near tol and nothing can be determined.
          //   This case was previously mistakenly classified as a vertex hit.
        } else if (v0 < -this._tol) {
          if (v1 > this._tol) {
            // ray definitely lies in this sector
            result = vertexHit.resetAsFace(outboundEdge, outboundEdge);
            return result;
          } else if (v1 < -this._tol) {
            // ray definitely misses this sector; fall through to visit next sector
          } else { // |v1| <= tol
            // ray and lookBack vector are parallel, so this is handled by the next sector unless these vectors
            // point in opposite directions, which only happens when this sector spans ~180 degrees.
            if (u0 > this._tol && u1 < 0) {
              // advance to far end of outBoundEdge
              result = vertexHit.resetAsVertex(data0.node);
              return result;
            }
          }
        }
      }
      outboundEdge = outboundEdge.vertexSuccessor;
    } while (outboundEdge !== vertexNode);
    return this.panic();
  }
  /**
   * Visit all edges around the face, updating `lastBefore` and `firstAfter` to ray-edge intersections that
   * lie directly before and/or after the target point on the ray, if at all.
   * @param faceNode starting node on a graph face.
   * @param ray the ray to the target point.
   * @param targetDistance distance along the ray to the target point.
   * @param lastBefore the detail to reset as the last hit on the ray before the target point (CALLER CREATED).
   * @param firstAfter the detail to reset as the first hit on the ray after the target point (CALLER CREATED).
   * @returns summary of the updated details:
   * * [[RayClassification.targetOnVertex]] - target lies at a vertex of the face (details are identical)
   * * [[RayClassification.targetOnEdge]] - target lies on an edge of the face (details are identical)
   * * [[RayClassification.targetBefore]] - target lies before the face; the ray intersects the face beyond
   * the target point.
   * * [[RayClassification.targetAfter]] - target lies after the face; the ray intersects the face before
   * the target point.
   * * [[RayClassification.bracket]] - target lies between intersections of the ray and the face; if the face
   * is convex, this means the target lies inside the face.
   * * [[RayClassification.noHits]] - the face does not intersect the ray
   */
  public reAimAroundFace(
    faceNode: HalfEdge,
    ray: Ray3d,
    targetDistance: number,
    lastBefore: HalfEdgePositionDetail,
    firstAfter: HalfEdgePositionDetail,
  ): RayClassification {
    assert(!faceNode.isMaskSet(HalfEdgeMask.EXTERIOR));
    lastBefore.resetAsUndefinedWithTag(-Number.MAX_VALUE);
    firstAfter.resetAsUndefinedWithTag(Number.MAX_VALUE);
    const data0 = NodeXYZUV.createNodeAndRayOrigin(faceNode, ray);
    let data1;
    let node0 = faceNode;
    do {
      const node1 = node0.faceSuccessor;
      data1 = NodeXYZUV.createNodeAndRayOrigin(node1, ray, data1);
      const u0 = data0.u;
      const u1 = data1.u;
      const v0 = data0.v;
      const v1 = data1.v;
      if (Math.abs(v1) < this._tol) {
        // vertex hit
        const vertexHit = HalfEdgePositionDetail.createVertex(node1);
        vertexHit.setDTag(u1);
        if (Math.abs(u1 - targetDistance) < this._tol) {
          firstAfter.setFrom(vertexHit);
          lastBefore.setFrom(vertexHit);
          return RayClassification.targetOnVertex;
        }
        if (u1 > targetDistance && u1 < firstAfter.getDTag()!)
          firstAfter.setFrom(vertexHit);
        if (u1 < targetDistance && u1 > lastBefore.getDTag()!)
          lastBefore.setFrom(vertexHit);
      } else if (v0 * v1 < 0.0) {
        // edge crossing
        const edgeFraction = -v0 / (v1 - v0);
        const rayFraction = Geometry.interpolate(u0, edgeFraction, u1);
        const edgeHit = HalfEdgePositionDetail.createEdgeAtFraction(data0.node, edgeFraction);
        edgeHit.setDTag(rayFraction);
        if (Math.abs(rayFraction - targetDistance) <= this._tol) {
          firstAfter.setFrom(edgeHit);
          lastBefore.setFrom(edgeHit);
          return RayClassification.targetOnEdge;
        }
        if (rayFraction > targetDistance && rayFraction < firstAfter.getDTag()!)
          firstAfter.setFrom(edgeHit);
        if (rayFraction < targetDistance && rayFraction > lastBefore.getDTag()!)
          lastBefore.setFrom(edgeHit);
      }
      data0.setFrom(data1);
      node0 = node0.faceSuccessor;
    } while (node0 !== faceNode);
    // returned to start node
    firstAfter.setITag(0);
    lastBefore.setITag(0);
    if (lastBefore.isUnclassified) {
      if (firstAfter.isUnclassified)
        return RayClassification.noHits;
      return RayClassification.targetBefore;
    }
    if (firstAfter.isUnclassified)
      return RayClassification.targetAfter;
    else
      return RayClassification.bracket; // face is locally convex; target lies inside this face
  }
  /**
   * Initialize the input ray for topology search:
   * * `origin` is at `start`
   * * `direction` is the unit xy-vector from `start` towards `target`
   * * `a` is the xy-distance from `start` to `target`
   * @param start existing position
   * @param target target xy coordinates
   * @param ray updated in place
   * @returns false if target is reached.
   */
  public setSearchRay(start: HalfEdgePositionDetail, target: Point3d, ray: Ray3d): boolean {
    ray.origin.setFromPoint3d(start);
    Vector3d.createStartEnd(ray.origin, target, ray.direction);
    ray.direction.z = 0.0;
    const distanceToTargetXY = ray.direction.magnitudeXY();
    if (distanceToTargetXY < this._tol)
      return false; // no searching necessary, we are already at the target point
    ray.a = distanceToTargetXY;
    ray.direction.scaleInPlace(1 / distanceToTargetXY);
    return true;
  }
}
