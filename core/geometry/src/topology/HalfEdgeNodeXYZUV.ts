/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Geometry } from "../Geometry";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { HalfEdge } from "./Graph";

/** @packageDocumentation
 * @module Topology
 */
/**
 * Reference to a HalfEdge node with extra XYZ and UV data.
 * @internal
 */
export class NodeXYZUV {
  private _node: HalfEdge;
  private _x: number;
  private _y: number;
  private _z: number;
  private _u: number;
  private _v: number;

  private constructor(node: HalfEdge, x: number, y: number, z: number, u: number, v: number) {
    this._x = x; this._y = y; this._z = z;
    this._u = u; this._v = v;
    this._node = node;
  }
  /** Set all content directly from args.
   * @returns `this` reference
   */
  public set(node: HalfEdge, x: number, y: number, z: number, u: number, v: number): NodeXYZUV {
    this._x = x; this._y = y; this._z = z;
    this._u = u; this._v = v;
    this._node = node;
    return this;
  }

  public setFrom(other: NodeXYZUV) {
    this._x = other.x; this._y = other.y; this._z = other.z;
    this._u = other.u; this._v = other.v;
    this._node = other.node;

  }
  /** Create a `NodeXYZUV` with
   * * x,y,z at ray origin
   * * u,v as dotXY and crossXY for the ray direction with x,y distances from the ray origin.
   */
  public static createNodeAndRayOrigin(node: HalfEdge, ray: Ray3d, result?: NodeXYZUV): NodeXYZUV {
    const x = node.x;
    const y = node.y;
    const z = node.z;
    const dx = x - ray.origin.x;
    const dy = y - ray.origin.y;
    const u = Geometry.dotProductXYXY(dx, dy, ray.direction.x, ray.direction.y);
    const v = Geometry.crossProductXYXY(ray.direction.x, ray.direction.y, dx, dy);
    if (result)
      return result.set(node, x, y, z, u, v);
    return new NodeXYZUV(node, x, y, z, u, v);
  }
  /** Create a `NodeXYZUV` with explicit node, xyz, uv */
  public static create(node: HalfEdge,
    x: number = 0, y: number = 0, z: number = 0, u: number = 0, v: number = 0){
    return new NodeXYZUV(node, x, y, z, u, v);
  }

  /** Access the node. */
  public get node(): HalfEdge { return this._node; }
  /** Access the x coordinate */
  public get x(): number { return this._x; }
  /** Access the y coordinate */
  public get y(): number { return this._y; }
  /** Access the z coordinate */
  public get z(): number { return this._z; }
  /** Access the u coordinate */
  public get u(): number { return this._u; }
  /** Access the v coordinate */
  public get v(): number { return this._v; }
  /** Access the x,y,z coordinates as Point3d with optional caller-supplied result. */
  public getXYZAsPoint3d(result?: Point3d): Point3d {
    return Point3d.create(this._x, this._y, this._z, result);
  }
  /** Access the uv coordinates as Point2d with optional caller-supplied result. */
  public getUVAsPoint2d(result?: Point2d): Point2d { return Point2d.create(this._u, this._v, result); }

  /** Toleranced comparison function for u coordinate */
  public classifyU(target: number, tol: number): number {
    const delta = this.u - target;
    if (Math.abs(delta) <= tol)
      return 0;
    return delta >= 0 ? 1 : -1;
  }

  /** Toleranced comparison function for v coordinate */
  public classifyV(target: number, tol: number): number {
    const delta = target - this._v;
    if (Math.abs(delta) <= tol)
      return 0;
    return delta >= 0 ? 1 : -1;
  }

}
