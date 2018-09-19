/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { Edge, RectangleProps } from "../../../utilities/Rectangle";
import ResizeHandle from "../../../widget/rectangular/ResizeHandle";
import { HorizontalAnchor } from "../../../widget/Stacked";
import Root from "./Root";

export class Layout {
  public static readonly RECTANGULAR_DEFAULT_MIN_WIDTH = 296;
  public static readonly RECTANGULAR_DEFAULT_MIN_HEIGHT = 220;
  public static readonly FREE_FORM_DEFAULT_MIN_WIDTH = 96;
  public static readonly FREE_FORM_DEFAULT_MIN_HEIGHT = 88;

  private _bounds: Rectangle;

  public constructor(bounds: RectangleProps, public readonly root: Root) {
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

  protected setBounds(bounds: Rectangle) {
    this._bounds = bounds;
  }

  public get topLayouts(): Layout[] {
    return [];
  }

  public get bottomLayouts(): Layout[] {
    return [];
  }

  public get leftLayouts(): Layout[] {
    return [];
  }

  public get rightLayouts(): Layout[] {
    return [];
  }

  public getInitialBounds(): RectangleProps {
    return new Rectangle();
  }

  public get anchor(): HorizontalAnchor {
    return HorizontalAnchor.Right;
  }

  public get isResizable(): boolean {
    return true;
  }

  public resize(x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) {
    const filledBounds = this.bounds.setHeight(this.bounds.getHeight() - filledHeightDiff);
    this.setBounds(filledBounds);
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
    const grown = this.getGrowTop(px);

    this.topLayouts.map((z) => {
      const growSelfBy = Math.max(Math.min(grown, this.bounds.top - z.bounds.bottom), 0);
      const shrinkBy = Math.max(0, grown - growSelfBy);
      z.tryShrinkBottom(shrinkBy);
    });

    this._bounds = this.bounds.inset(0, -grown, 0, 0);
    return grown;
  }

  public getGrowTop(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    if (this.topLayouts.length === 0) {
      const growSelfBy = Math.max(Math.min(px, this.bounds.top - this.root.bounds.top), 0);
      return growSelfBy;
    }

    const zones = this.topLayouts.map((z) => {
      const growSelfBy = Math.max(Math.min(px, this.bounds.top - z.bounds.bottom), 0);
      const shrinkBy = Math.max(0, px - growSelfBy);
      const shrunkBy = z.getShrinkBottom(shrinkBy);
      return {
        z,
        growSelfBy,
        shrunkBy,
      };
    });

    const minTop = zones.reduce((prev, curr) => {
      const total = curr.growSelfBy + curr.shrunkBy;
      if (total < prev)
        return total;
      return prev;
    }, zones[0].growSelfBy + zones[0].shrunkBy);

    return minTop;
  }

  public tryShrinkTop(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const height = this._bounds.getHeight();
    const shrinkSelfBy = Math.max(0, Math.min(px, height - this.minHeight));

    const maxBottom = this.bottomLayouts.length > 0 ? this.bottomLayouts[0].bounds.top : this.root.bounds.bottom;
    const moveBottom = Math.max(0, Math.min(px - shrinkSelfBy, maxBottom - this.bounds.bottom));

    const shrinkBottomBy = Math.max(0, px - shrinkSelfBy - moveBottom);
    const bottomShrunkBy = this.bottomLayouts.length > 0 ? this.bottomLayouts[0].tryShrinkTop(shrinkBottomBy) : 0;

    this._bounds = this.bounds.inset(0, shrinkSelfBy, 0, 0);
    this._bounds = this.bounds.offsetY(moveBottom + bottomShrunkBy);

    return moveBottom + shrinkSelfBy + bottomShrunkBy;
  }

  public tryGrowBottom(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const maxBottom = this.bottomLayouts.length > 0 ? this.bottomLayouts[0].bounds.top : this.root.bounds.bottom;
    const growSelfBy = Math.max(0, Math.min(px, maxBottom - this.bounds.bottom));
    const shrinkBottomZoneBy = Math.max(0, px - growSelfBy);

    const bottomLayoutshrunkBy = this.bottomLayouts.length > 0 ? this.bottomLayouts[0].tryShrinkTop(shrinkBottomZoneBy) : 0;

    const grown = growSelfBy + bottomLayoutshrunkBy;
    this._bounds = this.bounds.inset(0, 0, 0, -grown);

    return grown;
  }

  public tryShrinkBottom(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const height = this.bounds.getHeight();
    const shrinkSelfBy = Math.max(0, Math.min(px, height - this.minHeight));

    const maxTop = this.topLayouts.length > 0 ? this.topLayouts[0].bounds.bottom : this.root.bounds.top;
    const moveTop = Math.max(0, Math.min(px - shrinkSelfBy, this.bounds.top - maxTop));
    const shrinkTopBy = Math.max(0, px - shrinkSelfBy - moveTop);
    const topShrunkBy = this.topLayouts.length > 0 ? this.topLayouts[0].tryShrinkBottom(shrinkTopBy) : 0;

    this._bounds = this.bounds.inset(0, 0, 0, shrinkSelfBy);
    this._bounds = this.bounds.offsetY(-(topShrunkBy + moveTop));

    return moveTop + shrinkSelfBy + topShrunkBy;
  }

  public getShrinkBottom(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const height = this.bounds.getHeight();
    const shrinkSelfBy = Math.max(0, Math.min(px, height - this.minHeight));

    const maxTop = this.topLayouts.length > 0 ? this.topLayouts[0].bounds.bottom : this.root.bounds.top;
    const moveTop = Math.max(0, Math.min(px - shrinkSelfBy, this.bounds.top - maxTop));
    const shrinkTopBy = Math.max(0, px - shrinkSelfBy - moveTop);
    const topShrunkBy = this.topLayouts.length > 0 ? this.topLayouts[0].getShrinkBottom(shrinkTopBy) : 0;

    return moveTop + shrinkSelfBy + topShrunkBy;
  }

  public tryGrowLeft(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const initialBounds = this.getInitialBounds();
    const newLeft = this.bounds.left - px;
    if (this.anchor === HorizontalAnchor.Right && newLeft < initialBounds.left)
      px = Math.max(Math.min(px, px - initialBounds.left + newLeft), 0);

    const minLeft = this.leftLayouts.length > 0 ? this.leftLayouts[0].bounds.right : this.root.bounds.left;
    const growSelfBy = Math.max(Math.min(px, this.bounds.left - minLeft), 0);
    const shrinkBy = Math.max(0, px - growSelfBy);
    const shrunkBy = this.leftLayouts.length > 0 ? this.leftLayouts[0].tryShrinkRight(shrinkBy) : 0;

    const grown = growSelfBy + shrunkBy;
    this._bounds = this.bounds.inset(-grown, 0, 0, 0);
    return grown;
  }

  public tryShrinkLeft(px: number): number {
    if (px < 0)
      throw new RangeError();

    const width = this.bounds.getWidth();
    const shrinkSelfBy = Math.max(0, Math.min(px, width - this.minWidth));

    const maxRight = this.rightLayouts.length > 0 ? this.rightLayouts[0].bounds.left : this.root.bounds.right;
    const moveRight = Math.max(0, Math.min(px - shrinkSelfBy, maxRight - this.bounds.right));

    const shrinkRightBy = Math.max(0, px - shrinkSelfBy - moveRight);
    const rightShrunkBy = this.rightLayouts.length > 0 ? this.rightLayouts[0].tryShrinkLeft(shrinkRightBy) : 0;

    this._bounds = this.bounds.inset(shrinkSelfBy, 0, 0, 0);
    this._bounds = this.bounds.offsetX(rightShrunkBy + moveRight);

    return shrinkSelfBy + rightShrunkBy + moveRight;
  }

  public tryGrowRight(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const initialBounds = this.getInitialBounds();
    const newRight = this.bounds.right + px;
    if (this.anchor === HorizontalAnchor.Left && newRight > initialBounds.right)
      px = Math.max(Math.min(px, px - newRight + initialBounds.right), 0);

    const maxRight = this.rightLayouts.length > 0 ? this.rightLayouts[0].bounds.left : this.root.bounds.right;
    const growSelfBy = Math.max(Math.min(px, maxRight - this.bounds.right), 0);
    const shrinkBy = Math.max(0, px - growSelfBy);
    const shrunkBy = this.rightLayouts.length > 0 ? this.rightLayouts[0].tryShrinkLeft(shrinkBy) : 0;

    const grown = growSelfBy + shrunkBy;
    this._bounds = this.bounds.inset(0, 0, -grown, 0);
    return grown;
  }

  public tryShrinkRight(px: number): number {
    if (px < 0)
      throw new RangeError();

    if (!this.isResizable)
      return 0;

    const width = this.bounds.getWidth();
    const shrinkSelfBy = Math.max(0, Math.min(px, width - this.minWidth));

    const minLeft = this.leftLayouts.length > 0 ? this.leftLayouts[0].bounds.right : this.root.bounds.left;
    const moveLeft = Math.max(0, Math.min(px - shrinkSelfBy, this.bounds.left - minLeft));

    const shrinkLeftBy = Math.max(0, px - shrinkSelfBy - moveLeft);
    const leftShrunkBy = this.leftLayouts.length > 0 ? this.leftLayouts[0].tryShrinkRight(shrinkLeftBy) : 0;

    this._bounds = this.bounds.inset(0, 0, shrinkSelfBy, 0);
    this._bounds = this.bounds.offsetX(-(leftShrunkBy + moveLeft));

    return shrinkSelfBy + leftShrunkBy + moveLeft;
  }
}

export default Layout;
