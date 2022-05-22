/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/**
 * Class containing static methods for typical numeric operations.
 * @internal
 */
export class UiGeometry {
  /**
   * Clamp value to (min,max) with no test for order of (min,max)
   * @param value value to clamp
   * @param min smallest allowed output
   * @param max largest allowed result.
   */
  public static clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

  /**
   * Return the hypotenuse `sqrt(x*x + y*y)`. This is much faster than `Math.hypot(x,y)`.
   */
  public static hypotenuseXY(x: number, y: number): number { return Math.sqrt(x * x + y * y); }
}
