/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Available directions. */
export enum Direction {
  Left,
  Top,
  Right,
  Bottom,
}

/** Helpers for [[Direction]]. */
export class DirectionHelpers {
  /** Class name of [[Direction.Left]] */
  public static readonly LEFT_CLASS_NAME = "nz-direction-left";
  /** Class name of [[Direction.Top]] */
  public static readonly TOP_CLASS_NAME = "nz-direction-top";
  /** Class name of [[Direction.Right]] */
  public static readonly RIGHT_CLASS_NAME = "nz-direction-right";
  /** Class name of [[Direction.Bottom]] */
  public static readonly BOTTOM_CLASS_NAME = "nz-direction-bottom";

  /** @returns Class name of specified [[Direction]] */
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

  /** @returns Orthogonal direction of specified [[Direction]] */
  public static getOrthogonalDirection(direction: Direction): OrthogonalDirection {
    switch (direction) {
      case Direction.Left:
      case Direction.Right:
        return OrthogonalDirection.Horizontal;
      case Direction.Top:
      case Direction.Bottom:
        return OrthogonalDirection.Vertical;
    }
  }
}

/** Available orthogonal directions. */
export enum OrthogonalDirection {
  Vertical,
  Horizontal,
}

/** Helpers for [[OrthogonalDirection]]. */
export class OrthogonalDirectionHelpers {
  /** Class name of [[OrthogonalDirection.Vertical]] */
  public static readonly VERTICAL_CLASS_NAME = "nz-vertical";
  /** Class name of [[OrthogonalDirection.Horizontal]] */
  public static readonly HORIZONTAL_CLASS_NAME = "nz-horizontal";

  /** @returns Class name of specified [[OrthogonalDirection]] */
  public static getCssClassName(direction: OrthogonalDirection): string {
    switch (direction) {
      case OrthogonalDirection.Vertical:
        return OrthogonalDirectionHelpers.VERTICAL_CLASS_NAME;
      case OrthogonalDirection.Horizontal:
        return OrthogonalDirectionHelpers.HORIZONTAL_CLASS_NAME;
    }
  }

  /** @returns Opposite of specified [[OrthogonalDirection]] */
  public static inverse(direction: OrthogonalDirection): OrthogonalDirection {
    switch (direction) {
      case OrthogonalDirection.Vertical:
        return OrthogonalDirection.Horizontal;
      case OrthogonalDirection.Horizontal:
        return OrthogonalDirection.Vertical;
    }
  }
}

export default Direction;
