/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cursor
 */

import { PointProps, RelativePosition } from "@itwin/appui-abstract";
import { Point, UiEvent } from "@itwin/core-react";

/** Enum for Cursor Direction parts
 *  @public
 */
export enum CursorDirectionParts {
  Top = 0x1000,
  Left = 0x0100,
  Right = 0x0010,
  Bottom = 0x0001,
}

/** Enum for Cursor Direction
 * @public
 */
export enum CursorDirection {
  None = 0,
  Top = CursorDirectionParts.Top,
  Left = CursorDirectionParts.Left,
  Right = CursorDirectionParts.Right,
  Bottom = CursorDirectionParts.Bottom,
  TopLeft = CursorDirectionParts.Top | CursorDirectionParts.Left,
  TopRight = CursorDirectionParts.Top | CursorDirectionParts.Right,
  BottomLeft = CursorDirectionParts.Bottom | CursorDirectionParts.Left,
  BottomRight = CursorDirectionParts.Bottom | CursorDirectionParts.Right,
}

/** Cursor Updated Event Args interface.
 * @public
 */
export interface CursorUpdatedEventArgs {
  oldPt: PointProps;
  newPt: PointProps;
  direction: CursorDirection;
}

/** Cursor Updated Event class.
 * @public
 */
export class CursorUpdatedEvent extends UiEvent<CursorUpdatedEventArgs> { }

/** Cursor Information class
 * @public
 */
export class CursorInformation {
  private static _cursorPosition: Point = new Point();
  private static _cursorDirection: CursorDirection = CursorDirection.BottomRight;

  private static _cursorDirections = new Array<CursorDirection>();

  /** The cursor position. */
  public static get cursorPosition(): PointProps { return this._cursorPosition; }
  public static set cursorPosition(pt: PointProps) { this._cursorPosition = Point.create(pt); }

  /** Gets the cursor X position. */
  public static get cursorX(): number { return this._cursorPosition.x; }
  /** Gets the cursor Y position. */
  public static get cursorY(): number { return this._cursorPosition.y; }

  /** Gets the general cursor movement direction. */
  public static get cursorDirection(): CursorDirection { return this._cursorDirection; }

  /** Gets the [[CursorUpdatedEvent]]. */
  public static readonly onCursorUpdatedEvent = new CursorUpdatedEvent();

  /** Handles the mouse movement.  Sets the cursor position and direction and emits onCursorUpdatedEvent. */
  public static handleMouseMove(point: PointProps): void {
    const oldPt = CursorInformation.cursorPosition;
    const direction = this._determineMostFrequentDirection(this._cursorDirections, this._cursorPosition, Point.create(point));

    this.cursorPosition = point;
    this._cursorDirection = direction;

    this.onCursorUpdatedEvent.emit({ oldPt, newPt: point, direction });
  }

  private static _determineMostFrequentDirection(cursorDirections: CursorDirection[], oldPt: Point, newPt: Point): CursorDirection {
    const cursorDirection = this._determineCursorDirection(oldPt, newPt);
    cursorDirections.push(cursorDirection);
    if (cursorDirections.length > 10)
      cursorDirections.shift();
    return this._mostFrequent(cursorDirections);
  }

  private static _mostFrequent(array: CursorDirection[]): CursorDirection {
    const hashMap = new Map<CursorDirection, number>();
    let maxCount = 0, mostFrequent = CursorDirection.None;

    array.forEach((value: CursorDirection) => {
      const key = value;
      let frequency = hashMap.get(key);

      if (frequency !== undefined)
        frequency++;
      else
        frequency = 1;

      hashMap.set(key, frequency);

      if (frequency > maxCount) {
        mostFrequent = key;
        maxCount = frequency;
      }
    });

    return mostFrequent;
  }

  private static _determineCursorDirection(oldPt: Point, newPt: Point): CursorDirection {
    let directionParts: number = 0;

    if (newPt.x < oldPt.x)
      directionParts |= CursorDirectionParts.Left;
    else if (newPt.x > oldPt.x)
      directionParts |= CursorDirectionParts.Right;

    if (newPt.y < oldPt.y)
      directionParts |= CursorDirectionParts.Top;
    else if (newPt.y > oldPt.y)
      directionParts |= CursorDirectionParts.Bottom;

    const direction = directionParts as CursorDirection;

    return direction;
  }

  /** Gets the relative position based on the cursor direction. */
  public static getRelativePositionFromCursorDirection(cursorDirection: CursorDirection): RelativePosition {
    let relativePosition: RelativePosition = RelativePosition.BottomRight;

    switch (cursorDirection) {
      case CursorDirection.Top:
        relativePosition = RelativePosition.Top;
        break;
      case CursorDirection.Left:
        relativePosition = RelativePosition.Left;
        break;
      case CursorDirection.Right:
        relativePosition = RelativePosition.Right;
        break;
      case CursorDirection.Bottom:
        relativePosition = RelativePosition.Bottom;
        break;
      case CursorDirection.TopLeft:
        relativePosition = RelativePosition.TopLeft;
        break;
      case CursorDirection.TopRight:
        relativePosition = RelativePosition.TopRight;
        break;
      case CursorDirection.BottomLeft:
        relativePosition = RelativePosition.BottomLeft;
        break;
      case CursorDirection.BottomRight:
        relativePosition = RelativePosition.BottomRight;
        break;
    }

    return relativePosition;
  }

  /** @internal - for testing */
  public static clearCursorDirections(): void {
    this._cursorDirections.length = 0;
  }
}
