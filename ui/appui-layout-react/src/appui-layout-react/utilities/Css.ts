/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { PointProps } from "@itwin/appui-abstract";
import { Rectangle, RectangleProps } from "@itwin/core-react";

/** CSS helpers.
 * @internal
 */
export class Css {
  /** @returns Value in pixels. */
  public static toPx(px: number): string {
    return `${px}px`;
  }

  /** @returns Value in percentage. */
  public static toPercentage(px: number): string {
    return `${px}%`;
  }
}

/** React.CSSProperties helpers.
 * @internal
 */
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
    return {
      left: props.x,
      top: props.y,
    };
  }

  /** @returns CSS transform property. */
  public static transformFromPosition(props: PointProps) {
    return {
      transform: `translate(${props.x}px, ${props.y}px)`,
    };
  }
}
