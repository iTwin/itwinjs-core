/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { Id64String } from "@bentley/bentleyjs-core";

/** Converted Primitives namespace
 * @public
 */
export namespace ConvertedPrimitives {

  /** Interface for 2d Point
   * @public
   */
  export interface Point2d {
    x: number;
    y: number;
  }

  /** Interface for 3d Point
   * @public
   */
  export interface Point3d extends Point2d {
    z: number;
  }

  /** Type definition for 2d or 3d Point
   * @public
   */
  export type Point = Point2d | Point3d;

  /** Type definition for Value
   * @public
   */
  export type Value = boolean | number | string | Date | Point | Id64String;
}
