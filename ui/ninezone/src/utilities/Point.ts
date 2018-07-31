/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

export interface PointProps {
  readonly x: number;
  readonly y: number;
}

export default class Point implements PointProps {
  public static create(pointProps: PointProps) {
    return new Point(pointProps.x, pointProps.y);
  }

  public constructor(public readonly x = 0, public readonly y = 0) {
  }

  /** Calculates distance to other point. */
  public getDistanceTo(other: PointProps): number {
    const offset = this.getOffsetTo(other);
    return Math.sqrt(Math.pow(offset.x, 2) + Math.pow(offset.y, 2));
  }

  /** Gets offset to other point. */
  public getOffsetTo(other: PointProps) {
    return new Point(other.x - this.x, other.y - this.y);
  }

  /** Offsets the point along the X and Y axes. */
  public offset(offset: PointProps) {
    return new Point(this.x + offset.x, this.y + offset.y);
  }

  /** Offsets the point along the X axis. */
  public offsetX(offset: number) {
    return new Point(this.x + offset, this.y);
  }

  /** Offsets the point along the Y axis. */
  public offsetY(offset: number) {
    return new Point(this.x, this.y + offset);
  }

  /** Returns true if two points match. */
  public equals(other: PointProps) {
    return other.x === this.x && other.y === this.y;
  }
}
