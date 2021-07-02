/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Dictionary } from "@bentley/bentleyjs-core";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { PolygonOps } from "../geometry3d/PolygonOps";
import { IndexedPolyface } from "./Polyface";

/** @packageDocumentation
 * @module Polyface
 */

function compare(a: number, b: number): number {
  if (a < b)
    return -1;

  return a > b ? 1 : 0;
}

/** Maps floating-point 3d vector to a signed integer grid. */
class QPoint3d {
  public constructor(
    public x: number,
    public y: number,
    public z: number) { }

  public init(pt: Vector3d, tolerance: number): void {
    this.x = Math.floor(pt.x / tolerance);
    this.y = Math.floor(pt.y / tolerance);
    this.z = Math.floor(pt.z / tolerance);
  }

  public clone(): QPoint3d {
    return new QPoint3d(this.x, this.y, this.z);
  }

  public compareTo(rhs: QPoint3d): number {
    let cmp = compare(this.x, rhs.x);
    if (cmp) {
      cmp = compare(this.y, rhs.y);
      if (cmp)
        cmp = compare(this.z, rhs.z);
    }

    return cmp;
  }
}

class NormalBuilder {
  private readonly _normals = new GrowableXYZArray();
  private readonly _normalIndex: number[] = [];
  private readonly _tolerance: number;
  private readonly _normalToIndex: Dictionary<QPoint3d, number>;
  private readonly _scratchQPoint3d = new QPoint3d(0, 0, 0);

  public constructor(polyface: IndexedPolyface, tolerance: number) {
    this._tolerance = tolerance;
    this._normalToIndex = new Dictionary<QPoint3d, number>((lhs, rhs) => lhs.compareTo(rhs), (key) => key.clone());

    polyface.data.normal = this._normals;
    polyface.data.normalIndex = this._normalIndex;
  }

  public addNormalIndexTerminator(): void {
    this._normalIndex.push(0);
  }

  public addNormalIndex(zeroBasedIndex: number): void {
    this._normalIndex.push(zeroBasedIndex + 1);
  }

  /** Returns corresponding normal index. */
  public findOrAddNormal(normal: Vector3d): number {
    const qpoint = this._scratchQPoint3d;
    qpoint.init(normal, this._tolerance);
    const found = this._normalToIndex.findOrInsert(qpoint, this._normals.length);
    if (found.inserted)
      this._normals.push(normal);

    return found.value;
  }
}

class Facet {
  public readonly normal = new Vector3d(0, 0, 0);
  public area = 0;

  public init(points: Point3d[]): void {
    PolygonOps.areaNormal(points, this.normal);
    this.area = this.normal.magnitude();
    if (this.area < 1.0e-14)
      this.normal.set(0, 0, 1);
    else
      this.normal.normalizeInPlace();
  }
}

class VertexFacets {
  public readonly facets: Facet[] = [];

  public computeSharedNormal(thisFacet: Facet, minDot: number): Vector3d {
    let shared = false;
    let normal = thisFacet.normal.clone();

    for (const facet of this.facets) {
      if (facet !== thisFacet && facet.normal.dotProduct(thisFacet.normal) < minDot) {
        shared = true;
        normal.addInPlace(facet.normal);
      }
    }

    if (shared)
      normal.normalizeInPlace();

    return normal;
  }
}

/** Implementation of [[IndexedPolyface.buildNormalsFast]].
 * @internal
 */
export function buildNormalsFast(polyface: IndexedPolyface, creaseTolerance: number, sizeTolerance: number): void {
  if (0 !== polyface.normalCount)
    return;

  const facePoints: Point3d[] = [];
  const points = polyface.data.point;
  const builder = new NormalBuilder(polyface, 1.0e-10);

  const pointIndexToFacets: VertexFacets[] = [];
  for (let i = 0; i < polyface.pointCount; i++)
    pointIndexToFacets.push(new VertexFacets());

  const indexIndexToFacet: Facet[] = [];
  let facet = new Facet();

  for (let i = 0, indexCount = polyface.data.indexCount; i < indexCount; i++) {
    const pointIndex = Math.abs(polyface.data.pointIndex[i]);
    if (0 === pointIndex) {
      if (facePoints.length > 0) {
        facet.init(facePoints);
        facet = new Facet();
        facePoints.length = 0;
      }
    } else {
      const zeroBasedIndex = pointIndex - 1;
      facePoints.push(points.getPoint3dAtUncheckedPointIndex(zeroBasedIndex));
      pointIndexToFacets[zeroBasedIndex].facets.push(facet);
      indexIndexToFacet[i] = facet;
    }
  }

  const minDot = Math.cos(creaseTolerance);
  const minArea = sizeTolerance * sizeTolerance;
  const defaultFacet = new Facet();
  for (let i = 0, indexCount = polyface.data.indexCount; i < indexCount; i++) {
    const pointIndex = Math.abs(polyface.data.pointIndex[i]);
    if (0 === pointIndex) {
      builder.addNormalIndexTerminator();
    } else {
      const thisFacet = indexIndexToFacet[i] ?? defaultFacet;
      const zeroBasedIndex = pointIndex - 1;

      let normal;
      if (thisFacet.area < minArea)
        normal = thisFacet.normal;
      else
        normal = pointIndexToFacets[zeroBasedIndex].computeSharedNormal(thisFacet, minDot);

      builder.addNormalIndex(builder.findOrAddNormal(normal));
    }
  }
}
