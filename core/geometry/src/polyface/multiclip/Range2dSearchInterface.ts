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
 * Interface for classes that can search with range optimizations.
 * @public
 */
export interface Range2dSearchInterface<T> {
  /**
   * * Search for ranges containing testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.  "true" means continue the search.
   * @returns false if any handler call returned false.  Otherwise return true.
   */
  searchXY(x: number, y: number, handler: (range: Range2d, tag: T) => boolean): boolean;
  /**
   * * Search for ranges overlapping testRange
   * * Pass each range and tag to handler
   * * terminate search if handler returns false.
   * @param testRange search range.
   * @param handler function to receive range and tag hits.  "true" means continue the search.
   * @returns false if any handler call returned false.  Otherwise return true.
   */
  searchRange2d(testRange: LowAndHighXY, handler: (range: Range2d, tag: T) => boolean): boolean;
  /** Add a range to the search set. */
  addRange(range: LowAndHighXY, tag: T): void;
}
