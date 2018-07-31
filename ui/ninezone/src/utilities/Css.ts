/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import Rectangle, { RectangleProps } from "./Rectangle";

export default class Css {
  public static toPx(px: number): string {
    return px + "px";
  }

  public static toPercentage(px: number): string {
    return px + "%";
  }
}

export class CssProperties {
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
