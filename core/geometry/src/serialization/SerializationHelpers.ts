/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Serialization
 */
import { assert } from "console";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../bspline/BSplineCurve3dH";
import { BSplineSurface3d, BSplineSurface3dH } from "../bspline/BSplineSurface";
import { BSplineWrapMode, KnotVector } from "../bspline/KnotVector";

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
    dim: number;                          // # coordinates per pole = inner dimension of poles (3,4)
    weights?: number[] | Float64Array;    // if defined, poles are assumed to be weighted and dim 3
    params: BSplineParams;
  }
  export interface BSplineSurfaceData {
    poles: number[][][] | Float64Array;
    dim: number;                          // # coordinates per pole = inner dimension of poles (3,4)
    weights?: number[][] | Float64Array;  // if defined, poles are assumed to be weighted and dim 3
    uParams: BSplineParams;               // uParams.numPoles = # cols (middle dimension) of poles
    vParams: BSplineParams;               // vParams.numPoles = # rows (outer dimension) of poles
  }

  /** Constructor with required data */
  export function createBSplineCurveData(poles: number[][] | Float64Array, dim: number, knots: number[] | Float64Array, numPoles: number, order: number): BSplineCurveData {
    return {poles, dim, params: {numPoles, order, knots}};
  }

  /** Constructor with required data */
  export function createBSplineSurfaceData(poles: number[][][] | Float64Array, dim: number, uKnots: number[] | Float64Array, uNumPoles: number, uOrder: number, vKnots: number[] | Float64Array, vNumPoles: number, vOrder: number): BSplineSurfaceData {
    return {poles, dim, uParams: {numPoles: uNumPoles, order: uOrder, knots: uKnots}, vParams: {numPoles: vNumPoles, order: vOrder, knots: vKnots}};
  }

  export class Import {
    /**
     * Recognize the special legacy periodic B-spline data of mode BSplineWrapMode.OpenByRemovingKnots, and return the corresponding modern open clamped knots.
     * * Note that the B-spline poles corresponding to the converted knots remain unchanged, but it is assumed that first and last poles are equal.
     * * Example: the legacy 7-point quadratic circle periodic knots {-1/3 0 0 0 1/3 1/3 2/3 2/3 1 1 1 4/3} are converted to open knots {0 0 1/3 1/3 2/3 2/3 1 1}.
     * * General form of knot vector (k = order, d = k-1 = degree, p = numPoles):
     * * * legacy input: {k/2 periodically extended knots} {start knot multiplicity k} {p-k interior knots} {end knot multiplicity k} {d/2 periodically extended knots}
     * * * converted output: {start knot multiplicity d} {p-k interior knots} {end knot multiplicity d}
     * @param knots knot vector to test
     * @param numPoles number of poles
     * @param order curve order
     * @returns modern clamped knots (with same type as input) if legacy periodic B-spline input data is detected; otherwise undefined
     */
     private static openLegacyPeriodicKnots(knots: number[] | Float64Array, numPoles: number, order: number): number[] | Float64Array | undefined {
      const numKnots = knots.length;
      if (order >= 2 && numPoles + 2 * order - 1 === numKnots) {
        const startKnot = knots[order - 1];
        const endKnot = knots[numKnots - order];
        let iStart0 = Math.floor(order / 2);  // index of first expected multiple of the start knot
        const iEnd0 = iStart0 + numPoles;     // index of first expected multiple of the end knot
        let iEnd1 = iEnd0 + order;            // one past index of last expected multiple of the end knot
        for (let i = 0; i < order; ++i) {
          if (Math.abs(knots[iStart0 + i] - startKnot) >= KnotVector.knotTolerance)
            return undefined;   // start knot multiplicity too small
          if (Math.abs(knots[iEnd0 + i] - endKnot) >= KnotVector.knotTolerance)
            return undefined;   // end knot multiplicity too small
        }
        // copy only the "minimal" set - without the extraneous (classic) start and end knot
        ++iStart0;
        --iEnd1;
        assert(iEnd1 - iStart0 === numPoles + order - 2);
        if (knots instanceof Float64Array) {
          const newKnots = new Float64Array(iEnd1 - iStart0);
          for (let i = iStart0, j = 0; i < iEnd1; i++, j++)
            newKnots[j] = knots[i];
          return newKnots;
        } else {
          const newKnots: number[] = [];
          for (let i = iStart0; i < iEnd1; i++)
            newKnots.push(knots[i]);
          return newKnots;
        }
      }
      return undefined;   // unrecognized count condition
    }

    /** Copy from source to dest, but only if dest is empty. */
    private static copyBSplineCurvePolesIfEmpty(outPoles: number[][], outWeights: number[], source: BSplineCurveData): boolean {
      if (outPoles.length > 0 || outWeights.length > 0)
        return true;  // NOOP

      let nPoleOuter = 0;
      let nPoleInner = 0;
      let nPoleCoords = 0;
      let poleDimProduct = 0;
      if (source.poles instanceof Float64Array) {
        nPoleOuter = source.params.numPoles;
        nPoleInner = source.dim;
        nPoleCoords = source.poles.length;
        poleDimProduct = nPoleOuter * nPoleInner;
      } else {
        nPoleOuter = source.poles.length;
        if (nPoleOuter > 0)
          nPoleInner = source.poles[0].length;
        nPoleCoords = poleDimProduct = nPoleOuter * nPoleInner;
      }
      if (0 === poleDimProduct || poleDimProduct > nPoleCoords || nPoleInner !== source.dim) {
        assert(!"copyBSplineCurvePolesIfEmpty: invalid pole input");
        return false;
      }

      let nWeightOuter = 0;
      const nWeightInner = 1;   // weights are scalars
      let nWeights = 0;
      let weightDimProduct = 0;
      if (source.weights !== undefined) {
        if (source.weights instanceof Float64Array) {
          nWeightOuter = source.params.numPoles;
          nWeights = source.weights.length;
          weightDimProduct = nWeightOuter * nWeightInner;
        } else {
          nWeightOuter = source.weights.length;
          nWeights = weightDimProduct = nWeightOuter * nWeightInner;
        }
        if (0 === weightDimProduct || weightDimProduct > nWeights || nWeightOuter !== nPoleOuter) {
          assert(!"copyBSplineCurvePolesIfEmpty: invalid weight input");
          return false;
        }
      }

      for (let i = 0, c = 0; i < nPoleOuter && c < nPoleCoords; ++i) {
        const newPt = [];
        for (let j = 0; j < nPoleInner; ++j) {
          if (source.poles instanceof Float64Array)
            newPt.push(source.poles[c++]);
          else
            newPt.push(source.poles[i][j]);
        }
        outPoles.push(newPt);
      }

      if (source.weights !== undefined) {
        for (let i = 0, c = 0; i < nWeightOuter && c < nWeights; ++i) {
          if (source.weights instanceof Float64Array)
            outWeights.push(source.weights[c++]);
          else
            outWeights.push(source.weights[i]);
        }
      }
      return true;
    }

    /** Copy from source to dest, but only if dest is empty. */
    private static copyBSplineSurfacePolesIfEmpty(outPoles: number[][][], outWeights: number[][], source: BSplineSurfaceData): boolean {
      if (outPoles.length > 0 || outWeights.length > 0)
        return true;  // NOOP

      let nPoleOuter = 0;
      let nPoleMiddle = 0;
      let nPoleInner = 0;
      let nPoleCoords = 0;
      let poleDimProduct = 0;
      if (source.poles instanceof Float64Array) {
        nPoleOuter = source.vParams.numPoles;
        nPoleMiddle = source.uParams.numPoles;
        nPoleInner = source.dim;
        nPoleCoords = source.poles.length;
        poleDimProduct = nPoleOuter * nPoleMiddle * nPoleInner;
      } else {
        nPoleOuter = source.poles.length;
        if (nPoleOuter > 0)
          nPoleMiddle = source.poles[0].length;
        if (nPoleMiddle > 0)
          nPoleInner = source.poles[0][0].length;
        nPoleCoords = poleDimProduct = nPoleOuter * nPoleMiddle * nPoleInner;
      }
      if (0 === poleDimProduct || poleDimProduct > nPoleCoords || nPoleInner !== source.dim) {
        assert(!"copyBSplineSurfacePolesIfEmpty: invalid pole input");
        return false;
      }

      let nWeightOuter = 0;
      let nWeightMiddle = 0;
      const nWeightInner = 1;   // weights are scalars
      let nWeights = 0;
      let weightDimProduct = 0;
      if (source.weights !== undefined) {
        if (source.weights instanceof Float64Array) {
          nWeightOuter = source.vParams.numPoles;
          nWeightMiddle = source.uParams.numPoles;
          nWeights = source.weights.length;
          weightDimProduct = nWeightOuter * nWeightMiddle * nWeightInner;
        } else {
          nWeightOuter = source.weights.length;
          if (nWeightOuter > 0)
            nWeightMiddle = source.weights[0].length;
          nWeights = weightDimProduct = nWeightOuter * nWeightMiddle * nWeightInner;
        }
        if (0 === weightDimProduct || weightDimProduct > nWeights || nWeightOuter !== nPoleOuter || nWeightMiddle !== nPoleMiddle) {
          assert(!"copyBSplineSurfacePolesIfEmpty: invalid weight input");
          return false;
        }
      }

      for (let i = 0, c = 0; i < nPoleOuter && c < nPoleCoords; ++i) {
        const newRow = [];
        for (let j = 0; j < nPoleMiddle; ++j) {
          const newPt = [];
          for (let k = 0; k < nPoleInner; ++k) {
            if (source.poles instanceof Float64Array)
              newPt.push(source.poles[c++]);
            else
              newPt.push(source.poles[i][j][k]);
          }
          newRow.push(newPt);
        }
        outPoles.push(newRow);
      }

      if (source.weights !== undefined) {
        for (let i = 0, c = 0; i < nWeightOuter && c < nWeights; ++i) {
          const newRow = [];
          for (let j = 0; j < nWeightMiddle; ++j) {
            if (source.weights instanceof Float64Array)
              newRow.push(source.weights[c++]);
            else
              newRow.push(source.weights[i][j]);
          }
          outWeights.push(newRow);
        }
      }
      return true;
    }

   /** Prepare data for import. Input types of arrays are preserved. */
   public static prepareBSplineCurveData(data: BSplineCurveData): boolean {
      const polesExpanded: number[][] = [];
      const weightsExpanded: number[] = [];
      data.params.wrapMode = undefined;

      if (true === data.params.closed) {
        const knotsCorrected = this.openLegacyPeriodicKnots(data.params.knots, data.params.numPoles, data.params.order);
        if (undefined !== knotsCorrected) {
          data.params.knots = knotsCorrected;   // knots corrected, poles are OK
          data.params.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          if (!this.copyBSplineCurvePolesIfEmpty(polesExpanded, weightsExpanded, data))
            return false; // invalid input
          for (let i = 0; i < data.params.order - 1; ++i) {
            const wraparoundPt = [];
            for (let j = 0; j < data.dim; ++j)
              wraparoundPt.push(polesExpanded[i][j]);
            polesExpanded.push(wraparoundPt);  // append degree wraparound poles
          }
          if (weightsExpanded.length > 0) {
            for (let i = 0; i < data.params.order - 1; ++i)
              weightsExpanded.push(weightsExpanded[i]); // append degree wraparound weights
          }
          data.params.numPoles += data.params.order - 1;
          data.params.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      // preserve type of input poles/weights if we expanded them
      if (polesExpanded.length > 0) {
        if (data.poles instanceof Float64Array) {
          const newPoles = new Float64Array(polesExpanded.length * polesExpanded[0].length);
          let i = 0;
          for (const point of polesExpanded)
            for (const coord of point)
              newPoles[i++] = coord;
          data.poles = newPoles;
        } else {
          data.poles = polesExpanded;
        }
      }
      if (weightsExpanded.length > 0) {
        if (data.weights instanceof Float64Array) {
          const newWeights = new Float64Array(weightsExpanded.length);
          let i = 0;
          for (const weight of weightsExpanded)
            newWeights[i++] = weight;
          data.weights = newWeights;
        } else {
          data.weights = weightsExpanded;
        }
      }

      data.params.closed = undefined;  // we are open
      return true;
    }

    /** Prepare data for import. Input types of arrays are preserved. */
    public static prepareBSplineSurfaceData(data: BSplineSurfaceData): boolean {
      const polesExpanded: number[][][] = [];
      const weightsExpanded: number[][] = [];
      data.uParams.wrapMode = data.vParams.wrapMode = undefined;

      if (true === data.uParams.closed) {
        const uKnotsCorrected = this.openLegacyPeriodicKnots(data.uParams.knots, data.uParams.numPoles, data.uParams.order);
        if (undefined !== uKnotsCorrected) {
          data.uParams.knots = uKnotsCorrected;   // knots corrected, poles are OK
          data.uParams.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          if (!this.copyBSplineSurfacePolesIfEmpty(polesExpanded, weightsExpanded, data))
            return false; // invalid input
          for (let i = 0; i < data.vParams.numPoles; ++i) {     // #rows
            for (let j = 0; j < data.uParams.order - 1; ++j) {
              const wraparoundPt = [];
              for (let k = 0; k < data.dim; ++k)
                wraparoundPt.push(polesExpanded[i][j][k]);
              polesExpanded[i].push(wraparoundPt);  // append degreeU wraparound poles to each row
            }
          }
          if (weightsExpanded.length > 0) {
            for (let i = 0; i < data.vParams.numPoles; ++i)     // #rows
              for (let j = 0; j < data.uParams.order - 1; ++j)
                weightsExpanded[i].push(weightsExpanded[i][j]); // append degreeU wraparound weights to each row
          }
          data.uParams.numPoles += data.uParams.order - 1;
          data.uParams.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      if (true === data.vParams.closed) {
        const vKnotsCorrected = this.openLegacyPeriodicKnots(data.vParams.knots, data.vParams.numPoles, data.vParams.order);
        if (undefined !== vKnotsCorrected) {
          data.vParams.knots = vKnotsCorrected;   // knots corrected, poles are OK
          data.vParams.wrapMode = BSplineWrapMode.OpenByRemovingKnots;
        } else {
          if (!this.copyBSplineSurfacePolesIfEmpty(polesExpanded, weightsExpanded, data))
            return false; // invalid input
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
          if (weightsExpanded.length > 0) {
            for (let i = 0; i < data.vParams.order - 1; ++i) {
              const wrapAroundRow = [];
              for (let j = 0; j < data.uParams.numPoles; ++j)   // #cols
                wrapAroundRow.push(weightsExpanded[i][j]);
              weightsExpanded.push(wrapAroundRow);  // append degreeV wraparound rows of poles
            }
          }
          data.vParams.numPoles += data.vParams.order - 1;
          data.vParams.wrapMode = BSplineWrapMode.OpenByAddingControlPoints;
        }
      }

      // preserve type of input poles/weights if we expanded them
      if (polesExpanded.length > 0) {
        if (data.poles instanceof Float64Array) {
          const newPoles = new Float64Array(polesExpanded.length * polesExpanded[0].length * polesExpanded[0][0].length);
          let i = 0;
          for (const row of polesExpanded)
            for (const point of row)
              for (const coord of point)
                newPoles[i++] = coord;
          data.poles = newPoles;
        } else {
          data.poles = polesExpanded;
        }
      }
      if (weightsExpanded.length > 0) {
        if (data.weights instanceof Float64Array) {
          const newWeights = new Float64Array(weightsExpanded.length * weightsExpanded[0].length);
          let i = 0;
          for (const row of weightsExpanded)
            for (const weight of row)
              newWeights[i++] = weight;
          data.weights = newWeights;
        } else {
          data.weights = weightsExpanded;
        }
      }

      data.uParams.closed = data.vParams.closed = undefined;  // we are open
      return true;
    }
  }

  export class Export {
    public static extractBSplineCurveData(_in: BSplineCurve3d | BSplineCurve3dH): BSplineCurveData | undefined {
      return undefined;
    }

    // TODO: callers will need static version of getPointGridJSON, copyXYZ/WeightsToFloat64Array that takes the Float64Array we return
    public static extractBSplineSurfaceData(_in: BSplineSurface3d | BSplineSurface3dH): BSplineSurfaceData | undefined {
      return undefined;
    }

  }
}
