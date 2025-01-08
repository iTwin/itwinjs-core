/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Static, Type } from "@sinclair/typebox";
import { Geometry } from "../Geometry";

/* eslint-disable @typescript-eslint/naming-convention */
export const WritableXAndYSchema = Type.Object({
  x: Type.Number({description: "x coordinate"}),
  y: Type.Number({description: "y coordinate"}),
}, {description: "Interface for class with `x` and `y` as number properties."});
export type WritableXAndY = Static<typeof WritableXAndYSchema>;
export const WritableHasZSchema = Type.Object({
  z: Type.Number({description: "z coordinate"}),
}, {description: "Interface for class with `z` as number property."});
export type WriteableHasZ = Static<typeof WritableHasZSchema>;
export const WritableXYAndZSchema = Type.Intersect([WritableXAndYSchema, WritableHasZSchema], {description: "Interface for class with `x`, `y`, `z` as number properties."});
export type WritableXYAndZ = Static<typeof WritableXYAndZSchema>;
export const WritableLowAndHighXYSchema = Type.Object({
  low: WritableXAndYSchema,
  high: WritableXAndYSchema,
}, {description: "Interface for class with named properties `low` and `high`, both being `WriteableXAndY`"});
export type WritableLowAndHighXY = Static<typeof WritableLowAndHighXYSchema>;
export const WritableLowAndHighXYZSchema = Type.Object({
  low: WritableXYAndZSchema,
  high: WritableXYAndZSchema,
}, {description: "Interface for class with named properties `low` and `high`, both being `WriteableXYAndZ`"});
export type WritableLowAndHighXYZ = Static<typeof WritableLowAndHighXYZSchema>;
export const HasZSchema = Type.Readonly(WritableHasZSchema);
export type HasZ = Static<typeof HasZSchema>;
export const XAndYSchema = Type.Readonly(WritableXAndYSchema);
export type XAndY = Static<typeof XAndYSchema>;
export const XYAndZSchema = Type.Readonly(WritableXYAndZSchema);
export type XYAndZ = Static<typeof XYAndZSchema>;

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
export const LowAndHighXYZSchema = Type.Readonly(WritableLowAndHighXYZSchema);
export type LowAndHighXYZ = Static<typeof LowAndHighXYZSchema>;

/** JSON representation of [[LowAndHighXYZ]].
 * @public
 */
export interface LowAndHighXYZProps { low: XYZProps, high: XYZProps }

export const XYZPropsSchema = Type.Union([
  Type.Object({
    x: Type.Optional(Type.Number({ description: "X coordinate" })),
    y: Type.Optional(Type.Number({ description: "Y coordinate" })),
    z: Type.Optional(Type.Number({ description: "Z coordinate" })),
  }, { description: "Object with optional `x`, `y`, `z` properties" }),
  Type.Array(Type.Number(), { description: "Number array" })
], { description: "Interface for variant json (one of): (individually optional) `x`, `y`, `z` or number array" });
export type XYZProps = Static<typeof XYZPropsSchema>;

/**
 * Interface for variant json (one of)
 * * (individually optional) `x`, `y`
 * * number array
 * @public
 */
export const XYPropsSchema = Type.Union([
  Type.Object({
    x: Type.Optional(Type.Number({ description: 'X coordinate' })),
    y: Type.Optional(Type.Number({ description: 'Y coordinate' })),
  }, { description: 'Object with optional x and y properties' }),
  Type.Array(Type.Number(), { description: 'Array of numbers' })
], { description: 'Interface for variant json (one of): (individually optional) `x`, `y` or number array' });
export type XYProps = Static<typeof XYPropsSchema>;

/**
 * Interface for variant json (one of)
 * * array of number arrays, with one matrix row in each array
 * * flat array of numbers, in row-major order
 * * `Matrix3d` object
 * @public
 */
export const Matrix3dPropsSchema = Type.Union([
  Type.Array(Type.Array(Type.Number(), { description: 'Array of numbers representing a row in the matrix' }), { description: 'Array of number arrays, with one matrix row in each array' }),
  Type.Array(Type.Number(), { description: 'Flat array of numbers, in row-major order' }),
], {
  description: [
    'Interface for variant json (one of):',
    '* array of number arrays, with one matrix row in each array',
    '* flat array of numbers, in row-major order',
    '* `Matrix3d` object'
  ].join(' ')
});
export type Matrix3dProps = Static<typeof Matrix3dPropsSchema>;

/**
 * Interface for variant json (one of)
 * * array of number arrays, with each low level array containing 4 numbers of a transform row (qx, qy, qz, ax)
 * * flat array of 12 numbers, in row-major order for the 3 rows of 4 values
 * * `Transform` object
 * @public
 */
export const TransformPropsSchema = Type.Union([
  Type.Array(Type.Array(Type.Number(), { description: 'Array of numbers representing a row in the transform' }), { description: 'Array of number arrays, with each low level array containing 4 numbers of a transform row (qx, qy, qz, ax)' }),
  Type.Array(Type.Number(), { description: 'Flat array of 12 numbers, in row-major order for the 3 rows of 4 values' }),
  Type.Object({
    origin: XYZPropsSchema,
    matrix: Matrix3dPropsSchema,
  }, { description: 'Transform object' })
], {
  description: [
    'Interface for variant json (one of):',
    '* array of number arrays, with each low level array containing 4 numbers of a transform row (qx, qy, qz, ax)',
    '* flat array of 12 numbers, in row-major order for the 3 rows of 4 values',
    '* `Transform` object'
  ].join(' ')
});
export type TransformProps = Static<typeof TransformPropsSchema>;

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
