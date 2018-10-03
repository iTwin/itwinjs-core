/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Numerics */

import { Point3d } from "../geometry3d/Point3dVector3d";
import { Point4d } from "./Point4d";
/**
 * A Plane4dByOriginAndVectors is a 4d origin and pair of 4d "vectors" defining a 4d plane.
 *
 * * The parameterization of the plane is    `X = A + U*t + V*v`
 * * The unit coefficient of pointA makes this like a Plane3dByOriginAndVectors. Hence it is not a barycentric combination of 4d points.
 */
export class PlaneByOriginAndVectors4d {
  public origin: Point4d;
  public vectorU: Point4d;
  public vectorV: Point4d;
  private constructor(origin: Point4d, vectorU: Point4d, vectorV: Point4d) {
    this.origin = origin;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  /** @returns Return a clone of this plane */
  public clone(result?: PlaneByOriginAndVectors4d): PlaneByOriginAndVectors4d {
    if (result) {
      result.setFrom(this);
      return result;
    }
    return new PlaneByOriginAndVectors4d(this.origin.clone(), this.vectorU.clone(), this.vectorV.clone());
  }
  /** copy all content from other plane */
  public setFrom(other: PlaneByOriginAndVectors4d): void {
    this.origin.setFrom(other.origin);
    this.vectorU.setFrom(other.vectorU);
    this.vectorV.setFrom(other.vectorV);
  }
  /** @returns Return true if origin, vectorU, and vectorV pass isAlmostEqual. */
  public isAlmostEqual(other: PlaneByOriginAndVectors4d): boolean {
    return this.origin.isAlmostEqual(other.origin)
      && this.vectorU.isAlmostEqual(other.vectorU)
      && this.vectorV.isAlmostEqual(other.vectorV);
  }
  /** Create a plane with (copies of) origin, vectorU, vectorV parameters
   */
  public static createOriginAndVectors(origin: Point4d, vectorU: Point4d, vectorV: Point4d, result?: PlaneByOriginAndVectors4d): PlaneByOriginAndVectors4d {
    if (result) {
      result.setOriginAndVectors(origin, vectorU, vectorV);
      return result;
    }
    return new PlaneByOriginAndVectors4d(origin.clone(), vectorU.clone(), vectorV.clone());
  }
  /** Set all numeric data from complete list of (x,y,z,w) in origin, vectorU, and vectorV */
  public setOriginAndVectorsXYZW(x0: number, y0: number, z0: number, w0: number, ux: number, uy: number, uz: number, uw: number, vx: number, vy: number, vz: number, vw: number): PlaneByOriginAndVectors4d {
    this.origin.set(x0, y0, z0, w0);
    this.vectorU.set(ux, uy, uz, uw);
    this.vectorV.set(vx, vy, vz, vw);
    return this;
  }
  /** Copy the contents of origin, vectorU, vectorV parameters to respective member variables */
  public setOriginAndVectors(origin: Point4d, vectorU: Point4d, vectorV: Point4d): PlaneByOriginAndVectors4d {
    this.origin.setFrom(origin);
    this.vectorU.setFrom(vectorU);
    this.vectorV.setFrom(vectorV);
    return this;
  }
  /** Create from complete list of (x,y,z,w) in origin, vectorU, and vectorV */
  public static createOriginAndVectorsXYZW(x0: number, y0: number, z0: number, w0: number, ux: number, uy: number, uz: number, uw: number, vx: number, vy: number, vz: number, vw: number, result?: PlaneByOriginAndVectors4d): PlaneByOriginAndVectors4d {
    if (result)
      return result.setOriginAndVectorsXYZW(x0, y0, z0, w0, ux, uy, uz, uw, vx, vy, vz, vw);
    return new PlaneByOriginAndVectors4d(Point4d.create(x0, y0, z0, w0), Point4d.create(ux, uy, uz, uw), Point4d.create(vx, vy, vz, uw));
  }
  public static createOriginAndTargets3d(origin: Point3d, targetU: Point3d, targetV: Point3d, result?: PlaneByOriginAndVectors4d): PlaneByOriginAndVectors4d {
    return PlaneByOriginAndVectors4d.createOriginAndVectorsXYZW(origin.x, origin.y, origin.z, 1.0, targetU.x - origin.x, targetU.y - origin.y, targetU.z - origin.z, 0.0, targetV.x - origin.x, targetV.y - origin.y, targetV.z - origin.z, 0.0, result);
  }
  public fractionToPoint(u: number, v: number, result?: Point4d): Point4d {
    return this.origin.plus2Scaled(this.vectorU, u, this.vectorV, v, result);
  }
  public static createXYPlane(result?: PlaneByOriginAndVectors4d): PlaneByOriginAndVectors4d {
    return PlaneByOriginAndVectors4d.createOriginAndVectorsXYZW(0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0, result);
  }
}
