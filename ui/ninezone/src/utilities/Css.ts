/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import Rectangle, { RectangleProps } from "./Rectangle";
import Point, { PointProps } from "./Point";

/** CSS helpers. */
export default class Css {
  /** @returns Value in pixels. */
  public static toPx(px: number): string {
    return px + "px";
  }

  /** @returns Value in percentage. */
  public static toPercentage(px: number): string {
    return px + "%";
  }
}

/** React.CSSProperties helpers. */
export class CssProperties {
  /** @returns CSS properties that describe bounds (top, left, height, width). */
  public static fromBounds(props: RectangleProps): React.CSSProperties {
    const rectangle = Rectangle.create(props);
    return {
      height: rectangle.getHeight(),
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.getWidth(),
    };
  }

  /** @returns CSS properties that describe position (top, left). */
  public static fromPosition(props: PointProps): React.CSSProperties {
    const point = Point.create(props);
    return {
      left: point.x,
      top: point.y,
    };
  }
}
