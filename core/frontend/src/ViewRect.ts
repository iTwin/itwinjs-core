/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { LowAndHighXY, XAndY } from "@itwin/core-geometry";

/** A rectangle in integer view coordinates with (0,0) corresponding to the top-left corner of the view.
 *
 * Increasing **x** moves from left to right, and increasing **y** moves from top to bottom.
 * @public
 */
export class ViewRect {
  private _left!: number;
  private _top!: number;
  private _right!: number;
  private _bottom!: number;

  /** Construct a new ViewRect. */
  public constructor(left = 0, top = 0, right = 0, bottom = 0) { this.init(left, top, right, bottom); }
  /** The leftmost side of this ViewRect.  */
  public get left(): number { return this._left; }
  public set left(val: number) { this._left = Math.floor(val); }
  /** The topmost side of this ViewRect. */
  public get top(): number { return this._top; }
  public set top(val: number) { this._top = Math.floor(val); }
  /** The rightmost side of this ViewRect. */
  public get right(): number { return this._right; }
  public set right(val: number) { this._right = Math.floor(val); }
  /** The bottommost side of this ViewRect. */
  public get bottom(): number { return this._bottom; }
  public set bottom(val: number) { this._bottom = Math.floor(val); }
  /** True if this ViewRect has an area > 0. */
  public get isNull(): boolean { return this.right <= this.left || this.bottom <= this.top; }
  /** True if `!isNull` */
  public get isValid(): boolean { return !this.isNull; }
  /** The width (right-left) of this ViewRect. */
  public get width() { return this.right - this.left; }
  public set width(width: number) { this.right = this.left + width; }
  /** The height (bottom-top) of this ViewRect. */
  public get height() { return this.bottom - this.top; }
  public set height(height: number) { this.bottom = this.top + height; }
  /** The aspect ratio (width/height) of this ViewRect. */
  public get aspect() { return this.isNull ? 1.0 : this.width / this.height; }
  /** The area (width*height) of this ViewRect. */
  public get area() { return this.isNull ? 0 : this.width * this.height; }
  /** Initialize this ViewRect from its left/top/right/bottom parameters. */
  public init(left: number, top: number, right: number, bottom: number) { this.left = left; this.bottom = bottom, this.right = right; this.top = top; }
  /** Initialize this ViewRect from two points.
   * @param topLeft The top-left corner.
   * @param bottomRight The bottom-right corner.
   */
  public initFromPoints(topLeft: XAndY, bottomRight: XAndY): void { this.init(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y); }
  /** Initialize this ViewRect from a range.
   * @param input The Range to use. `input.low` defines the top-left and `input.high` defines the bottom-right.
   */
  public initFromRange(input: LowAndHighXY): void { this.initFromPoints(input.low, input.high); }
  /** Return true is this ViewRect is exactly equal to another ViewRect.
   * @param other The other ViewRect to compare
   */
  public equals(other: ViewRect): boolean { return this.left === other.left && this.right === other.right && this.bottom === other.bottom && this.top === other.top; }
  /** Initialize this ViewRect from another ViewRect. */
  public setFrom(other: ViewRect): void { this.init(other.left, other.top, other.right, other.bottom); }
  /** Duplicate this ViewRect.
   * @param result Optional ViewRect for result. If undefined, a new ViewRect is created.
   */
  public clone(result?: ViewRect): ViewRect {
    if (undefined !== result) {
      result.setFrom(this);
      return result;
    }
    return new ViewRect(this.left, this.top, this.right, this.bottom);
  }
  public extend(other: ViewRect) {
    if (this.left > other.left) this.left = other.left;
    if (this.top > other.top) this.top = other.top;
    if (this.right < other.right) this.right = other.right;
    if (this.bottom < other.bottom) this.bottom = other.bottom;
  }

  /** Inset this ViewRect by values in the x and y directions. Positive values make the ViewRect smaller, and negative values will make it larger.
   * @param deltaX The distance to inset the ViewRect in the x direction.
   * @param deltaY The distance to inset the ViewRect in the y direction.
   */
  public inset(deltaX: number, deltaY: number): void {
    deltaX = Math.floor(deltaX);
    deltaY = Math.floor(deltaY);
    if (this.width - 2 * deltaX <= 0 || this.height - 2 * deltaY <= 0) {
      this.init(0, 0, 0, 0);
      return;
    }
    this._left += deltaX;
    this._right -= deltaX;
    this._top += deltaY;
    this._bottom -= deltaY;
  }

  /** Inset this ViewRect by the same value in all directions.
   * @param offset The distance to inset this ViewRect. Positive values will make this ViewRect smaller and negative values will make it larger.
   * @note The inset operation can cause a previously valid ViewRect to become invalid.
   */
  public insetUniform(offset: number): void { this.inset(offset, offset); }

  /** Scale this ViewRect about its center by the supplied scale factors. */
  public scaleAboutCenter(xScale: number, yScale: number): void {
    const w = this.width;
    const h = this.height;
    const xDelta = (w - (w * xScale)) * 0.5;
    const yDelta = (h - (h * yScale)) * 0.5;
    this.inset(xDelta, yDelta);
  }

  /** Inset this ViewRect by a percentage of its current width.
   * @param percent The percentage of this ViewRect's width to inset in all directions.
   * @note The ViewRect will become smaller (or larger, if percent is negative) by `percent * width * 2` in each direction, since each side is moved by that distance.
   * @see [[inset]]
   */
  public insetByPercent(percent: number): void { this.insetUniform(this.width * percent); }

  /** Determine if this ViewRect is entirely contained within the bounds of another ViewRect. */
  public isContained(other: ViewRect): boolean { return this.left >= other.left && this.right <= other.right && this.bottom <= other.bottom && this.top >= other.top; }

  /** Return true if the supplied point is contained in this ViewRect.
   * @param point The point to test.
   * @note if the point is exactly on the left or top edges, this method returns true. If the point is exactly on the right or bottom edge, it returns false.
   */
  public containsPoint(point: XAndY): boolean { return point.x >= this.left && point.x < this.right && point.y >= this.top && point.y < this.bottom; }

  /** Determine whether this ViewRect overlaps another. */
  public overlaps(other: ViewRect): boolean { return this.left <= other.right && this.top <= other.bottom && this.right >= other.left && this.bottom >= other.top; }

  /** Return a ViewRect that is the overlap (intersection) of this ViewRect and another ViewRect.
   * If the two ViewRects are equal, their value is the result. Otherwise, the result will always be smaller than either of them.
   */
  public computeOverlap(other: ViewRect, out?: ViewRect): ViewRect | undefined {
    const maxOrgX = Math.max(this.left, other.left);
    const maxOrgY = Math.max(this.top, other.top);
    const minCrnX = Math.min(this.right, other.right);
    const minCrnY = Math.min(this.bottom, other.bottom);

    if (maxOrgX > minCrnX || maxOrgY > minCrnY)
      return undefined;

    const result = undefined !== out ? out : new ViewRect();
    result.left = maxOrgX;
    result.right = minCrnX;
    result.top = maxOrgY;
    result.bottom = minCrnY;
    return result;
  }
}
