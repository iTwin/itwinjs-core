/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Serialization
 */
import { BSplineWrapMode, KnotVector } from "../bspline/KnotVector";
import { NumberArray } from "../geometry3d/PointHelpers";

/**
 * `SerializationHelpers` namespace has helper classes for serializing and deserializing geometry.
 * @internal
 */
export namespace SerializationHelpers {
  export interface BSplineParams {
    numPoles: number;
    order: number;
    closed?: boolean;
    knots: number[] | Float64Array;
    wrapMode?: BSplineWrapMode;
  }
  export interface BSplineCurveData {
    poles: number[][] | Float64Array;
    dim: number;                          // # coordinates per pole = inner dimension of poles array (3,4)
    weights?: number[] | Float64Array;    // if defined, poles are assumed to be weighted and dim 3
    params: BSplineParams;
  }
  export interface BSplineSurfaceData {
    poles: number[][][] | Float64Array;
    dim: number;                          // # coordinates per pole = inner dimension of poles array (3,4)
    weights?: number[][] | Float64Array;  // if defined, poles are assumed to be weighted and dim 3
    uParams: BSplineParams;               // uParams.numPoles = # cols (middle dimension) of poles
    vParams: BSplineParams;               // vParams.numPoles = # rows (outer dimension) of poles
  }
  export interface BSplineDataOptions {
    jsonPoles?: boolean;        // type of output pole/weight arrays. true: structured number array; false: Float64Array; undefined: either
    jsonKnots?: boolean;        // type of output knot arrays. true: number array; false: Float64Array; undefined: either
    removeExtraKnots?: boolean; // extraneous knot handling during Import: true: remove them; false | undefined: leave them. Has no effect during Export, which always outputs the extraneous knots.
  }

  /** Constructor with required data. Inputs are captured, not copied. */
  export function createBSplineCurveData(poles: number[][] | Float64Array, dim: number, knots: number[] | Float64Array, numPoles: number, order: number): BSplineCurveData {
    return { poles, dim, params: { numPoles, order, knots } };
  }

  /** Constructor with required data. Inputs are captured, not copied. */
  export function createBSplineSurfaceData(poles: number[][][] | Float64Array, dim: number, uKnots: number[] | Float64Array, uNumPoles: number, uOrder: number, vKnots: number[] | Float64Array, vNumPoles: number, vOrder: number): BSplineSurfaceData {
    return { poles, dim, uParams: { numPoles: uNumPoles, order: uOrder, knots: uKnots }, vParams: { numPoles: vNumPoles, order: vOrder, knots: vKnots } };
  }

  /** Clone curve data */
  export function cloneBSplineCurveData(source: BSplineCurveData): BSplineCurveData {
    return {
      poles: (source.poles instanceof Float64Array) ? new Float64Array(source.poles) : NumberArray.copy2d(source.poles),
      dim: source.dim,
      weights: source.weights ? source.weights.slice() : undefined,
      params: {
        numPoles: source.params.numPoles,
        order: source.params.order,
        closed: source.params.closed,
        knots: source.params.knots.slice(),
        wrapMode: source.params.wrapMode,
      },
    };
  }

  /** Clone surface data */
  export function cloneBSplineSurfaceData(source: BSplineSurfaceData): BSplineSurfaceData {
    return {
      poles: (source.poles instanceof Float64Array) ? new Float64Array(source.poles) : NumberArray.copy3d(source.poles),
      dim: source.dim,
      weights: source.weights ? ((source.weights instanceof Float64Array) ? source.weights.slice() : NumberArray.copy2d(source.weights)) : undefined,
      uParams: {
        numPoles: source.uParams.numPoles,
        order: source.uParams.order,
        closed: source.uParams.closed,
        knots: source.uParams.knots.slice(),
        wrapMode: source.uParams.wrapMode,
      },
      vParams: {
        numPoles: source.vParams.numPoles,
        order: source.vParams.order,
        closed: source.vParams.closed,
        knots: source.vParams.knots.slice(),
        wrapMode: source.vParams.wrapMode,
      },
    };
  }

  /** Copy from source to dest */
  function copyBSplineCurveDataPoles(source: BSplineCurveData): {poles?: number[][], weights?: number[]} {
    let nPole = 0;
    let nCoordPerPole = 0;
    let nPoleCoords = 0;
    let poleDimProduct = 0;
    if (source.poles instanceof Float64Array) {
      nPole = source.params.numPoles;
      nCoordPerPole = source.dim;
      nPoleCoords = source.poles.length;
      poleDimProduct = nPole * nCoordPerPole;
    } else {
      nPole = source.poles.length;
      if (nPole > 0)
        nCoordPerPole = source.poles[0].length;
      nPoleCoords = poleDimProduct = nPole * nCoordPerPole;
    }
    if (0 === poleDimProduct || poleDimProduct > nPoleCoords || nCoordPerPole !== source.dim)
      return {};

    let nWeight = 0;
    let nWeightCoords = 0;
    let weightDimProduct = 0;
    if (source.weights !== undefined) {
      if (source.weights instanceof Float64Array) {
        nWeight = source.params.numPoles;
        nWeightCoords = source.weights.length;
        weightDimProduct = nWeight;
      } else {
        nWeight = source.weights.length;
        nWeightCoords = weightDimProduct = nWeight;
      }
      if (0 === weightDimProduct || weightDimProduct > nWeightCoords || nWeight !== nPole)
        return {};
    }

    // convert variant source to structured number array
    let poles: number[][] | undefined;
    let weights: number[] | undefined;
    if (source.poles instanceof Float64Array)
      poles = NumberArray.unpack2d(source.poles, nCoordPerPole);
    else
      poles = NumberArray.copy2d(source.poles);
    if (poles && source.weights)
      weights = NumberArray.create(source.weights);
    return {poles, weights};
  }

  /** Copy from source to dest */
  function copyBSplineSurfaceDataPoles(source: BSplineSurfaceData): {poles?: number[][][], weights?: number[][]} {
    let nPoleRow = 0;
    let nPolePerRow = 0;
    let nCoordPerPole = 0;
    let nCoords = 0;
    let poleDimProduct = 0;
    if (source.poles instanceof Float64Array) {
      nPoleRow = source.vParams.numPoles;
      nPolePerRow = source.uParams.numPoles;
      nCoordPerPole = source.dim;
      nCoords = source.poles.length;
      poleDimProduct = nPoleRow * nPolePerRow * nCoordPerPole;
    } else {
      nPoleRow = source.poles.length;
      if (nPoleRow > 0)
        nPolePerRow = source.poles[0].length;
      if (nPolePerRow > 0)
        nCoordPerPole = source.poles[0][0].length;
      nCoords = poleDimProduct = nPoleRow * nPolePerRow * nCoordPerPole;
    }
    if (0 === poleDimProduct || poleDimProduct > nCoords || nCoordPerPole !== source.dim)
      return {};

    let nWeightRow = 0;
    let nWeightPerRow = 0;
    let nWeightCoords = 0;
    let weightDimProduct = 0;
    if (source.weights !== undefined) {
      if (source.weights instanceof Float64Array) {
        nWeightRow = source.vParams.numPoles;
        nWeightPerRow = source.uParams.numPoles;
        nWeightCoords = source.weights.length;
        weightDimProduct = nWeightRow * nWeightPerRow;
      } else {
        nWeightRow = source.weights.length;
        if (nWeightRow > 0)
          nWeightPerRow = source.weights[0].length;
        nWeightCoords = weightDimProduct = nWeightRow * nWeightPerRow;
      }
      if (0 === weightDimProduct || weightDimProduct > nWeightCoords || nWeightRow !== nPoleRow || nWeightPerRow !== nPolePerRow)
        return {};
    }

    // convert variant source to structured number array
    let poles: number[][][] | undefined;
    let weights: number[][] | undefined;
    if (source.poles instanceof Float64Array)
      poles = NumberArray.unpack3d(source.poles, nPolePerRow, nCoordPerPole);
    else
      poles = NumberArray.copy3d(source.poles);
    if (poles && source.weights) {
      if (source.weights instanceof Float64Array)
        weights = NumberArray.unpack2d(source.weights, nWeightPerRow);
      else
        weights = NumberArray.copy2d(source.weights);
    }
    return {poles, weights};
  }

  /** Convert data arrays to the types specified by options. */
  function convertBSplineCurveDataArrays(data: BSplineCurveData, options?: BSplineDataOptions) {
    if (undefined !== options?.jsonPoles) {
      const packedPoles = data.poles instanceof Float64Array;
      if (options.jsonPoles && packedPoles)
        data.poles = NumberArray.unpack2d(data.poles as Float64Array, data.dim)!;
      else if (!options.jsonPoles && !packedPoles)
        data.poles = NumberArray.pack(data.poles as number[][]);

      if (data.weights) {
        const packedWeights = data.weights instanceof Float64Array;
        if (options.jsonPoles && packedWeights)
          data.weights = NumberArray.create(data.weights);
        else if (!options.jsonPoles && !packedWeights)
          data.weights = NumberArray.pack(data.weights as number[]);
      }
    }
    if (undefined !== options?.jsonKnots) {
      const packedKnots = data.params.knots instanceof Float64Array;
      if (options.jsonKnots && packedKnots)
        data.params.knots = NumberArray.create(data.params.knots);
      else if (!options.jsonKnots && !packedKnots)
        data.params.knots = NumberArray.pack(data.params.knots as number[]);
    }
  }

  /** Convert data arrays to the types specified by options. */
  function convertBSplineSurfaceDataArrays(data: BSplineSurfaceData, options?: BSplineDataOptions) {
    if (undefined !== options?.jsonPoles) {
      const packedPoles = data.poles instanceof Float64Array;
      if (options.jsonPoles && packedPoles)
        data.poles = NumberArray.unpack3d(data.poles as Float64Array, data.uParams.numPoles, data.dim)!;
      else if (!options.jsonPoles && !packedPoles)
        data.poles = NumberArray.pack(data.poles as number[][][]);

      if (data.weights) {
        const packedWeights = data.weights instanceof Float64Array;
        if (options.jsonPoles && packedWeights)
          data.weights = NumberArray.unpack2d(data.weights as Float64Array, data.uParams.numPoles);
        else if (!options.jsonPoles && !packedWeights)
          data.weights = NumberArray.pack(data.weights as number[][]);
      }
    }
    if (undefined !== options?.jsonKnots) {
      const packedKnotsU = data.uParams.knots instanceof Float64Array;
      if (options.jsonKnots && packedKnotsU)
        data.uParams.knots = NumberArray.create(data.uParams.knots);
      else if (!options.jsonKnots && !packedKnotsU)
        data.uParams.knots = NumberArray.pack(data.uParams.knots as number[]);

      const packedKnotsV = data.vParams.knots instanceof Float64Array;
      if (options.jsonKnots && packedKnotsV)
        data.vParams.knots = NumberArray.create(data.vParams.knots);
      else if (!options.jsonKnots && !packedKnotsV)
        data.vParams.knots = NumberArray.pack(data.vParams.knots as number[]);
    }
  }

  export class Import {
    /** copy knots, with options to control destination type and extraneous knot removal */
    private static copyKnots(knots: Float64Array | number[], options?: BSplineDataOptions, iStart?: number, iEnd?: number): Float64Array| number[] {
      if (undefined === iStart)
        iStart = 0;
      if (undefined === iEnd)
        iEnd = knots.length;
      if (options?.removeExtraKnots) {
        ++iStart; // ignore start knot
        --iEnd;   // ignore end knot
      }
      let newNumKnots = iEnd - iStart;
      if (newNumKnots < 0)
        newNumKnots = 0;
      const newKnots = options?.jsonKnots ? new Array<number>(newNumKnots) : new Float64Array(newNumKnots);
      for (let i = iStart, k = 0; i < iEnd; i++, k++)
        newKnots[k] = knots[i];
      return newKnots;
    }

    /**
     * Recognize the special legacy periodic B-spline data of mode BSplineWrapMode.OpenByRemovingKnots, and return the corresponding modern open clamped knots.
     * * Note that the B-spline poles corresponding to the converted knots remain unchanged, but it is assumed that first and last poles are equal.
     * * Example: the legacy 7-point quadratic circle periodic knots {-1/3 0 0 0 1/3 1/3 2/3 2/3 1 1 1 4/3} are converted to open knots {0 0 1/3 1/3 2/3 2/3 1 1}.
     * * General form of knot vector (k = order, d = k-1 = degree, p = numPoles):
     * * * legacy input: {k/2 periodically extended knots} {start knot multiplicity k} {p-k interior knots} {end knot multiplicity k} {d/2 periodically extended knots}
     * * * converted output: {start knot multiplicity d} {p-k interior knots} {end knot multiplicity d}
     * @param knots classic knot vector to test
     * @param numPoles number of poles
     * @param order B-spline order
     * @param options for output type, extraneous knot removal
     * @returns open knots if legacy periodic B-spline input data is recognized; otherwise, undefined
     * @see Export.closeLegacyPeriodicKnots
     */
    private static openLegacyPeriodicKnots(knots: Float64Array | number[], numPoles: number, order: number, options?: BSplineDataOptions): Float64Array | number[] | undefined {
      const numKnots = knots.length;
      if (order < 2 || numPoles + 2 * order - 1 !== numKnots)
        return undefined;   // not legacy periodic knots

      const startKnot = knots[order - 1];
      const endKnot = knots[numKnots - order];
      const iStart0 = Math.floor(order / 2);  // index of first expected multiple of the start knot
      const iEnd0 = iStart0 + numPoles;       // index of first expected multiple of the end knot
      const iEnd1 = iEnd0 + order;            // one past index of last expected multiple of the end knot
      for (let i = 0; i < order; ++i) {
        if (Math.abs(knots[iStart0 + i] - startKnot) >= KnotVector.knotTolerance)
          return undefined;   // start knot multiplicity too small
        if (Math.abs(knots[iEnd0 + i] - endKnot) >= KnotVector.knotTolerance)
          return undefined;   // end knot multiplicity too small
      }
      return this.copyKnots(knots, options, iStart0, iEnd1);
    }

    /** Prepare imported B-spline curve data for eventual conversion to BSplineCurve3d | BSplineCurve3dH:
     * * Opens legacy "fake" periodic data by expanding knots
     * * Opens true periodic data by expanding poles and weights
     * @param data updated in place. If poles/weights/knots are updated, their respective arrays are reallocated.
     * @param options output specifications
     * @returns whether data was successfully prepared
     */
    public static prepareBSplineCurveData(data: BSplineCurveData, options?: BSplineDataOptions): boolean {
      let polesExpanded: number[][] | undefined;
      let weightsExpanded: number[] | undefined;
      let knotsCorrected: number[] | Float64Array | undefined;
      data.params.wrapMode = undefined;

      if (true === data.params.closed) {
        knotsCorrected = this.openLegacyPeriodicKnots(data.params.knots, data.params.numPoles, data.params.order, options);
        if (undefined !== knotsCorrected) {
          // legacy periodic knots removed, poles untouched
          data.params.knots = knotsCorrected;
          data.params.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          // wrap poles, knots untouched
          if (!polesExpanded) {
            const arrays = copyBSplineCurveDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesExpanded = arrays.poles;
            data.weights = weightsExpanded = arrays.weights;
          }
          for (let i = 0; i < data.params.order - 1; ++i) {
            const wraparoundPt = [];
            for (let j = 0; j < data.dim; ++j)
              wraparoundPt.push(polesExpanded[i][j]);
            polesExpanded.push(wraparoundPt);  // append degree wraparound poles
          }
          if (weightsExpanded) {
            for (let i = 0; i < data.params.order - 1; ++i)
              weightsExpanded.push(weightsExpanded[i]); // append degree wraparound weights
          }
          data.params.numPoles += data.params.order - 1;
          data.params.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      if (options?.removeExtraKnots) {
        if (!knotsCorrected)
          data.params.knots = this.copyKnots(data.params.knots, options);
      }

      data.params.closed = undefined;  // we are open

      convertBSplineCurveDataArrays(data, options);
      return true;
    }

    /** Prepare imported B-spline surface data for eventual conversion to BSplineSurface3d | BSplineSurface3dH:
     * * Opens legacy "fake" periodic data by expanding knots
     * * Opens true periodic data by expanding poles and weights
     * @param data updated in place. If poles/weights/knots are updated, their respective arrays are reallocated.
     * @param options output specifications
     * @returns whether data was successfully prepared
     */
    public static prepareBSplineSurfaceData(data: BSplineSurfaceData, options?: BSplineDataOptions): boolean {
      let polesExpanded: number[][][] | undefined;
      let weightsExpanded: number[][] | undefined;
      let uKnotsCorrected: number[] | Float64Array | undefined;
      let vKnotsCorrected: number[] | Float64Array | undefined;
      data.uParams.wrapMode = data.vParams.wrapMode = undefined;

      if (true === data.uParams.closed) {
        uKnotsCorrected = this.openLegacyPeriodicKnots(data.uParams.knots, data.uParams.numPoles, data.uParams.order, options);
        if (undefined !== uKnotsCorrected) {
          // legacy periodic knots removed, poles untouched
          data.uParams.knots = uKnotsCorrected;
          data.uParams.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          // wrap poles, knots untouched
          if (!polesExpanded) {
            const arrays = copyBSplineSurfaceDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesExpanded = arrays.poles;
            data.weights = weightsExpanded = arrays.weights;
          }
          for (let i = 0; i < data.vParams.numPoles; ++i) {     // #rows
            for (let j = 0; j < data.uParams.order - 1; ++j) {
              const wraparoundPt = [];
              for (let k = 0; k < data.dim; ++k)
                wraparoundPt.push(polesExpanded[i][j][k]);
              polesExpanded[i].push(wraparoundPt);  // append degreeU wraparound poles to each row
            }
          }
          if (weightsExpanded) {
            for (let i = 0; i < data.vParams.numPoles; ++i)     // #rows
              for (let j = 0; j < data.uParams.order - 1; ++j)
                weightsExpanded[i].push(weightsExpanded[i][j]); // append degreeU wraparound weights to each row
          }
          data.uParams.numPoles += data.uParams.order - 1;
          data.uParams.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      if (true === data.vParams.closed) {
        vKnotsCorrected = this.openLegacyPeriodicKnots(data.vParams.knots, data.vParams.numPoles, data.vParams.order, options);
        if (undefined !== vKnotsCorrected) {
          // legacy periodic knots removed, poles untouched
          data.vParams.knots = vKnotsCorrected;
          data.vParams.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          // wrap poles, knots untouched
          if (!polesExpanded) {
            const arrays = copyBSplineSurfaceDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesExpanded = arrays.poles;
            data.weights = weightsExpanded = arrays.weights;
          }
          for (let i = 0; i < data.vParams.order - 1; ++i) {
            const wrapAroundRow = [];
            for (let j = 0; j < data.uParams.numPoles; ++j) {    // #cols
              const wrapAroundPt = [];
              for (let k = 0; k < data.dim; ++k)
                wrapAroundPt.push(polesExpanded[i][j][k]);
              wrapAroundRow.push(wrapAroundPt);
            }
            polesExpanded.push(wrapAroundRow);  // append degreeV wraparound rows of poles
          }
          if (weightsExpanded) {
            for (let i = 0; i < data.vParams.order - 1; ++i) {
              const wrapAroundRow = [];
              for (let j = 0; j < data.uParams.numPoles; ++j)   // #cols
                wrapAroundRow.push(weightsExpanded[i][j]);
              weightsExpanded.push(wrapAroundRow);  // append degreeV wraparound rows of weights
            }
          }
          data.vParams.numPoles += data.vParams.order - 1;
          data.vParams.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      if (options?.removeExtraKnots) {
        if (!uKnotsCorrected)
          data.uParams.knots = this.copyKnots(data.uParams.knots, options);
        if (!vKnotsCorrected)
          data.vParams.knots = this.copyKnots(data.vParams.knots, options);
      }

      data.uParams.closed = data.vParams.closed = undefined;  // we are open

      convertBSplineSurfaceDataArrays(data, options);
      return true;
    }
  }

  export class Export {
    /**
     * Restore special legacy periodic B-spline knots opened via BSplineWrapMode.OpenByRemovingKnots logic.
     * @param knots modern knot vector: {start knot multiplicity d} {p-k interior knots} {end knot multiplicity d}
     * @param order B-spline order
     * @param options for output type
     * @param wrapMode wrap mode of the knots
     * @returns legacy periodic knots (with classic extraneous start/end knot) if wrapMode recognized; otherwise, undefined
     * @see Import.openLegacyPeriodicKnots
     */
    private static closeLegacyPeriodicKnots(knots: Float64Array | number[], order: number, options?: BSplineDataOptions, wrapMode?: BSplineWrapMode): Float64Array | number[] | undefined {
      if (wrapMode === undefined || wrapMode !== BSplineWrapMode.OpenByRemovingKnots)
        return undefined;

      const degree = order - 1;
      const leftIndex = degree - 1;
      const rightIndex = knots.length - degree;
      const leftKnot = knots[leftIndex];
      const rightKnot = knots[rightIndex];
      const knotPeriod = rightKnot - leftKnot;
      const newNumKnots = knots.length + degree + 2;
      const newKnots = options?.jsonKnots ? new Array<number>(newNumKnots) : new Float64Array(newNumKnots);

      let k = 0;
      for (let i = Math.floor(order / 2); i > 0; --i)
        newKnots[k++] = knots[rightIndex - i] - knotPeriod;
      newKnots[k++] = leftKnot;   // extraneous start knot
      for (const knot of knots)
        newKnots[k++] = knot;
      newKnots[k++] = rightKnot;  // extraneous end knot
      for (let i = 1; i <= Math.floor(degree / 2); ++i)
        newKnots[k++] = knots[leftIndex + i] + knotPeriod;

      return newKnots;
    }

    /**
     * Prepare data from a B-spline curve for export.
     *  * adds classic extraneous knot at start and end of knot vector
     *  * re-closes periodic data based on BSplineWrapMode
     * @param data updated in place. If poles/weights/knots are updated, their respective arrays are reallocated.
     * @param options output specifications
     * @returns whether data was successfully prepared
     */
    public static prepareBSplineCurveData(data: BSplineCurveData, options?: BSplineDataOptions): boolean {
      let polesTrimmed: number[][] | undefined;
      let weightsTrimmed: number[] | undefined;
      let knotsCorrected: number[] | Float64Array | undefined;
      data.params.closed = undefined;

      switch (data.params.wrapMode) {
        case BSplineWrapMode.OpenByRemovingKnots: {
          // add legacy periodic and extraneous knots, poles untouched
          knotsCorrected = this.closeLegacyPeriodicKnots(data.params.knots, data.params.order, options, data.params.wrapMode);
          if (undefined === knotsCorrected)
            return false; // invalid input
          data.params.knots = knotsCorrected;
          data.params.closed = true;
          break;
        }
        case BSplineWrapMode.OpenByAddingControlPoints: {
          // unwrap poles, knots untouched
          if (!polesTrimmed) {
            const arrays = copyBSplineCurveDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesTrimmed = arrays.poles;
            data.weights = weightsTrimmed = arrays.weights;
          }
          for (let i = 0; i < data.params.order - 1; ++i)
            polesTrimmed.pop(); // remove last degree poles
          if (weightsTrimmed) {
            for (let i = 0; i < data.params.order - 1; ++i)
              weightsTrimmed.pop(); // remove last degree weights
          }
          data.params.numPoles -= data.params.order - 1;
          data.params.closed = true;
          break;
        }
      }

      // always add extraneous knots
      if (!knotsCorrected)
        data.params.knots = KnotVector.copyKnots(data.params.knots, data.params.order - 1, true, data.params.wrapMode);

      convertBSplineCurveDataArrays(data, options);
      return true;
    }

    /**
     * Prepare data from a B-spline surface for export.
     *  * adds classic extraneous knot at start and end of knot vectors
     *  * re-closes periodic data based on BSplineWrapMode
     * @param data updated in place. If poles/weights/knots are updated, their respective arrays are reallocated.
     * @param options output specifications
     * @returns whether data was successfully prepared
     */
    public static prepareBSplineSurfaceData(data: BSplineSurfaceData, options?: BSplineDataOptions): boolean {
      let polesTrimmed: number[][][] | undefined;
      let weightsTrimmed: number[][] | undefined;
      let uKnotsCorrected: number[] | Float64Array | undefined;
      let vKnotsCorrected: number[] | Float64Array | undefined;
      data.uParams.closed = data.vParams.closed = undefined;

      switch (data.uParams.wrapMode) {
        case BSplineWrapMode.OpenByRemovingKnots: {
          // add legacy periodic and extraneous knots, poles untouched
          uKnotsCorrected = this.closeLegacyPeriodicKnots(data.uParams.knots, data.uParams.order, options, data.uParams.wrapMode);
          if (undefined === uKnotsCorrected)
            return false; // invalid input
          data.uParams.knots = uKnotsCorrected;
          data.uParams.closed = true;
          break;
        }
        case BSplineWrapMode.OpenByAddingControlPoints: {
          // unwrap poles, knots untouched
          if (!polesTrimmed) {
            const arrays = copyBSplineSurfaceDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesTrimmed = arrays.poles;
            data.weights = weightsTrimmed = arrays.weights;
          }
          for (let i = 0; i < data.vParams.numPoles; ++i)    // #rows
            for (let j = 0; j < data.uParams.order - 1; ++j)
              polesTrimmed[i].pop(); // remove last degreeU poles from each row
          if (weightsTrimmed) {
            for (let i = 0; i < data.vParams.numPoles; ++i)  // #rows
              for (let j = 0; j < data.uParams.order - 1; ++j)
                weightsTrimmed[i].pop(); // remove last degreeU weights from each row
          }
          data.uParams.numPoles -= data.uParams.order - 1;
          data.uParams.closed = true;
          break;
        }
      }

      switch (data.vParams.wrapMode) {
        case BSplineWrapMode.OpenByRemovingKnots: {
          // add legacy periodic and extraneous knots, poles untouched
          vKnotsCorrected = this.closeLegacyPeriodicKnots(data.vParams.knots, data.vParams.order, options, data.vParams.wrapMode);
          if (undefined === vKnotsCorrected)
            return false; // invalid input
          data.vParams.knots = vKnotsCorrected;
          data.vParams.closed = true;
          break;
        }
        case BSplineWrapMode.OpenByAddingControlPoints: {
          // unwrap poles, knots untouched
          if (!polesTrimmed) {
            const arrays = copyBSplineSurfaceDataPoles(data);
            if (undefined === arrays.poles)
              return false; // invalid input
            data.poles = polesTrimmed = arrays.poles;
            data.weights = weightsTrimmed = arrays.weights;
          }
          for (let i = 0; i < data.vParams.order - 1; ++i)
            polesTrimmed.pop();  // remove last degreeV rows of poles
          if (weightsTrimmed) {
            for (let i = 0; i < data.vParams.order - 1; ++i)
              weightsTrimmed.pop(); // remove last degreeV rows of weights
          }
          data.vParams.numPoles -= data.vParams.order - 1;
          data.vParams.closed = true;
          break;
        }
      }

      // always add extraneous knots
      if (!uKnotsCorrected)
        data.uParams.knots = KnotVector.copyKnots(data.uParams.knots, data.uParams.order - 1, true, data.uParams.wrapMode);
      if (!vKnotsCorrected)
        data.vParams.knots = KnotVector.copyKnots(data.vParams.knots, data.vParams.order - 1, true, data.vParams.wrapMode);

      convertBSplineSurfaceDataArrays(data, options);
      return true;
    }
  }
}
