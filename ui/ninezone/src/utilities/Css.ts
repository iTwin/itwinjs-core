/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import Rectangle, { RectangleProps } from "./Rectangle";

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
  /** @returns CSS properties that describe rectangle (height, left, top, width). */
  public static fromRectangle(rectangleProps: RectangleProps): React.CSSProperties {
    const rectangle = Rectangle.create(rectangleProps);
    return {
      height: rectangle.getHeight(),
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.getWidth(),
    };
  }
}
