/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";

/**
 * Interface for class with `x` and `y` as number properties.
 * @public
 */
export interface WritableXAndY {
  /** x coordinate */
  x: number;
  /** y coordinate */
  y: number;
}
/**
 * Interface for class with `z` as number property.
 * @public
 */
export interface WriteableHasZ {
  /** z coordinate */
  z: number;
}
/**
 * Interface for class with `x`, `y`, `z` as number property.
 * @public
 */
export interface WritableXYAndZ extends WritableXAndY, WriteableHasZ {
}
/**
 * Interface for class with named properties `low` and `high`, both being `WriteableXAndY`
 * @public
 */
export interface WritableLowAndHighXY {
  /** Low x,y coordinates */
  low: WritableXAndY;
  /** High x,y,z coordinates */
  high: WritableXAndY;
}
/**
 * Interface for class with named properties `low` and `high`, both being `WriteableXYAndZ`
 * @public
 */
export interface WritableLowAndHighXYZ {
  /** Low x,y,z coordinates */
  low: WritableXYAndZ;
  /** High x,y,z coordinates */
  high: WritableXYAndZ;
}
/**
 * Interface for readable `z` number members.
 * @public
 */
export type HasZ = Readonly<WriteableHasZ>;
/**
 * Interface for readable `x` and `y` number members.
 * @public
 */
export type XAndY = Readonly<WritableXAndY>;
/**
 * Interface for type with readable `x`, `y`, `z` number members.
 * @public
 */
export type XYAndZ = Readonly<WritableXYAndZ>;

/** @public */
export namespace XYAndZ { // eslint-disable-line @typescript-eslint/no-redeclare
  /**
   * Return true if two XYAndZs have equal x,y,z parts within a specified tolerance.
   * @param a The first XYAndZ to compare
   * @param b The second XYAndZ to compare
   * @param The tolerance for comparison. If undefined, [[Geometry.smallMetricDistance]] is used.
   * @returns true if the difference in each coordinate of `a` and `b` is smaller than `tol`.
   */
  export function almostEqual(a: XYAndZ, b: XYAndZ, tol?: number): boolean {
    return Geometry.isSameCoordinate(a.x, b.x, tol)
      && Geometry.isSameCoordinate(a.y, b.y, tol)
      && Geometry.isSameCoordinate(a.z, b.z, tol);
  }
}

/**
 * Interface for type with readable `low` and `high` members which have `x` and `y` number members.
 * @public
 */
export type LowAndHighXY = Readonly<WritableLowAndHighXY>;

/** JSON representation of [[LowAndHighXY]].
 * @public
 */
export interface LowAndHighXYProps { low: XYProps, high: XYProps }

/**
 * Interface for type with readable `low` and `high` members which have `x`, `y`, and `z` number members.
 * @public
 */
export type LowAndHighXYZ = Readonly<WritableLowAndHighXYZ>;

/** JSON representation of [[LowAndHighXYZ]].
 * @public
 */
export interface LowAndHighXYZProps { low: XYZProps, high: XYZProps }

/**
 * Interface for variant json (one of)
 * * (individually optional) `x`, `y`, `z`
 * * number array
 * @public
 */
export type XYZProps = {
  x?: number;
  y?: number;
  z?: number;
} | number[];
/**
 * Interface for variant json (one of)
 * * (individually optional) `x`, `y`
 * * number array
 * @public
 */
export type XYProps = {
  x?: number;
  y?: number;
} | number[];
/**
 * Interface for variant json (one of)
 * * array of number arrays, with one matrix row in each array
 * * flat array of numbers, in row-mor order
 * * `Matrix3d` object
 * @public
 */
export type Matrix3dProps = number[][] | number[];
/**
 * Interface for variant json (one of)
 * * array of number arrays, with each low level array containing 4 numbers of a transform row (qx, qy, qz, ax)
 * * flat array of 12 numbers, in row-major order for the 3 rows of 4 values
 * * `Transform` object
 * @public
 */
export type TransformProps = number[][] | number[] | {
  origin: XYZProps;
  matrix: Matrix3dProps;
};
/**
 *  Interface for variant json representing a Range3d
 * * pair of `XYZProps` named `low` and `high`
 * * array of `XYZProps`
 * @public
 */
export type Range3dProps = LowAndHighXYZProps | XYZProps[];
/**
 *  Interface for variant json representing a Range2d
 * * pair of `XYProps` named `low` and `high`
 * * array of `XYProps`
 * @public
 */
export type Range2dProps = LowAndHighXYProps | XYProps[];
/**
 *  Interface for variant json representing a Range1d
 * * pair of `number` named `low` and `high`
 * * array of `number`
 * @public
 */
export type Range1dProps = {
  low: number;
  high: number;
} | number[];
