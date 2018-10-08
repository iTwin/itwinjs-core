/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { Edge, RectangleProps } from "../../../utilities/Rectangle";
import ResizeHandle from "../../../widget/rectangular/ResizeHandle";

export default class Layout {
  public static readonly RECTANGULAR_DEFAULT_MIN_WIDTH = 296;
  public static readonly RECTANGULAR_DEFAULT_MIN_HEIGHT = 220;
  public static readonly FREE_FORM_DEFAULT_MIN_WIDTH = 96;
  public static readonly FREE_FORM_DEFAULT_MIN_HEIGHT = 88;

  private _bounds: Rectangle;

  public constructor(bounds: RectangleProps) {
    this._bounds = Rectangle.create(bounds);
  }

  public get minWidth(): number {
    return Layout.RECTANGULAR_DEFAULT_MIN_WIDTH;
  }

  public get minHeight(): number {
    return Layout.RECTANGULAR_DEFAULT_MIN_HEIGHT;
  }

  public get bounds() {
    return this._bounds;
  }

  public get isRoot() {
    return false;
  }

  protected setBounds(bounds: Rectangle) {
    this._bounds = bounds;
  }

  protected get _topZone(): Layout {
    return this;
  }

  protected get _bottomZone(): Layout {
    return this;
  }

  protected get _leftZone(): Layout {
    return this;
  }

  protected get _rightZone(): Layout {
    return this;
  }

  public getInitialBounds(): RectangleProps {
    return new Rectangle();
  }

  public resize(x: number, y: number, handle: ResizeHandle) {
    switch (handle) {
      case Edge.Top: {
        if (y < 0)
          this.tryGrowTop(-y);
        else if (y > 0)
          this.tryShrinkTop(y);
        break;
      }
      case Edge.Bottom: {
        if (y < 0)
          this.tryShrinkBottom(-y);
        else if (y > 0)
          this.tryGrowBottom(y);
        break;
      }
      case Edge.Left: {
        if (x < 0)
          this.tryGrowLeft(-x);
        else if (x > 0)
          this.tryShrinkLeft(x);
        break;
      }
      case Edge.Right: {
        if (x < 0)
          this.tryShrinkRight(-x);
        else if (x > 0)
          this.tryGrowRight(x);
        break;
      }
    }
  }

  public tryGrowTop(px: number): number {
    if (px < 0)
      throw new RangeError();
    const growSelfBy = Math.max(Math.min(px, this.bounds.top - this._topZone.bounds.bottom), 0);
    const shrinkBy = Math.max(0, px - growSelfBy);
    const shrunkBy = this._topZone.tryShrinkBottom(shrinkBy);

    const grown = growSelfBy + shrunkBy;
    this._bounds = this.bounds.inset(0, -grown, 0, 0);

    return grown;
  }

  public tryShrinkTop(px: number): number {
    if (px < 0)
      throw new RangeError();

    const height = this._bounds.getHeight();
    const shrinkSelfBy = Math.max(0, Math.min(px, height - this.minHeight));

    const moveBottom = Math.max(0, Math.min(px - shrinkSelfBy, this._bottomZone.bounds.top - this.bounds.bottom));

    const shrinkBottomBy = Math.max(0, px - shrinkSelfBy - moveBottom);
    const bottomShrunkBy = this._bottomZone.tryShrinkTop(shrinkBottomBy);

    this._bounds = this.bounds.inset(0, shrinkSelfBy, 0, 0);
    this._bounds = this.bounds.offsetY(moveBottom + bottomShrunkBy);

    return moveBottom + shrinkSelfBy + bottomShrunkBy;
  }

  public tryGrowBottom(px: number): number {
    if (px < 0)
      throw new RangeError();

    const growSelfBy = Math.max(0, Math.min(px, this._bottomZone.bounds.top - this.bounds.bottom));
    const shrinkBottomZoneBy = Math.max(0, px - growSelfBy);

    const bottomZoneShrunkBy = this._bottomZone.tryShrinkTop(shrinkBottomZoneBy);

    const grown = growSelfBy + bottomZoneShrunkBy;
    this._bounds = this.bounds.inset(0, 0, 0, -grown);

    return grown;
  }

  public tryShrinkBottom(px: number): number {
    if (px < 0)
      throw new RangeError();

    const height = this.bounds.getHeight();
    const shrinkSelfBy = Math.max(0, Math.min(px, height - this.minHeight));

    const moveTop = Math.max(0, Math.min(px - shrinkSelfBy, this.bounds.top - this._topZone.bounds.bottom));
    const shrinkTopBy = Math.max(0, px - shrinkSelfBy - moveTop);
    const topShrunkBy = this._topZone.tryShrinkBottom(shrinkTopBy);

    this._bounds = this.bounds.inset(0, 0, 0, shrinkSelfBy);
    this._bounds = this.bounds.offsetY(-(topShrunkBy + moveTop));

    return moveTop + shrinkSelfBy + topShrunkBy;
  }

  public tryGrowLeft(px: number): number {
    if (px < 0)
      throw new RangeError();

    const growSelfBy = Math.max(Math.min(px, this.bounds.left - this._leftZone.bounds.right), 0);
    const shrinkBy = Math.max(0, px - growSelfBy);
    const shrunkBy = this._leftZone.tryShrinkRight(shrinkBy);

    const grown = growSelfBy + shrunkBy;
    this._bounds = this.bounds.inset(-grown, 0, 0, 0);
    return grown;
  }

  public tryShrinkLeft(px: number): number {
    if (px < 0)
      throw new RangeError();

    const width = this.bounds.getWidth();
    const shrinkSelfBy = Math.max(0, Math.min(px, width - this.minWidth));

    let moveRight = 0;
    if (this._rightZone.isRoot)
      moveRight = Math.max(0, Math.min(px - shrinkSelfBy, this._rightZone.bounds.right - this.bounds.right));
    else
      moveRight = Math.max(0, Math.min(px - shrinkSelfBy, this._rightZone.bounds.left - this.bounds.right));

    const shrinkRightBy = Math.max(0, px - shrinkSelfBy - moveRight);
    const rightShrunkBy = this._rightZone.tryShrinkLeft(shrinkRightBy);

    this._bounds = this.bounds.inset(shrinkSelfBy, 0, 0, 0);
    this._bounds = this.bounds.offsetX(rightShrunkBy + moveRight);

    return shrinkSelfBy + rightShrunkBy + moveRight;
  }

  public tryGrowRight(px: number): number {
    if (px < 0)
      throw new RangeError();

    let rightBound = this._rightZone.bounds.left;
    if (this._rightZone.isRoot)
      rightBound = this._rightZone.bounds.right;

    const growSelfBy = Math.max(Math.min(px, rightBound - this.bounds.right), 0);
    const shrinkBy = Math.max(0, px - growSelfBy);
    const shrunkBy = this._rightZone.tryShrinkLeft(shrinkBy);

    const grown = growSelfBy + shrunkBy;
    this._bounds = this.bounds.inset(0, 0, -grown, 0);
    return grown;
  }

  public tryShrinkRight(px: number): number {
    if (px < 0)
      throw new RangeError();

    const width = this.bounds.getWidth();
    const shrinkSelfBy = Math.max(0, Math.min(px, width - this.minWidth));

    const moveLeft = Math.max(0, Math.min(px - shrinkSelfBy, this.bounds.left - this._leftZone.bounds.right));

    const shrinkLeftBy = Math.max(0, px - shrinkSelfBy - moveLeft);
    const leftShrunkBy = this._leftZone.tryShrinkRight(shrinkLeftBy);

    this._bounds = this.bounds.inset(0, 0, shrinkSelfBy, 0);
    this._bounds = this.bounds.offsetX(-(leftShrunkBy + moveLeft));

    return shrinkSelfBy + leftShrunkBy + moveLeft;
  }
}
