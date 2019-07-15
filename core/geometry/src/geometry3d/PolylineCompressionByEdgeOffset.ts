import { Point3d, Vector3d } from "./Point3dVector3d";
import { IndexedXYZCollection, IndexedReadWriteXYZCollection } from "./IndexedXYZCollection";
import { Point3dArrayCarrier } from "./Point3dArrayCarrier";
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
   * * index is adjusted cyclically to source index range by modulo.
   */
  private acceptPointByIndex(i: number) {
    const point = this._source.getPoint3dAtCheckedPointIndex(this._source.cyclicIndex(i));
    if (point)
      this._dest.push(point);
  }
  /** work data used by find max deviation */
  private _vector01: Vector3d;
  private _vectorQ: Vector3d;
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
      this._source.crossProductIndexIndexIndex(iA, iB, iC, this._vectorQ);
      q = this._vectorQ.magnitudeSquared();
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
    this._source.vectorIndexIndex(i0, i1, this._vector01)!;
    const denominator = this._vector01.magnitudeSquared();
    for (let index = index0 + 1; index < index1; index++) {
      i = this._source.cyclicIndex(index);
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

  /**
   * Return a point array with a subset of the input points.
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
   *
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
    const context = new PolylineCompressByEdgeOffset(source, dest, chordTolerance);
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
    context.compressByChordErrorGo(indexA, indexB);
  }
}
