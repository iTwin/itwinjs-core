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
  // From given edge start point
  // The edgeHit is reused as the result.
  public reAimFromEdge(
    edgeHit: HalfEdgePositionDetail,
    ray: Ray3d,
    targetDistance: number): HalfEdgePositionDetail {
    const nodeA = edgeHit.node!;
    const dataA = NodeXYZUV.createNodeAndRayOrigin(nodeA, ray);
    const dataB = NodeXYZUV.createNodeAndRayOrigin(nodeA.edgeMate, ray);
    const sideA = -dataA.classifyV(0.0, this._tol);
    const sideB = -dataB.classifyV(0.0, this._tol);
    let result;
    if (sideA * sideB < 0) {
      // Simple crossing -- just aim into a face
      if (sideA > 0) {
        result = edgeHit.resetAsFace(dataA.node);
      } else {
        result = edgeHit.resetAsFace(dataB.node);
      }
    } else if (sideA === 0 || sideB === 0) {
      // The usual case is both 0 i.e. ray is clearly along the edge.

      const alongA = dataA.classifyU(targetDistance, this._tol);
      const alongB = dataB.classifyU(targetDistance, this._tol);
      if (alongA === 0 && sideA === 0) {
        result = edgeHit.resetAsVertex(dataA.node);
        result.setITag(1);
      } else if (alongB === 0 && sideB === 0) {
        result = edgeHit.resetAsVertex(dataB.node);
        result.setITag(1);
      } else if (alongA * alongB < 0) {
        // target is within edge
        // (.. This is written for the case where both sideA and sideB are zero.
        //    If only one is zero, this computes a close edge point but the strong "on" conclusion might be wrong)

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
        // This shouldn't happen -- maybe as if the initial edge point was not within the edge???
        if (Math.abs(dataA.u) < this._tol
          && Math.abs(dataA.v) < this._tol
        ) {
          result = edgeHit.resetAsVertex(dataA.node); // , dataA);
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
      // Both vertices are to same side of the line.   This can't happen for edge point between nodes.
      edgeHit.resetAsUnknown();
      result = this.panic();
    }
    return result;
  }

  // From given edge start point, pick vertex or edge side for proceeding along ray.
  // RAY IS ASSUMED TO START AT THE VERTEX PRECISELY !!!!
  public reAimFromVertex(
    searchBase: HalfEdgePositionDetail,
    ray: Ray3d,
    targetDistance: number): HalfEdgePositionDetail {
    const vertexNode = searchBase.node;
    let result;
    let outboundEdge = vertexNode!;
    do {
      // DPoint3d xyzBase;
      // vu_getDPoint3d(& xyzBase, outboundEdge);
      const data0 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.faceSuccessor, ray);
      const data1 = NodeXYZUV.createNodeAndRayOrigin(outboundEdge.facePredecessor, ray);
      const u0 = data0.u;
      // double u1 = data1.GetU ();
      const v0 = data0.v;
      const v1 = data1.v;
      if (Math.abs(v0) < this._tol) {
        if (Math.abs(u0 - targetDistance) < this._tol) {
          // Direct hit at far end
          result = searchBase.resetAsVertex(data0.node);
          result.setITag(1);
          return result;
        } else if (u0 > targetDistance) {
          // Direct hig within edge
          const edgeFraction = targetDistance / u0;
          result = searchBase.resetAtEdgeAndFraction(outboundEdge, edgeFraction);
          return result;
        } else if (Math.abs(u0) <= this._tol) {
          // Unexpected direct hit on the base of the search, but call it a hit....
          result = searchBase.resetAsVertex(outboundEdge);
          result.setITag(1);
          return result;
        } else if (u0 > this._tol) {
          // Advance to vertex  ...
          // double edgeFraction = targetDistance / u0;
          result = searchBase.resetAsVertex(data0.node);
          return result;
        } else {
          // Search direction is exactly opposite this edge.
          // See if the other side of the sector is turned even beyond that ...
          if (v1 > this._tol) {
            result = searchBase.resetAsFace(outboundEdge, outboundEdge);
            return result;
          }
        }
      } else if (v0 < -this._tol) {
        if (v1 > this._tol) {
          // The usual simple entry into an angle < 180
          result = searchBase.resetAsFace(outboundEdge, outboundEdge);
          return result;
        }
      }
      // NEEDS WORK: angle >= 180 cases !!!!
      outboundEdge = outboundEdge.vertexSuccessor;
    } while (outboundEdge !== vertexNode);
    return this.panic();
  }

  // Visit all edges around face.
  // reset lastBefore and firstAfter describing progress towards target distance on ray.
  public reAimAroundFace(
    faceNode: HalfEdge,
    ray: Ray3d,
    targetDistance: number,  // !< distance to target point
    lastBefore: HalfEdgePositionDetail,   // CALLER CREATED -- reset as first hit on negative side of ray.
    firstAfter: HalfEdgePositionDetail): RayClassification {  // ! CALLER CREATED -- reset as first hit on positive side of ray.

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
        // Vertex hit ...
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
        // Edge Crossing ...
        const edgeFraction = - v0 / (v1 - v0);
        const uEdge = Geometry.interpolate(u0, edgeFraction, u1);
        const edgeHit = HalfEdgePositionDetail.createEdgeAtFraction(data0.node, edgeFraction);
        edgeHit.setDTag(uEdge);
        if (Math.abs(uEdge - targetDistance) <= this._tol) {
          firstAfter.setFrom(edgeHit);
          lastBefore.setFrom(edgeHit);
          return RayClassification.RC_TargetOnEdge;
        }
        if (uEdge > targetDistance && uEdge < firstAfter.getDTag()!) {
          firstAfter.setFrom(edgeHit);
          firstAfter.setITag(v0 > 0.0 ? -1 : 1);
        }
        if (uEdge < targetDistance && uEdge > lastBefore.getDTag()!) {
          lastBefore.setFrom(edgeHit);
          lastBefore.setDTag(uEdge);
        }
      }
      data0.setFrom(data1);
      node0 = node0.faceSuccessor;
    } while (node0 !== faceNode);
// Returned to start node !!!
    const afterTag = firstAfter.getITag();
    firstAfter.setITag(0);
    lastBefore.setITag(0);
    if (lastBefore.isUnclassified) {
      if (firstAfter.isUnclassified)
        return RayClassification.RC_NoHits;
      return RayClassification.RC_TargetBefore;
    }
    if (firstAfter.isUnclassified
      || (firstAfter.isEdge && afterTag && afterTag < 0)) {
      return RayClassification.RC_TargetAfter;
    } else {
      return RayClassification.RC_Bracket;
    }
  }

  // Return false if target is reached !!!!
  /**
   * Set (replace contents) ray with
   * * `origin` at start
   * * `direction` is unit vector from start towards target
   * * `a` is distance from start to target.
   * @param start existing position
   * @param target target xy coordinates
   * @param ray ray to update
   */
  public setSearchRay(start: HalfEdgePositionDetail, target: Point3d, ray: Ray3d): boolean {
    ray.origin.setFromPoint3d(start);
    Vector3d.createStartEnd(ray.origin, target, ray.direction);
    ray.direction.z = 0.0;
    const distanceToTarget = ray.direction.magnitudeXY();
    ray.a = ray.direction.magnitude();
    ray.direction.scaleInPlace(1 / ray.a);
    return distanceToTarget >= this._tol;
  }
}
