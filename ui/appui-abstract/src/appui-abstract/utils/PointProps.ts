/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Describes 2d points.
 * @public @deprecated in 4.2.x. Use @core/geometry [[Geometry.XAndY]] or your own custom type.
 */
export interface PointProps {
  readonly x: number;
  readonly y: number;
}
