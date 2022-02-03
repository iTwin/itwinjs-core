/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import type { PointProps } from "@itwin/appui-abstract";
import { Point } from "./Point";
import type { SizeProps } from "./Size";
import { Size } from "./Size";
import { UiGeometry } from "./UiGeometry";

/** Describes 2d bounds.
 * @public
 */
export interface RectangleProps {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Available corners of [[Rectangle]].
 * @internal
 */
export enum Corner {
  TopLeft,
  TopRight,
  BottomRight,
  BottomLeft,
}

/** Describes and provides methods to work with 2d bounds.
 * @internal
 */
export class Rectangle implements RectangleProps {
  /** Creates rectangle from [[RectangleProps]]. */
  public static create(props: RectangleProps): Rectangle {
    return new Rectangle(props.left, props.top, props.right, props.bottom);
  }

  /** Creates rectangle from [[SizeProps]]. */
  public static createFromSize(size: SizeProps): Rectangle {
    return new Rectangle(0, 0, size.width, size.height);
  }

  /** Create a rectangle with 2 pairs of xy candidates. Theses are compared and shuffled as needed for the rectangle. */
  public static createXYXY(xA: number, yA: number, xB: number, yB: number): Rectangle {
    return new Rectangle(
      Math.min(xA, xB), Math.min(yA, yB),
      Math.max(xA, xB), Math.max(yA, yB));
  }

  /** Creates rectangle with specified bounds. */
  public constructor(public readonly left = 0, public readonly top = 0, public readonly right = 0, public readonly bottom = 0) {
  }

  /** @returns Size of this rectangle. */
  public getSize(): Size {
    const width = this.getWidth();
    const height = this.getHeight();
    return new Size(width, height);
  }

  /** @returns Width of this rectangle. */
  public getWidth(): number {
    return this.right - this.left;
  }

  /** @returns Height of this rectangle. */
  public getHeight(): number {
    return this.bottom - this.top;
  }

  /** @returns Position of specified corner. */
  public getCorner(corner: Corner): Point {
    switch (corner) {
      case Corner.TopLeft: {
        return this.topLeft();
      }
      case Corner.TopRight: {
        return new Point(this.right, this.top);
      }
      case Corner.BottomLeft: {
        return new Point(this.left, this.bottom);
      }
      case Corner.BottomRight: {
        return new Point(this.right, this.bottom);
      }
    }
  }

  /**
   * Inset the bounds of this rectangle.
   * @note Negative arguments will increase the size of rectangle.
   * @returns New [[Rectangle]] with modified bounds.
   */
  public inset(left: number, top: number, right: number, bottom: number): Rectangle {
    return new Rectangle(this.left + left, this.top + top, this.right - right, this.bottom - bottom);
  }

  /**
   * Offsets the rectangle along the X and Y axes.
   * @returns New [[Rectangle]] with modified position.
   */
  public offset(offset: PointProps): Rectangle {
    return new Rectangle(this.left + offset.x, this.top + offset.y, this.right + offset.x, this.bottom + offset.y);
  }

  /**
   * Offsets the rectangle along the X axis.
   * @returns New [[Rectangle]] with modified position along X axis.
   */
  public offsetX(offset: number): Rectangle {
    return new Rectangle(this.left + offset, this.top, this.right + offset, this.bottom);
  }

  /**
   * Offsets the rectangle along the Y axis.
   * @returns New [[Rectangle]] with modified position along Y axis.
   */
  public offsetY(offset: number): Rectangle {
    return new Rectangle(this.left, this.top + offset, this.right, this.bottom + offset);
  }

  /**
   * Moves the top left corner of rectangle to specified point.
   * @returns New [[Rectangle]] with modified position.
   */
  public setPosition(position: PointProps): Rectangle {
    return new Rectangle(position.x, position.y, position.x + this.getWidth(), position.y + this.getHeight());
  }

  /**
   * Sets the height of the rectangle.
   * @note Only [[Edge.Bottom]] is subject to change.
   * @returns New [[Rectangle]] with modified height.
   */
  public setHeight(height: number): Rectangle {
    return new Rectangle(this.left, this.top, this.right, this.top + height);
  }

  /**
   * Sets the width of the rectangle.
   * @note Only [[Edge.Right]] is subject to change.
   * @returns New [[Rectangle]] with modified width.
   */
  public setWidth(width: number): Rectangle {
    return new Rectangle(this.left, this.top, this.left + width, this.bottom);
  }

  /**
   * Sets the height and width of the rectangle.
   * @note Only [[Edge.Bottom]] and [[Edge.Right]] are subjects to change.
   * @returns New [[Rectangle]] with modified height.
   */
  public setSize(size: SizeProps): Rectangle {
    return new Rectangle(this.left, this.top, this.left + size.width, this.top + size.height);
  }

  /** Checks if bounds of two rectangles match. */
  public equals(other: RectangleProps): boolean {
    if (this.left === other.left &&
      this.top === other.top &&
      this.right === other.right &&
      this.bottom === other.bottom)
      return true;

    return false;
  }

  /**
   * Checks if point is within bounds of the rectangle.
   * @note Inclusive.
   */
  public containsPoint(point: PointProps): boolean {
    return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bottom;
  }

  /**
   * Checks if a point given as x,y is within the rectangle.
   * @note Inclusive.
   */
  public containsXY(x: number, y: number): boolean {
    return this.containsPoint({x, y});
  }

  /**
   * @returns true if this rectangle contains other rectangle.
   * @note Inclusive.
   */
  public contains(other: RectangleProps): boolean {
    return other.left >= this.left && other.right <= this.right && other.top >= this.top && other.bottom <= this.bottom;
  }

  /** @returns New [[Rectangle]] which is contained in other rectangle. */
  public containIn(other: RectangleProps): Rectangle {
    let contained: Rectangle = this.containVerticallyIn(other);
    contained = contained.containHorizontallyIn(other);
    return contained;
  }

  /** @returns New [[Rectangle]] which is vertically contained in other rectangle. */
  public containVerticallyIn(other: RectangleProps): Rectangle {
    const contained = this.offsetY(Math.min(other.bottom - this.bottom, 0));
    return contained.offsetY(Math.max(other.top - contained.top, 0));
  }

  /** @returns New [[Rectangle]] which is horizontally contained in other rectangle. */
  public containHorizontallyIn(other: RectangleProps): Rectangle {
    const contained = this.offsetX(Math.min(other.right - this.right, 0));
    return contained.offsetX(Math.max(other.left - contained.left, 0));
  }

  /** @returns [[Corner.TopLeft]] position of this rectangle. */
  public topLeft(): Point {
    return new Point(this.left, this.top);
  }

  /** @returns Center point position of this rectangle. */
  public center(): Point {
    const x = this.left + (this.right - this.left) / 2;
    const y = this.top + (this.bottom - this.top) / 2;
    return new Point(x, y);
  }

  /** @returns true if this rectangle intersects other rectangle. */
  public intersects(other: RectangleProps): boolean {
    return this.left < other.right && this.right > other.left &&
      this.top < other.bottom && this.bottom > other.top;
  }

  /**
   * Merges outer edges of this and other rectangles.
   * @returns New [[Rectangle]] with merged bounds.
   */
  public outerMergeWith(other: RectangleProps): Rectangle {
    const left = Math.min(this.left, other.left);
    const top = Math.min(this.top, other.top);
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);
    return new Rectangle(left, top, right, bottom);
  }

  /**
   * Vertically divides this rectangle into specified number of equal height segments.
   * @returns Vertical rectangle segment.
   */
  public getVerticalSegmentBounds(segmentId: number, numberOfSegments: number): Rectangle {
    const segmentHeight = this.getHeight() / numberOfSegments;

    const top = segmentId * segmentHeight;
    return this.inset(0, top, 0, 0).setHeight(segmentHeight);
  }

  /**
   * Horizontally divides this rectangle into specified number of equal width segments.
   * @returns Horizontal rectangle segment.
   */
  public getHorizontalSegmentBounds(segmentId: number, numberOfSegments: number): Rectangle {
    const segmentWidth = this.getWidth() / numberOfSegments;

    const left = segmentId * segmentWidth;
    return this.inset(left, 0, 0, 0).setWidth(segmentWidth);
  }

  /**
   * Calculates the shortest distance between this rectangle and a given point.
   * @returns The shortest distance to a point.
   */
  public getShortestDistanceToPoint(point: PointProps): number {
    let shortestDistance = 0;

    if (point.x < this.left) {
      if (point.y < this.top)
        shortestDistance = UiGeometry.hypotenuseXY(this.left - point.x, this.top - point.y);
      else if (point.y <= this.bottom)
        shortestDistance = this.left - point.x;
      else
        shortestDistance = UiGeometry.hypotenuseXY(this.left - point.x, this.bottom - point.y);
    } else if (point.x <= this.right) {
      if (point.y < this.top)
        shortestDistance = this.top - point.y;
      else if (point.y <= this.bottom)
        shortestDistance = 0;
      else
        shortestDistance = point.y - this.bottom;
    } else {
      if (point.y < this.top)
        shortestDistance = UiGeometry.hypotenuseXY(this.right - point.x, this.top - point.y);
      else if (point.y <= this.bottom)
        shortestDistance = point.x - this.right;
      else
        shortestDistance = UiGeometry.hypotenuseXY(this.right - point.x, this.bottom - point.y);
    }

    return shortestDistance;
  }

  /** @returns [[RectangleProps]] object for this rectangle. */
  public toProps(): RectangleProps {
    return {
      bottom: this.bottom,
      left: this.left,
      right: this.right,
      top: this.top,
    };
  }
}
