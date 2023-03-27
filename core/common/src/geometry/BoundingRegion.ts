/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { CartographicRectangle } from "./CartographicRectangle";

export class BoundingRegion {
  public readonly rectangle: CartographicRectangle;
  public readonly minimumHeight: number;
  public readonly maximumHeight: number;

  private constructor(rect: CartographicRectangle, minHeight: number, maxHeight: number) {
    this.rectangle = rect;
    this.minimumHeight = minHeight;
    this.maximumHeight = maxHeight;
  }

  public static fromRectangle(rect: CartographicRectangle, minimumHeight = 0, maximumHeight = 0): BoundingRegion {
    return new this(rect, minimumHeight, maximumHeight);
  }
}
