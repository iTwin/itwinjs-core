/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import Point, { PointProps } from "./Point";
import Size, { SizeProps } from "./Size";

export interface RectangleProps {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export enum Corner {
  TopLeft,
  TopRight,
  BottomRight,
  BottomLeft,
}

export enum Edge {
  Left,
  Top,
  Right,
  Bottom,
}

export default class Rectangle implements RectangleProps {
  public static create(props: RectangleProps) {
    return new Rectangle(props.left, props.top, props.right, props.bottom);
  }

  public static createFromSize(size: SizeProps) {
    return new Rectangle(0, 0, size.width, size.height);
  }

  public constructor(public readonly left = 0, public readonly top = 0, public readonly right = 0, public readonly bottom = 0) {
  }

  public getSize() {
    const width = this.getWidth();
    const height = this.getHeight();
    return new Size(width, height);
  }

  public getWidth() {
    return this.right - this.left;
  }

  public getHeight() {
    return this.bottom - this.top;
  }

  public getCorner(corner: Corner) {
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

  public inset(left: number, top: number, right: number, bottom: number) {
    return new Rectangle(this.left + left, this.top + top, this.right - right, this.bottom - bottom);
  }

  /** Offsets the rectangle along the X and Y axes. */
  public offset(offset: PointProps) {
    return new Rectangle(this.left + offset.x, this.top + offset.y, this.right + offset.x, this.bottom + offset.y);
  }

  /** Offsets the rectangle along the X axis. */
  public offsetX(offset: number) {
    return new Rectangle(this.left + offset, this.top, this.right + offset, this.bottom);
  }

  /** Offsets the rectangle along the Y axis. */
  public offsetY(offset: number) {
    return new Rectangle(this.left, this.top + offset, this.right, this.bottom + offset);
  }

  /** Moves the top left corner of rectangle to specified point. */
  public setPosition(position: PointProps) {
    return new Rectangle(position.x, position.y, position.x + this.getWidth(), position.y + this.getHeight());
  }

  /** Sets the height of the rectangle. */
  public setHeight(height: number) {
    return new Rectangle(this.left, this.top, this.right, this.top + height);
  }

  /** Sets the width of the rectangle. */
  public setWidth(width: number) {
    return new Rectangle(this.left, this.top, this.left + width, this.bottom);
  }

  /** Checks if bounds of two rectangles match. */
  public equals(other: RectangleProps) {
    if (this.left === other.left &&
      this.top === other.top &&
      this.right === other.right &&
      this.bottom === other.bottom)
      return true;

    return false;
  }

  /** Checks if point is within bounds of the rectangle. */
  public containsPoint(point: PointProps) {
    return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bottom;
  }

  /** Checks if rectangle is within bounds of other rectangle. */
  public containsRectangle(other: RectangleProps) {
    return other.left >= this.left && other.right <= this.right && other.top >= this.top && other.bottom <= this.bottom;
  }

  /** Contains this rectangle within other rectangle. Returns bounds of contained rectangle. */
  public containIn(other: RectangleProps): Rectangle {
    let contained: Rectangle = this.containVerticallyIn(other);
    contained = contained.containHorizontallyIn(other);
    return contained;
  }

  /** Vertically contains this rectangle within other rectangle. Returns bounds of contained rectangle. */
  public containVerticallyIn(other: RectangleProps): Rectangle {
    let contained: Rectangle = this;
    if (contained.bottom > other.bottom)
      contained = contained.offsetY(other.bottom - contained.bottom);
    if (contained.top < other.top)
      contained = contained.offsetY(other.top - contained.top);
    return contained;
  }

  /** Horizontally contains this rectangle within other rectangle. Returns bounds of contained rectangle. */
  public containHorizontallyIn(other: RectangleProps): Rectangle {
    let contained: Rectangle = this;
    if (contained.right > other.right)
      contained = contained.offsetX(other.right - contained.right);
    if (contained.left < other.left)
      contained = contained.offsetX(other.left - contained.left);
    return contained;
  }

  /** Returns top left point of the rectangle. */
  public topLeft(): Point {
    return new Point(this.left, this.top);
  }

  /** Returns center point of the rectangle */
  public center(): Point {
    const x = this.left + (this.right - this.left) / 2;
    const y = this.top + (this.bottom - this.top) / 2;
    return new Point(x, y);
  }

  /** Returns true if rectangle intersects other rectangle. */
  public intersects(other: RectangleProps) {
    return this.left < other.right && this.right > other.left &&
      this.top < other.bottom && this.bottom > other.top;
  }

  /** Merges two rectangles by the outer edges. */
  public outerMergeWith(other: RectangleProps) {
    let left = this.left;
    let top = this.top;
    let right = this.right;
    let bottom = this.bottom;
    if (other.left < left)
      left = other.left;
    if (other.top < top)
      top = other.top;
    if (other.right > right)
      right = other.right;
    if (other.bottom > bottom)
      bottom = other.bottom;
    return new Rectangle(left, top, right, bottom);
  }
}
