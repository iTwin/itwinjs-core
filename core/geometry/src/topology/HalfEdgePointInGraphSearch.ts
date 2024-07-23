/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Topology
 */

import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { HalfEdge } from "./Graph";
import { NodeXYZUV } from "./HalfEdgeNodeXYZUV";
import { HalfEdgePositionDetail } from "./HalfEdgePositionDetail";

/* eslint-disable @typescript-eslint/naming-convention */
export enum RayClassification {
  RC_NoHits,
  RC_TargetOnVertex,
  RC_TargetOnEdge,
  RC_Bracket,
  RC_TargetBefore,
  RC_TargetAfter,
}
/* eslint-enable @typescript-eslint/naming-convention */

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
   * @param edgeHit start point on edge, updated and returned.
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
    if (sideA * sideB < 0) { // ray aims to the face
      if (sideA > 0) {
        result = edgeHit.resetAsFace(dataA.node);
      } else {
        result = edgeHit.resetAsFace(dataB.node);
      }
    } else if (sideA === 0 || sideB === 0) { // ray is along the edge
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
    } else { // both vertices are to same side of the line; this can't happen for edge point between nodes
      edgeHit.resetAsUnknown();
      result = this.panic();
    }
    return result;
  }
  /**
   * Aim to reposition `searchBase` based on a ray and a target distance. It uses geometric classifications to determine
   * the new position and updates `searchBase` accordingly.
   * @param searchBase the detail to reposition.
   * @param ray the ray to use for repositioning. Ray is assumed to start at the vertex precisely.
   * @param targetDistance the target distance to aim for.
   */
  public reAimFromVertex(
    searchBase: HalfEdgePositionDetail, ray: Ray3d, targetDistance: number,
  ): HalfEdgePositionDetail {
    const vertexNode = searchBase.node;
    let result;
    let outboundEdge = vertexNode!;
    do {
      // DPoint3d xyzBase;
      // vu_getDPoint3d(&xyzBase, outboundEdge);
      const data0 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.faceSuccessor, ray);
      const data1 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.facePredecessor, ray);
      const u0 = data0.u;
      // double u1 = data1.u;
      const v0 = data0.v;
      const v1 = data1.v;
      if (Math.abs(v0) < this._tol) { // if ray is parallel to outboundEdge.faceSuccessor
        if (Math.abs(u0 - targetDistance) < this._tol) {
          // direct hit at far end
          result = searchBase.resetAsVertex(data0.node);
          result.setITag(1);
          return result;
        } else if (u0 > targetDistance) {
          // direct hit within edge
          const edgeFraction = targetDistance / u0;
          result = searchBase.resetAtEdgeAndFraction(outboundEdge, edgeFraction);
          return result;
        } else if (Math.abs(u0) <= this._tol) {
          // unexpected direct hit on the base of the search, but call it a hit
          result = searchBase.resetAsVertex(outboundEdge);
          result.setITag(1);
          return result;
        } else if (u0 > this._tol) {
          // advance to vertex
          // double edgeFraction = targetDistance / u0;
          result = searchBase.resetAsVertex(data0.node);
          return result;
        } else {
          // search direction is exactly opposite this edge
          // see if the other side of the sector is turned even beyond that
          if (v1 > this._tol) {
            result = searchBase.resetAsFace(outboundEdge, outboundEdge);
            return result;
          }
        }
      } else if (v0 < -this._tol) { // if sweep from ray to outboundEdge.faceSuccessor is CCW
        if (v1 > this._tol) {
          // the usual simple entry into an angle < 180
          result = searchBase.resetAsFace(outboundEdge, outboundEdge);
          return result;
        }
      } else { // if (v0 > this._tol) or if sweep from ray to outboundEdge.faceSuccessor is CW
        // TODO
      }
      // NEEDS WORK: angle >= 180 cases
      outboundEdge = outboundEdge.vertexSuccessor;
    } while (outboundEdge !== vertexNode);
    return this.panic();
  }
  /**
   * Visit all edges around the face, updating `lastBefore` and `firstAfter` to ray-edge intersections that
   * lie directly before and/or after the target point on the ray, if at all.
   * @param faceNode starting node on the face.
   * @param ray the ray to the target point.
   * @param targetDistance distance along the ray to the target point.
   * @param lastBefore the detail to reset as the last hit on the ray before the target point (CALLER CREATED).
   * @param firstAfter the detail to reset as the first hit on the ray after the target point (CALLER CREATED).
   * @returns summary of the updated details:
   * * [[RayClassification.RC_TargetOnVertex]] - target lies at a vertex of the face (details are identical)
   * * [[RayClassification.RC_TargetOnEdge]] - target lies on an edge of the face (details are identical)
   * * [[RayClassification.RC_TargetBefore]] - target lies before the face; the ray intersects the face beyond
   * the target point.
   * * [[RayClassification.RC_TargetAfter]] - target lies after the face; the ray intersects the face before
   * the target point.
   * * [[RayClassification.RC_Bracket]] - target lies between intersections of the ray and the face; if the face
   * is convex, this means the target lies inside the face.
   * * [[RayClassification.RC_NoHits]] - the face does not intersect the ray
   */
  public reAimAroundFace(
    faceNode: HalfEdge,
    ray: Ray3d,
    targetDistance: number,
    lastBefore: HalfEdgePositionDetail,
    firstAfter: HalfEdgePositionDetail,
  ): RayClassification {
    lastBefore.resetAsUndefinedWithTag(-Number.MAX_VALUE);
    firstAfter.resetAsUndefinedWithTag(Number.MAX_VALUE);
    const data0 = NodeXYZUV.createNodeAndRayOrigin(faceNode, ray);
    let data1;
    let node0 = faceNode;
    // find the intersection of the ray with each edge of the face
    do {
      const node1 = node0.faceSuccessor;
      data1 = NodeXYZUV.createNodeAndRayOrigin(node1, ray, data1);
      const u0 = data0.u;
      const u1 = data1.u;
      const v0 = data0.v;
      const v1 = data1.v;
      if (Math.abs(v1) < this._tol) {
        // ray hits a vertex of the face
        const vertexHit = HalfEdgePositionDetail.createVertex(node1);
        vertexHit.setDTag(u1);
        if (Math.abs(u1 - targetDistance) < this._tol) {
          firstAfter.setFrom(vertexHit);
          lastBefore.setFrom(vertexHit);
          return RayClassification.RC_TargetOnVertex;
        }
        if (u1 > targetDistance && u1 < firstAfter.getDTag()!)
          firstAfter.setFrom(vertexHit);
        if (u1 < targetDistance && u1 > lastBefore.getDTag()!)
          lastBefore.setFrom(vertexHit);
      } else if (v0 * v1 < 0.0) {
        // ray crossing an edge of the face
        const edgeFraction = -v0 / (v1 - v0);
        const rayFraction = Geometry.interpolate(u0, edgeFraction, u1);
        const edgeHit = HalfEdgePositionDetail.createEdgeAtFraction(data0.node, edgeFraction);
        edgeHit.setDTag(rayFraction);
        if (Math.abs(rayFraction - targetDistance) <= this._tol) {
          firstAfter.setFrom(edgeHit);
          lastBefore.setFrom(edgeHit);
          return RayClassification.RC_TargetOnEdge;
        }
        if (rayFraction > targetDistance && rayFraction < firstAfter.getDTag()!) {
          firstAfter.setFrom(edgeHit);
          if (v0 > 0)
            firstAfter.setITag(-1); // face is not locally convex; this "after" hit cannot bracket
        }
        if (rayFraction < targetDistance && rayFraction > lastBefore.getDTag()!) {
          lastBefore.setFrom(edgeHit);
          lastBefore.setDTag(rayFraction);
        }
      } else {
        // ray does not hit a vertex or edge of the face; do nothing
      }
      data0.setFrom(data1);
      node0 = node0.faceSuccessor;
    } while (node0 !== faceNode);
    // returned to start node
    const afterTag = firstAfter.getITag();
    firstAfter.setITag(0);
    lastBefore.setITag(0);
    if (lastBefore.isUnclassified) {
      if (firstAfter.isUnclassified)
        return RayClassification.RC_NoHits;
      return RayClassification.RC_TargetBefore;
    }
    if (firstAfter.isUnclassified || (firstAfter.isEdge && afterTag && afterTag < 0)) {
      return RayClassification.RC_TargetAfter;
    } else {
      return RayClassification.RC_Bracket; // face is locally convex; target lies inside this face
    }
  }
  /**
   * Set (replace contents) ray with
   * * `origin` at start.
   * * `direction` is unit vector from start towards target.
   * * `a` is distance from start to target.
   * @param start existing position.
   * @param target target xy coordinates.
   * @param ray ray to update.
   * @returns false if target is reached.
   */
  public setSearchRay(start: HalfEdgePositionDetail, target: Point3d, ray: Ray3d): boolean {
    ray.origin.setFromPoint3d(start);
    Vector3d.createStartEnd(ray.origin, target, ray.direction);
    ray.direction.z = 0.0;
    const distanceToTargetXY = ray.direction.magnitudeXY();
    if (distanceToTargetXY < this._tol)
      return false; // TODO: set ray, start to vertex?
    ray.a = distanceToTargetXY;
    ray.direction.scaleInPlace(1 / distanceToTargetXY);
    return true;
  }
}
