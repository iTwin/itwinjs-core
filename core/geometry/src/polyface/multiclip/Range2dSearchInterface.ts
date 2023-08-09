/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RangeSearch
 */

import { Range2d } from "../../geometry3d/Range";
import { LowAndHighXY } from "../../geometry3d/XYZProps";

/**
 * Interface for classes that implement optimized search of 2D ranges.
 * * Each range is associated with user data of type `T`.
 * @public
 */
export interface Range2dSearchInterface<T> {
  /**
   * * Search for ranges containing the xy-coordinates.
   * * Pass each range and tag to handler.
   * * Terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range hits, and their associated user data. Returning "true" means continue the search.
   * @returns false if any handler call returned false. Otherwise return true.
   */
  searchXY(x: number, y: number, handler: (range: Range2d, tag: T) => boolean): boolean;
  /**
   * * Search for ranges overlapping testRange.
   * * Pass each range and tag to handler.
   * * Terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range hits, and their associated user data. Returning "true" means continue the search.
   * @returns false if any handler call returned false. Otherwise return true.
   */
  searchRange2d(testRange: LowAndHighXY, handler: (range: Range2d, tag: T) => boolean): boolean;
  /** Add a range to the search set, and associate the range with user data `tag`. */
  addRange(range: LowAndHighXY, tag: T): void;
  /** Return the overall range of all members. */
  totalRange(result?: Range2d): Range2d;
}
