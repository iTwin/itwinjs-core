/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Effects
 */

import { Point3d, Range1d, Range3d } from "@bentley/geometry-core";

/** Generate integer in [min, max].
 * @beta
 */
export function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate random integer in [range.low, range.high].
 * @beta
 */
export function randomIntegerInRange(range: Range1d): number {
  return Math.floor(Math.random() * (range.high - range.low + 1)) + range.low;
}

/** Generate random floating-point number in [min, max).
 * @beta
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** Generate random floating-point number in [range.low, range.high).
 * @beta
 */
export function randomFloatInRange(range: Range1d): number {
  return randomFloat(range.low, range.high);
}

/** Generate a random position in the specified range.
 * @beta
 */
export function randomPositionInRange(range: Range3d): Point3d {
  const x = randomFloat(range.low.x, range.high.x);
  const y = randomFloat(range.low.y, range.high.y);
  const z = randomFloat(range.low.z, range.high.z);
  return new Point3d(x, y, z);
}
