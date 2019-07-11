import { Point3d, Vector3d } from "./Point3dVector3d";
import { IndexedXYZCollection, IndexedReadWriteXYZCollection } from "./IndexedXYZCollection";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
import { Geometry } from "../Geometry";
// cspell:word Puecker
/** context class for Puecker-Douglas polyline compression, viz https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
 * @internal
 */
export class PolylineCompressByEdgeOffset {
  /** Caller provides source and tolerance.
   * * pointer to source is retained, but contents of source are never modified.
   */
  private constructor(source: IndexedXYZCollection, dest: IndexedReadWriteXYZCollection, tolerance: number) {
    this._toleranceSquared = tolerance * tolerance;
    this._vector01 = Vector3d.create();
    this._vectorQ = Vector3d.create();
    this._source = source;
    this._dest = dest;
  }
  private _source: IndexedXYZCollection;

  private _dest: IndexedReadWriteXYZCollection;

  /** Squared tolerance for equal point. */
  private _toleranceSquared: number;
  /** push (clone of) the point at index i from the source to the growing result.
   * * No action if the index is out of bounds.
   */
  private acceptPointByIndex(i: number) {
    const point = this._source.getPoint3dAtCheckedPointIndex(i);
    if (point)
      this._dest.push(point);
  }
  /** work data used by find max deviation */
  private _vector01: Vector3d;
  private _vectorQ: Vector3d;
  /**
   * Return interior index where max deviation in excess of tolerance occurs.
   * @param i0 first index of interval
   * @param i1 INCLUSIVE final index
   */
  private indexOfMaxDeviation(i0: number, i1: number): number | undefined {
    let maxDeviation = this._toleranceSquared;
    let maxDeviationIndex;
    let numerator;
    let distanceSquared;
    let s;
    this._source.vectorIndexIndex(i0, i1, this._vector01)!;
    const denominator = this._vector01.magnitudeSquared();
    for (let i = i0 + 1; i < i1; i++) {
      this._source.vectorIndexIndex(i0, i, this._vectorQ);
      numerator = this._vector01.dotProduct(this._vectorQ);
      if (numerator <= 0) {
        distanceSquared = this._vectorQ.magnitudeSquared();
      } else if (numerator > denominator) {
        this._source.vectorIndexIndex(i1, i, this._vectorQ);
        distanceSquared = this._vectorQ.magnitudeSquared();
      } else {
        s = numerator / denominator;
        distanceSquared = this._vectorQ.magnitudeSquared() - denominator * s * s;
      }
      if (distanceSquared > maxDeviation) {
        maxDeviation = distanceSquared;
        maxDeviationIndex = i;
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
  private compressByChordErrorGo(i0: number, i1: number) {
    if (i1 === i0 + 1) {
      this.acceptPointByIndex(i1);
      return;
    }
    const distantPointIndex = this.indexOfMaxDeviation(i0, i1);
    if (distantPointIndex === undefined) {
      this.acceptPointByIndex(i1); // which compresses out some points.
    } else {
      this.compressByChordErrorGo(i0, distantPointIndex);
      this.compressByChordErrorGo(distantPointIndex, i1);
    }
  }
  /** Test if source has closure from last to first point. */
  private static hasClosurePoint(source: IndexedXYZCollection): boolean {
    if (source.length > 2) {
      const d2 = source.distanceSquaredIndexIndex(0, source.length - 1);
      return Geometry.isSmallMetricDistance(d2);
    }
    return false;
  }
  /**
   * Return a point array with a subset of the input points.
   * @param source input points.
   * @param chordTolerance Points less than this distance from a retained edge may be ignored.
   */
  public static compressPoint3dArrayByChordError(source: Point3d[], chordTolerance: number): Point3d[] {
    const source1 = new Point3dArrayCarrier(source);
    const dest1 = new Point3dArrayCarrier([]);
    this.compressCollectionByChordError (source1, dest1, chordTolerance);
    return dest1.data;
  }
  /**
   *
   * @param source input points
   * @param dest output points.  Must be different from source.
   * @param chordTolerance Points less than this distance from a retained edge may be ignored.
   */
  public static compressCollectionByChordError(source: IndexedXYZCollection, dest: IndexedReadWriteXYZCollection, chordTolerance: number) {
    dest.clear();
    if (source.length > 1) {
      const context = new PolylineCompressByEdgeOffset(source, dest, chordTolerance);
      context.acceptPointByIndex(0);
      context.compressByChordErrorGo(0, source.length - 1);
      // enforce loop condition on result . . .
      if (this.hasClosurePoint(source) && !this.hasClosurePoint(dest))
        context.acceptPointByIndex(0);
    }
  }
}
