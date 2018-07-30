/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

export enum Direction {
  Left,
  Top,
  Right,
  Bottom,
}

export class DirectionHelpers {
  public static LEFT_CLASS_NAME = "nz-direction-left";
  public static TOP_CLASS_NAME = "nz-direction-top";
  public static RIGHT_CLASS_NAME = "nz-direction-right";
  public static BOTTOM_CLASS_NAME = "nz-direction-bottom";

  public static getCssClassName(direction: Direction): string {
    switch (direction) {
      case Direction.Left:
        return DirectionHelpers.LEFT_CLASS_NAME;
      case Direction.Top:
        return DirectionHelpers.TOP_CLASS_NAME;
      case Direction.Right:
        return DirectionHelpers.RIGHT_CLASS_NAME;
      case Direction.Bottom:
        return DirectionHelpers.BOTTOM_CLASS_NAME;
    }
  }
}

export enum OrthogonalDirection {
  Vertical,
  Horizontal,
}

export class OrthogonalDirectionHelpers {
  public static VERTICAL_CLASS_NAME = "nz-vertical";
  public static HORIZONTAL_CLASS_NAME = "nz-horizontal";

  public static getCssClassName(direction: OrthogonalDirection): string {
    switch (direction) {
      case OrthogonalDirection.Vertical:
        return OrthogonalDirectionHelpers.VERTICAL_CLASS_NAME;
      case OrthogonalDirection.Horizontal:
        return OrthogonalDirectionHelpers.HORIZONTAL_CLASS_NAME;
    }
  }
}

export default Direction;
