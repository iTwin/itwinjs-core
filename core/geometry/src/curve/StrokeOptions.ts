/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { Angle } from "../geometry3d/Angle";

/**
 * Tolerance blob for various stroking methods.
 *
 * * Across many applications, the critical concepts are:   chordTol, angleTol, maxEdgeLength
 *   * Chord error is an distance measured from a curve or facet to its approximating stroke or facet.
 *   * angle is the angle between two contiguous strokes or across a facet edge.
 *   * maxEdgeLength is the length of a stroke or a edge of a facet.
 * * It is rare for all three to be active at once.
 * * Nearly all stroke and facet use cases will apply an angle tolerance.
 *   * For curves, 15 degrees is typical
 *   * For facets, 22.5 degrees is typical.
 *   * Halving the angle tolerance will (roughly) make curves get twice as many strokes, and surfaces get 4 times as many facets.
 *   * The angle tolerance has the useful property that its effect is independent of scale of that data.  If data is suddenly scaled into millimeters rather than meters, the facet counts remain the same.
 * * When creating output for devices such as 3D printing will want a chord tolerance.
 * * For graphics display, use an angle tolerance of around 15 degrees and an chord tolerance which is the size of several pixels.
 * * Analysis meshes (e.g. Finite Elements) commonly need to apply maxEdgeLength.
 *   * Using maxEdgeLength for graphics probably produces too many facets.   For example, it causes long cylinders to get many nearly-square facets instead of the small number of long quads usually used for graphics.
 * * Facet tolerances are, as the Pirates' Code, guidelines, not absolute rules.   Facet and stroke code may ignore tolerances in awkward situations.
 * * If multiple tolerances are in effect, the actual count will usually be based on the one that demands the most strokes or facets, unless it is so high that it violates some upper limit on the number of facets on an arc or a section of a curve.
 * @public
 */
export class StrokeOptions {
  /** Distance from stroke to actual geometry. */
  public chordTol?: number;
  /** Turning angle between strokes. Larger value leads to fewer strokes. */
  public angleTol?: Angle;
  /** Maximum length of a single stroke. */
  public maxEdgeLength?: number;
  /**
   * Caller expects convex facets.
   * @deprecated in 4.2.0 - will not be removed until after 2026-06-13. Never used. See [[shouldTriangulate]] and [[maximizeConvexFacets]].
   */
  public needConvexFacets?: boolean;
  /** Minimum strokes on a primitive. */
  public minStrokesPerPrimitive?: number;
  /** Whether or not to triangulate each added facet. */
  public shouldTriangulate: boolean = false;
  private _needNormals?: boolean;
  private _needTwoSided?: boolean;
  private _needParams?: boolean;
  /** Whether params are requested. */
  public get needParams(): boolean {
    return this._needParams !== undefined ? this._needParams : false;
  }
  public set needParams(value: boolean) {
    this._needParams = value;
  }
  /** Whether normals are requested */
  public get needNormals(): boolean {
    return this._needNormals !== undefined ? this._needNormals : false;
  }
  public set needNormals(value: boolean) {
    this._needNormals = value;
  }
  /**
   * Whether to request facets that are viewable from the back.
   * * Default value is true.
   * * Set to false only if the requested facets are expected to form a closed volume with outward normals,
   * indicating they are amenable to backface culling for improved display performance.
   */
  public get needTwoSided(): boolean {
    return this._needTwoSided !== undefined ? this._needTwoSided : true;
  }
  public set needTwoSided(value: boolean) {
    this._needTwoSided = value;
  }
  /** Optional color request flag */
  public needColors?: boolean;
  /** Default number of strokes for a circle. */
  public defaultCircleStrokes = 16;
  /** Ask if angleTol is specified */
  public get hasAngleTol(): boolean {
    return this.angleTol !== undefined && Math.abs(this.angleTol.radians) > 0.0;
  }
  /** Ask if chordTol is specified */
  public get hasChordTol(): boolean {
    return this.chordTol !== undefined && this.chordTol > 0.0;
  }
  /** Ask if maxEdgeLength is specified */
  public get hasMaxEdgeLength(): boolean {
    return this.maxEdgeLength !== undefined && this.maxEdgeLength > 0.0;
  }
  private _maximizeConvexFacets?: boolean;
  /**
   * Whether to post-process a planar triangulation by removing edges to maximize the size of convex facets.
   * * Setting this to true also sets [[shouldTriangulate]] to true.
   */
  public get maximizeConvexFacets(): boolean {
    return this._maximizeConvexFacets ?? false;
  }
  public set maximizeConvexFacets(value: boolean) {
    this._maximizeConvexFacets = value;
    if (value)
      this.shouldTriangulate = value;
  }
  /** Return a deep clone  */
  public clone(): StrokeOptions {
    const options = new StrokeOptions();
    options.chordTol = this.chordTol;
    options.angleTol = this.angleTol?.clone();
    options.maxEdgeLength = this.maxEdgeLength;
    options.minStrokesPerPrimitive = this.minStrokesPerPrimitive;
    options.shouldTriangulate = this.shouldTriangulate;
    options._needNormals = this._needNormals;
    options._needTwoSided = this._needTwoSided;
    options._needParams = this._needParams;
    options.needColors = this.needColors;
    options.defaultCircleStrokes = this.defaultCircleStrokes;
    options._maximizeConvexFacets = this._maximizeConvexFacets;
    return options;
  }
  /** Return stroke count which is the larger of the minCount or count needed for edge length condition. */
  public applyMaxEdgeLength(minCount: number, totalLength: number): number {
    totalLength = Math.abs(totalLength);
    if (this.maxEdgeLength && this.maxEdgeLength > 0.0 && minCount * this.maxEdgeLength < totalLength) {
      minCount = Geometry.stepCount(this.maxEdgeLength, totalLength, minCount);
    }
    return minCount;
  }
  /**
   * Return stroke count which is the larger of the existing count or count needed for angle condition for given
   * sweepRadians.
   * * defaultStepRadians is assumed to be larger than zero.
   */
  public applyAngleTol(minCount: number, sweepRadians: number, defaultStepRadians: number): number {
    return StrokeOptions.applyAngleTol(this, minCount, sweepRadians, defaultStepRadians);
  }
  /**
   * Return stroke count which is the larger of minCount and the count required to turn sweepRadians, using tolerance
   * from the options.
   */
  public static applyAngleTol(
    options: StrokeOptions | undefined, minCount: number, sweepRadians: number, defaultStepRadians?: number,
  ): number {
    sweepRadians = Math.abs(sweepRadians);
    let stepRadians = defaultStepRadians ? defaultStepRadians : Math.PI / 8.0;
    if (options && options.angleTol && options.angleTol.radians > 0.0)
      stepRadians = options.angleTol.radians;
    if (minCount * stepRadians < sweepRadians)
      minCount = Geometry.stepCount(stepRadians, sweepRadians, minCount);
    return minCount;
  }
  /**
   * Return the number of strokes needed for given edgeLength curve.
   * @param options
   * @param minCount smallest allowed count
   * @param edgeLength
   */
  public static applyMaxEdgeLength(
    options: StrokeOptions | undefined, minCount: number, edgeLength: number,
  ): number {
    if (edgeLength < 0)
      edgeLength = - edgeLength;
    if (minCount < 1)
      minCount = 1;
    if (options && options.maxEdgeLength && options.maxEdgeLength * minCount < edgeLength) {
      minCount = Geometry.stepCount(options.maxEdgeLength, edgeLength, minCount);
    }
    return minCount;
  }
  /**
   * Determine a stroke count for a (partial) circular arc of given radius. This considers angle, maxEdgeLength,
   * chord, and minimum stroke.
   */
  public applyTolerancesToArc(radius: number, sweepRadians: number = Math.PI * 2): number {
    let numStrokes = 1;
    numStrokes = this.applyAngleTol(numStrokes, sweepRadians, Math.PI * 0.25);
    numStrokes = this.applyMaxEdgeLength(numStrokes, sweepRadians * radius);
    numStrokes = this.applyChordTol(numStrokes, radius, sweepRadians);
    numStrokes = this.applyMinStrokesPerPrimitive(numStrokes);
    return numStrokes;
  }
  /** Return stroke count which is the larger of existing count or count needed for circular arc chord tolerance condition. */
  public applyChordTol(minCount: number, radius: number, sweepRadians: number): number {
    if (this.chordTol && this.chordTol > 0.0 && this.chordTol < radius) {
      const a = this.chordTol;
      const stepRadians = 2.0 * Math.acos((1.0 - a / radius));
      minCount = Geometry.stepCount(stepRadians, sweepRadians, minCount);
    }
    return minCount;
  }
  /**
   * Return stroke count which is the larger of existing count or count needed for circular arc chord tol with given
   * arc length and radians
   */
  public applyChordTolToLengthAndRadians(minCount: number, length: number, sweepRadians: number): number {
    if (this.chordTol && this.chordTol > 0.0) {
      const radius = Geometry.conditionalDivideFraction(length, sweepRadians);
      if (radius !== undefined)
        return this.applyChordTol(minCount, radius, sweepRadians);
    }
    return minCount;
  }
  /** Return stroke count which is the larger of existing count or `this.minStrokesPerPrimitive` */
  public applyMinStrokesPerPrimitive(minCount: number): number {
    if (this.minStrokesPerPrimitive !== undefined && Number.isFinite(this.minStrokesPerPrimitive)
      && this.minStrokesPerPrimitive > minCount)
      minCount = this.minStrokesPerPrimitive;
    return minCount;
  }
  /**
   * Create `StrokeOptions` with defaults appropriate for curves.
   * * angle tolerance of 15 degrees.
   * * all others inactive.
   */
  public static createForCurves(): StrokeOptions {
    const options = new StrokeOptions();
    options.angleTol = Angle.createDegrees(15.0);
    return options;
  }
  /**
   * Create `StrokeOptions` with defaults appropriate for surfaces facets
   * * angle tolerance of 22.5 degrees.
   * * all others inactive.
   */
  public static createForFacets(): StrokeOptions {
    const options = new StrokeOptions();
    options.angleTol = Angle.createDegrees(22.5);
    return options;
  }
}
