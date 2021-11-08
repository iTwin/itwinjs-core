/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Geometry } from "../Geometry";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { IndexedReadWriteXYZCollection, IndexedXYZCollection } from "./IndexedXYZCollection";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
import { Point3d, Vector3d } from "./Point3dVector3d";

// cspell:word Puecker
/** context class for Puecker-Douglas polyline compression, viz https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
 * @internal
 */
export class PolylineCompressionContext {
  /** Caller provides source and tolerance.
   * * pointer to source is retained, but contents of source are never modified.
   */
  private constructor(source: IndexedXYZCollection, dest: IndexedReadWriteXYZCollection, tolerance: number) {
    this._toleranceSquared = tolerance * tolerance;
    this._source = source;
    this._dest = dest;
  }
  private _source: IndexedXYZCollection;

  private _dest: IndexedReadWriteXYZCollection;

  /** Squared tolerance for equal point. */
  private _toleranceSquared: number;
  /** push (clone of) the point at index i from the source to the growing result.
   * * index is adjusted cyclically to source index range by modulo.
   */
  private acceptPointByIndex(i: number) {
    const point = this._source.getPoint3dAtCheckedPointIndex(this._source.cyclicIndex(i));
    if (point)
      this._dest.push(point);
  }
  /** work data used by find max deviation */
  private static _vector01: Vector3d = Vector3d.create();
  private static _vectorQ: Vector3d = Vector3d.create();
  /**
   * Return index of max magnitude of cross product of vectors (index to index+1) and (index to index+2)
   * * Return undefined if unable to find a nonzero cross product.
   * @param i0 first cross product central index.
   * @param i1 last cross product central index.
   */
  private indexOfMaxCrossProduct(index0: number, index1: number): number | undefined {
    let qMax = 0.0;
    let q;
    let indexMax: number | undefined;
    for (let index = index0; index <= index1; index++) {
      const iA = this._source.cyclicIndex(index);
      const iB = this._source.cyclicIndex(index + 1);
      const iC = this._source.cyclicIndex(index + 2);
      this._source.crossProductIndexIndexIndex(iA, iB, iC, PolylineCompressionContext._vectorQ);
      q = PolylineCompressionContext._vectorQ.magnitudeSquared();
      if (q > qMax) {
        qMax = q;
        indexMax = index;
      }
    }
    return indexMax;
  }

  /**
   * Return interior index where max deviation in excess of tolerance occurs.
   * @param i0 first index of interval
   * @param i1 INCLUSIVE final index
   */
  private indexOfMaxDeviation(index0: number, index1: number): number | undefined {
    const i0 = this._source.cyclicIndex(index0);
    const i1 = this._source.cyclicIndex(index1);
    let maxDeviation = this._toleranceSquared;
    let maxDeviationIndex;
    let numerator;
    let distanceSquared;
    let s;
    let i;
    this._source.vectorIndexIndex(i0, i1, PolylineCompressionContext._vector01)!;
    const denominator = PolylineCompressionContext._vector01.magnitudeSquared();
    for (let index = index0 + 1; index < index1; index++) {
      i = this._source.cyclicIndex(index);
      this._source.vectorIndexIndex(i0, i, PolylineCompressionContext._vectorQ);
      numerator = PolylineCompressionContext._vector01.dotProduct(PolylineCompressionContext._vectorQ);
      if (numerator <= 0) {
        distanceSquared = PolylineCompressionContext._vectorQ.magnitudeSquared();
      } else if (numerator > denominator) {
        this._source.vectorIndexIndex(i1, i, PolylineCompressionContext._vectorQ);
        distanceSquared = PolylineCompressionContext._vectorQ.magnitudeSquared();
      } else {
        s = numerator / denominator;
        distanceSquared = PolylineCompressionContext._vectorQ.magnitudeSquared() - denominator * s * s;
      }
      if (distanceSquared > maxDeviation) {
        maxDeviation = distanceSquared;
        maxDeviationIndex = index;
      }
    }
    return maxDeviationIndex;
  }
  /**
   *
   * @param i0 first active point index
   * @param i1 last active point index (INCLUSIVE -- not "one beyond")
   * @param chordTolerance
   * @param result
   */
  // ASSUME index i0 is already saved.
  // ASSUME point i
  private recursiveCompressByChordErrorGo(i0: number, i1: number) {
    if (i1 === i0 + 1) {
      this.acceptPointByIndex(i1);
      return;
    }
    const distantPointIndex = this.indexOfMaxDeviation(i0, i1);
    if (distantPointIndex === undefined) {
      this.acceptPointByIndex(i1); // which compresses out some points.
    } else {
      this.recursiveCompressByChordErrorGo(i0, distantPointIndex);
      this.recursiveCompressByChordErrorGo(distantPointIndex, i1);
    }
  }
  // cspell:word Peucker
  /**
   * Return a point array with a subset of the input points.
   * * This is a global analysis (Douglas-Peucker)
   * @param source input points.
   * @param chordTolerance Points less than this distance from a retained edge may be ignored.
   */
  public static compressPoint3dArrayByChordError(source: Point3d[], chordTolerance: number): Point3d[] {
    const source1 = new Point3dArrayCarrier(source);
    const dest1 = new Point3dArrayCarrier([]);
    this.compressCollectionByChordError(source1, dest1, chordTolerance);
    return dest1.data;
  }
  /**
   * * Return a polyline with a subset of the input points.
   * * This is a global analysis (Douglas-Peucker)
   * * Global search for vertices that are close to edges between widely separated neighbors.
   * * Recurses to smaller subsets.
   * @param source input points
   * @param dest output points.  Must be different from source.
   * @param chordTolerance Points less than this distance from a retained edge may be ignored.
   */
  public static compressCollectionByChordError(source: IndexedXYZCollection, dest: IndexedReadWriteXYZCollection, chordTolerance: number) {
    dest.clear();
    const n = source.length;
    if (n === 1) {
      dest.push(source.getPoint3dAtCheckedPointIndex(0)!);
      return;
    }
    const context = new PolylineCompressionContext(source, dest, chordTolerance);
    // Do compression on inclusive interval from indexA to indexB, with indices interpreted cyclically if closed
    let indexA = 0;
    let indexB = n - 1;
    if (n > 2 && source.distanceIndexIndex(0, n - 1)! <= chordTolerance) {
      // cyclic data. It is possible that the wrap point itself has to be seen as an internal point.
      // do the search from point index where there is a large triangle . ..
      const maxCrossProductIndex = context.indexOfMaxCrossProduct(0, n - 1);
      if (maxCrossProductIndex !== undefined) {
        indexA = maxCrossProductIndex + 1;
        indexB = indexA + n;
      }
    }
    context.acceptPointByIndex(indexA);
    context.recursiveCompressByChordErrorGo(indexA, indexB);
  }
  /** Copy points from source to dest, omitting those too close to predecessor.
   * * First and last points are always preserved.
   */
  public static compressInPlaceByShortEdgeLength(data: GrowableXYZArray, edgeLength: number) {
    const n = data.length;
    if (n < 2)
      return;
    let lastAcceptedIndex = 0;
    // back up from final point ..
    let indexB = n - 1;
    while (indexB > 0 && data.distanceIndexIndex(indexB - 1, n - 1)! < edgeLength)
      indexB--;
    if (indexB === 0) {
      // Theres only one point there.
      data.length = 1;
      return;
    }
    // we want the exact bits of the final point even if others were nearby ..
    if (indexB < n - 1)
      data.moveIndexToIndex(n - 1, indexB);
    let candidateIndex = lastAcceptedIndex + 1;
    while (candidateIndex <= indexB) {
      const d = data.distanceIndexIndex(lastAcceptedIndex, candidateIndex)!;
      if (d >= edgeLength) {
        data.moveIndexToIndex(candidateIndex, lastAcceptedIndex + 1);
        lastAcceptedIndex++;
      }
      candidateIndex++;
    }
    data.length = lastAcceptedIndex + 1;
  }

  /** Copy points from source to dest, omitting those too close to predecessor.
   * * First and last points are always preserved.
   */
  public static compressInPlaceBySmallTriangleArea(data: GrowableXYZArray, triangleArea: number) {
    const n = data.length;
    if (n < 3)
      return;
    let lastAcceptedIndex = 0;
    const cross = Vector3d.create();
    for (let i1 = 1; i1 + 1 < n; i1++) {
      data.crossProductIndexIndexIndex(lastAcceptedIndex, i1, i1 + 1, cross);
      if (0.5 * cross.magnitude() > triangleArea) {
        data.moveIndexToIndex(i1, ++lastAcceptedIndex);
      }
    }
    data.moveIndexToIndex(n - 1, ++lastAcceptedIndex);
    data.length = lastAcceptedIndex + 1;
  }

  /** Copy points from source to dest, omitting those too close to edge between neighbors.
   * * First and last points are always preserved.
   */
  public static compressInPlaceByPerpendicularDistance(data: GrowableXYZArray, perpendicularDistance: number, maxExtensionFraction = 1.0001) {
    const n = data.length;
    if (n < 3)
      return;
    let lastAcceptedIndex = 0;
    const vector01 = PolylineCompressionContext._vector01;
    const vectorQ = PolylineCompressionContext._vectorQ;
    let distanceSquared;
    const perpendicularDistanceSquared = perpendicularDistance * perpendicularDistance;
    let denominator;
    let i1 = 1;
    for (; i1 + 1 < n; i1++) {
      data.vectorIndexIndex(lastAcceptedIndex, i1 + 1, vector01);
      data.vectorIndexIndex(lastAcceptedIndex, i1, vectorQ);
      denominator = vector01.magnitudeSquared();
      const s = Geometry.conditionalDivideFraction(vectorQ.dotProduct(vector01), denominator);
      if (s !== undefined) {
        if (s >= 0.0 && s <= maxExtensionFraction) {
          distanceSquared = PolylineCompressionContext._vectorQ.magnitudeSquared() - denominator * s * s;
          if (distanceSquared <= perpendicularDistanceSquared) {
            // force accept of point i1+1 .
            data.moveIndexToIndex(i1 + 1, ++lastAcceptedIndex);
            i1 = i1 + 1;
            continue;
          }
        }
      }
      data.moveIndexToIndex(i1, ++lastAcceptedIndex);
    }
    if (i1 < n)
      data.moveIndexToIndex(i1, ++lastAcceptedIndex);
    data.length = lastAcceptedIndex + 1;
  }
  /**
   * IF the first and last points are close AND first and last segments are colinear, remove first and last points.  Prior second to last becomes replicated start and end.
   * * Expected to be called "last" after other compressions, so points "next to" shared first and last are good to keep.
   * @param points
   * @param perpendicularDistance
   */
  public static compressColinearWrapInPlace(points: Point3d[], tolerance: number) {
    const lastIndex = points.length - 1;
    if (lastIndex >= 3 && points[0].distance(points[lastIndex]) < tolerance) {
      // indices of 3 points potentially colinear.
      const indexA = lastIndex - 1;
      const indexB = 0;
      const indexC = 1;
      const vectorU = Vector3d.createStartEnd(points[indexA], points[indexC]);
      const vectorV = Vector3d.createStartEnd(points[indexA], points[indexB]);
      const uDotU = vectorU.dotProduct(vectorU);
      const uDotV = vectorU.dotProduct(vectorV);
      const fraction = Geometry.conditionalDivideFraction(uDotV, uDotU);
      if (fraction !== undefined && fraction > 0.0 && fraction < 1.0) {
        const h2 = vectorV.magnitudeSquared() - fraction * fraction * uDotU;
        if (Math.sqrt(Math.abs(h2)) < tolerance) {
          points[0] = points[indexA];
          points.pop();
        }
      }
    }
  }
}
