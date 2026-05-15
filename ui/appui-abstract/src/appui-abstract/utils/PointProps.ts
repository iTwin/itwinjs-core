/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Describes 2d points.
 * @public @deprecated in 4.2.0 - will not be removed until after 2026-06-13. Use @core/geometry [[Geometry.XAndY]] or your own custom type.
 */
export interface PointProps {
  readonly x: number;
  readonly y: number;
}
