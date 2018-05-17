/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry, Angle } from "../Geometry";
/* tslint:disable:variable-name no-empty */

/** tolerance blob for various stroking methods.
 *
 * * The universal basic concepts:  chordTol, angleTol, maxEdgeLength
 * *
 */
export class StrokeOptions {

  /** distance from stroke to actual geometry */
  public chordTol?: number;
  /** turning angle betwee strokes. */
  public angleTol?: Angle;
  /** maximum length of a single stroke. */
  public maxEdgeLength?: number;
  /** minimum strokes on a primitive */
  public minStrokesPerPrimitive?: number;

  public needNormals?: boolean;
  public needParams?: boolean;
  public needColors?: boolean;
  public defaultCircleStrokes = 16;

  public hasMaxEdgeLength(): boolean { return this.maxEdgeLength !== undefined && this.maxEdgeLength > 0.0; }
  // return stroke count which is the larger of the minCount or count needed for edge length condition.
  public applyMaxEdgeLength(minCount: number, totalLength: number): number {
    if (this.maxEdgeLength && this.maxEdgeLength > 0.0 && minCount * this.maxEdgeLength < totalLength) {
      minCount = Geometry.stepCount(this.maxEdgeLength, totalLength, minCount);
    }
    return minCount;
  }
  // return stroke count which is the larger of the existing count or count needed for angle condition for given sweepRadians
  // defaultStepRadians is assumed to be larger than zero.
  public applyAngleTol(minCount: number, sweepRadians: number, defaultStepRadians: number): number {
    return StrokeOptions.applyAngleTol(this, minCount, sweepRadians, defaultStepRadians);
  }
  public static applyAngleTol(options: StrokeOptions | undefined, minCount: number, sweepRadians: number, defaultStepRadians?: number): number {
    sweepRadians = Math.abs(sweepRadians);
    let stepRadians = defaultStepRadians ? defaultStepRadians : Math.PI / 8.0;
    if (options && options.angleTol && options.angleTol.radians > 0.0)
      stepRadians = options.angleTol.radians;
    if (minCount * stepRadians < sweepRadians)
      minCount = Geometry.stepCount(stepRadians, sweepRadians, minCount);
    return minCount;
  }

  public applyTolerancesToArc(radius: number, sweepRadians: number = Math.PI * 2): number {
    let numStrokes = 1;
    numStrokes = this.applyAngleTol(numStrokes, sweepRadians, Math.PI * 0.25);
    numStrokes = this.applyMaxEdgeLength(numStrokes, sweepRadians * radius);
    numStrokes = this.applyChordTol(numStrokes, radius, sweepRadians);
    numStrokes = this.applyMinStrokesPerPrimitive(numStrokes);
    return numStrokes;
  }

  // return stroke count which is the larger of existing count or count needed for circular arc chord tolerance condition.
  public applyChordTol(minCount: number, radius: number, sweepRadians: number): number {
    if (this.chordTol && this.chordTol > 0.0) {
      const a = this.chordTol;
      const stepRadians = 2.0 * Math.acos((1.0 - a / radius));
      minCount = Geometry.stepCount(stepRadians, sweepRadians, minCount);
    }
    return minCount;
  }
  public applyMinStrokesPerPrimitive(minCount: number): number {
    if (this.minStrokesPerPrimitive !== undefined && Number.isFinite(this.minStrokesPerPrimitive)
      && this.minStrokesPerPrimitive > minCount)
      minCount = this.minStrokesPerPrimitive;
    return minCount;
  }
  public static createForCurves(): StrokeOptions {
    const options = new StrokeOptions();
    options.angleTol = Angle.createDegrees(15.0);
    return options;
  }
  public static createForFacets(): StrokeOptions {
    const options = new StrokeOptions();
    options.angleTol = Angle.createDegrees(22.5);
    return options;
  }
}
