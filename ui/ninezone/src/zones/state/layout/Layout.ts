/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { Edge, RectangleProps } from "../../../utilities/Rectangle";
import ResizeHandle from "../../../widget/rectangular/ResizeHandle";
import { HorizontalAnchor } from "../../../widget/Stacked";
import Root from "./Root";

export interface LayoutProps {
  readonly bounds: RectangleProps;
  readonly floatingBounds?: RectangleProps;
  readonly root: Root;
  readonly resizers?: Partial<Resizers>;
}

export class Layout {
  public static readonly RECTANGULAR_DEFAULT_MIN_WIDTH = 296;
  public static readonly RECTANGULAR_DEFAULT_MIN_HEIGHT = 220;
  public static readonly FREE_FORM_DEFAULT_MIN_WIDTH = 96;
  public static readonly FREE_FORM_DEFAULT_MIN_HEIGHT = 88;

  public readonly root: Root;
  private _bounds: Rectangle;
  private _floatingBounds?: Rectangle;
  private _growTop: ResizeStrategy;
  private _shrinkTop: ResizeStrategy;
  private _growBottom: ResizeStrategy;
  private _shrinkBottom: ResizeStrategy;
  private _growLeft: ResizeStrategy;
  private _shrinkLeft: ResizeStrategy;
  private _growRight: ResizeStrategy;
  private _shrinkRight: ResizeStrategy;

  public constructor(props: LayoutProps) {
    this._bounds = Rectangle.create(props.bounds);
    this._floatingBounds = props.floatingBounds ? Rectangle.create(props.floatingBounds) : undefined;
    this.root = props.root;

    this._growTop = (props.resizers && props.resizers.growTop) || new GrowTopStrategy();
    this._shrinkTop = (props.resizers && props.resizers.shrinkTop) || new ShrinkTopStrategy();
    this._growBottom = (props.resizers && props.resizers.growBottom) || new GrowBottomStrategy();
    this._shrinkBottom = (props.resizers && props.resizers.shrinkBottom) || new ShrinkBottomStrategy();
    this._growLeft = (props.resizers && props.resizers.growLeft) || new GrowLeftStrategy();
    this._shrinkLeft = (props.resizers && props.resizers.shrinkLeft) || new ShrinkLeftStrategy();
    this._growRight = (props.resizers && props.resizers.growRight) || new GrowRightStrategy();
    this._shrinkRight = (props.resizers && props.resizers.shrinkRight) || new ShrinkRightStrategy();
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

  /** @hidden */
  public set bounds(bounds: Rectangle) {
    this._bounds = bounds;
  }

  public get floatingBounds() {
    return this._floatingBounds;
  }

  public set floatingBounds(bounds: Rectangle | undefined) {
    this._floatingBounds = bounds;
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

  public getInitialBounds(): Rectangle {
    return new Rectangle();
  }

  public get anchor(): HorizontalAnchor {
    return HorizontalAnchor.Right;
  }

  public get isResizable(): boolean {
    return true;
  }

  public resize(x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) {
    if (this.floatingBounds) {
      this.floatingBounds = this.floatingBounds.setHeight(this.floatingBounds.getHeight() - filledHeightDiff);
      switch (handle) {
        case Edge.Top: {
          if (y < 0)
            this._growTop.tryResizeFloating(-y, this);
          else if (y > 0)
            this._shrinkTop.tryResizeFloating(y, this);
          break;
        }
        case Edge.Bottom: {
          if (y < 0)
            this._shrinkBottom.tryResizeFloating(-y, this);
          else if (y > 0)
            this._growBottom.tryResizeFloating(y, this);
          break;
        }
        case Edge.Left: {
          if (x < 0)
            this._growLeft.tryResizeFloating(-x, this);
          else if (x > 0)
            this._shrinkLeft.tryResizeFloating(x, this);
          break;
        }
        case Edge.Right: {
          if (x < 0)
            this._shrinkRight.tryResizeFloating(-x, this);
          else if (x > 0)
            this._growRight.tryResizeFloating(x, this);
          break;
        }
      }
      return;
    }

    this.bounds = this.bounds.setHeight(this.bounds.getHeight() - filledHeightDiff);
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
    return this._growTop.tryResize(px, this);
  }

  public getGrowTop(px: number): number {
    return this._growTop.getMaxResize(px, this);
  }

  public tryShrinkTop(px: number): number {
    return this._shrinkTop.tryResize(px, this);
  }

  public getShrinkTop(px: number): number {
    return this._shrinkTop.getMaxResize(px, this);
  }

  public tryGrowBottom(px: number): number {
    return this._growBottom.tryResize(px, this);
  }

  public getGrowBottom(px: number): number {
    return this._growBottom.getMaxResize(px, this);
  }

  public tryShrinkBottom(px: number): number {
    return this._shrinkBottom.tryResize(px, this);
  }

  public getShrinkBottom(px: number): number {
    return this._shrinkBottom.getMaxResize(px, this);
  }

  public tryGrowLeft(px: number): number {
    return this._growLeft.tryResize(px, this);
  }

  public getGrowLeft(px: number): number {
    return this._growLeft.getMaxResize(px, this);
  }

  public tryShrinkLeft(px: number): number {
    return this._shrinkLeft.tryResize(px, this);
  }

  public getShrinkLeft(px: number): number {
    return this._shrinkLeft.getMaxResize(px, this);
  }

  public tryGrowRight(px: number): number {
    return this._growRight.tryResize(px, this);
  }

  public getGrowRight(px: number): number {
    return this._growRight.getMaxResize(px, this);
  }

  public tryShrinkRight(px: number): number {
    return this._shrinkRight.tryResize(px, this);
  }

  public getShrinkRight(px: number): number {
    return this._shrinkRight.getMaxResize(px, this);
  }
}

export interface ResizeStrategy {
  getMaxResize(px: number, layout: Layout): number;
  tryResize(px: number, layout: Layout): number;
  tryResizeFloating(px: number, layout: Layout): number;
}

export abstract class GrowStrategy implements ResizeStrategy {
  public abstract getLayoutsToShrink(layout: Layout): Layout[];
  public abstract getSpaceToRoot(bounds: Rectangle, root: Root): number;
  public abstract getMaxGrowSelfBy(layoutToShrink: Layout, layout: Layout): number;
  public abstract getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number): number;
  public abstract tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number): void;
  public abstract getResizedBounds(bounds: Rectangle, growBy: number): Rectangle;

  public getMaxGrowBy(_layout: Layout): number {
    return Number.MAX_SAFE_INTEGER;
  }

  public getMaxResize(px: number, layout: Layout) {
    if (px < 0)
      throw new RangeError();

    if (!layout.isResizable)
      return 0;

    const growBy = Math.min(px, this.getMaxGrowBy(layout));
    const layoutsToShrink = this.getLayoutsToShrink(layout);
    if (layoutsToShrink.length === 0) {
      const maxResizeToRoot = this.getSpaceToRoot(layout.bounds, layout.root);
      const growSelfBy = Math.max(Math.min(growBy, maxResizeToRoot), 0);
      return growSelfBy;
    }

    return layoutsToShrink.reduce((min, current) => {
      const maxGrowSelfBy = this.getMaxGrowSelfBy(current, layout);
      const growSelfBy = Math.max(0, Math.min(growBy, maxGrowSelfBy));
      const shrinkBy = Math.max(0, growBy - growSelfBy);
      const shrunkBy = this.getMaxShrinkLayout(current, shrinkBy);
      const total = growSelfBy + shrunkBy;
      return total < min ? total : min;
    }, Number.MAX_SAFE_INTEGER);
  }

  public tryResize(px: number, layout: Layout) {
    const growBy = this.getMaxResize(px, layout);

    const layoutsToShrink = this.getLayoutsToShrink(layout);
    layoutsToShrink.map((z) => {
      const maxGrowSelfBy = this.getMaxGrowSelfBy(z, layout);
      const growSelfBy = Math.max(0, Math.min(growBy, maxGrowSelfBy));
      const shrinkBy = Math.max(0, growBy - growSelfBy);
      this.tryShrinkLayout(z, shrinkBy);
    });

    layout.bounds = this.getResizedBounds(layout.bounds, growBy);
    return growBy;
  }

  public tryResizeFloating(px: number, layout: Layout) {
    if (px < 0)
      throw new RangeError();
    if (!layout.floatingBounds)
      throw new ReferenceError();
    if (!layout.isResizable)
      return 0;

    const growBy = Math.min(px, this.getMaxGrowBy(layout));
    const spaceToRoot = this.getSpaceToRoot(layout.floatingBounds, layout.root);
    const growSelfBy = Math.max(Math.min(growBy, spaceToRoot), 0);

    layout.floatingBounds = this.getResizedBounds(layout.floatingBounds, growSelfBy);
    return growBy;
  }
}

export abstract class ShrinkStrategy implements ResizeStrategy {
  public abstract getLayoutsToShrink(layout: Layout): Layout[];
  public abstract getMaxMoveToRoot(layout: Layout): number;
  public abstract getMaxMoveSelfBy(layoutToShrink: Layout, layout: Layout): number;
  public abstract getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number): number;
  public abstract tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number): void;
  public abstract getResizedBounds(bounds: Rectangle, shrinkBy: number, moveBy: number): Rectangle;
  public abstract getMinSize(layout: Layout): number;
  public abstract getCurrentSize(bounds: Rectangle): number;

  public getMaxResize(px: number, layout: Layout) {
    if (px < 0)
      throw new RangeError();

    if (!layout.isResizable)
      return 0;

    const minSize = this.getMinSize(layout);
    const currentSize = this.getCurrentSize(layout.bounds);
    const shrinkSelfBy = Math.max(0, Math.min(px, currentSize - minSize));
    const layoutsToShrink = this.getLayoutsToShrink(layout);
    if (layoutsToShrink.length === 0) {
      const maxMoveToRoot = this.getMaxMoveToRoot(layout);
      const moveSelfBy = Math.max(0, Math.min(px - shrinkSelfBy, maxMoveToRoot));
      return shrinkSelfBy + moveSelfBy;
    }

    const minTotal = layoutsToShrink.reduce((min, current) => {
      const maxMoveSelfBy = this.getMaxMoveSelfBy(current, layout);
      const moveSelfBy = Math.max(0, Math.min(px - shrinkSelfBy, maxMoveSelfBy));
      const shrinkBy = Math.max(0, px - shrinkSelfBy - moveSelfBy);
      const shrunkBy = this.getMaxShrinkLayout(current, shrinkBy);
      const total = moveSelfBy + shrunkBy;
      return total < min ? total : min;
    }, Number.MAX_SAFE_INTEGER);

    return minTotal + shrinkSelfBy;
  }

  public tryResize(px: number, layout: Layout) {
    const maxResize = this.getMaxResize(px, layout);

    const minSize = this.getMinSize(layout);
    const currentSize = this.getCurrentSize(layout.bounds);
    const shrinkSelfBy = Math.max(0, Math.min(maxResize, currentSize - minSize));
    const layoutsToShrink = this.getLayoutsToShrink(layout);
    layoutsToShrink.map((z) => {
      const maxMoveSelfBy = this.getMaxMoveSelfBy(z, layout);
      const moveSelfBy = Math.max(0, Math.min(maxResize - shrinkSelfBy, maxMoveSelfBy));
      const shrinkBy = Math.max(0, maxResize - shrinkSelfBy - moveSelfBy);
      this.tryShrinkLayout(z, shrinkBy);
    });

    layout.bounds = this.getResizedBounds(layout.bounds, shrinkSelfBy, maxResize - shrinkSelfBy);

    return maxResize;
  }

  public tryResizeFloating(px: number, layout: Layout) {
    if (px < 0)
      throw new RangeError();
    if (!layout.floatingBounds)
      throw new ReferenceError();
    if (!layout.isResizable)
      return 0;

    const minSize = this.getMinSize(layout);
    const currentSize = this.getCurrentSize(layout.floatingBounds);
    const shrinkSelfBy = Math.max(0, Math.min(px, currentSize - minSize));

    layout.floatingBounds = this.getResizedBounds(layout.floatingBounds, shrinkSelfBy, 0);

    return shrinkSelfBy;
  }
}

export abstract class ShrinkVerticalStrategy extends ShrinkStrategy {
  public getMinSize(layout: Layout): number {
    return layout.minHeight;
  }

  public getCurrentSize(bounds: Rectangle): number {
    return bounds.getHeight();
  }
}

export abstract class ShrinkHorizontalStrategy extends ShrinkStrategy {
  public getMinSize(layout: Layout): number {
    return layout.minWidth;
  }

  public getCurrentSize(bounds: Rectangle): number {
    return bounds.getWidth();
  }
}

export class GrowTopStrategy extends GrowStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.topLayouts;
  }

  public getSpaceToRoot(bounds: Rectangle, root: Root) {
    return bounds.top - root.bounds.top;
  }

  public getMaxGrowSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layout.bounds.top - layoutToShrink.bounds.bottom;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkBottom(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkBottom(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, growBy: number) {
    return bounds.inset(0, -growBy, 0, 0);
  }
}

export class ShrinkTopStrategy extends ShrinkVerticalStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.bottomLayouts;
  }

  public getMaxMoveToRoot(layout: Layout) {
    return layout.root.bounds.bottom - layout.bounds.bottom;
  }

  public getMaxMoveSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layoutToShrink.bounds.top - layout.bounds.bottom;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkTop(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkTop(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, shrinkBy: number, moveBy: number) {
    const resizedBounds = bounds.inset(0, shrinkBy, 0, 0);
    return resizedBounds.offsetY(moveBy);
  }
}

export class GrowBottomStrategy extends GrowStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.bottomLayouts;
  }

  public getSpaceToRoot(bounds: Rectangle, root: Root) {
    return root.bounds.bottom - bounds.bottom;
  }

  public getMaxGrowSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layoutToShrink.bounds.top - layout.bounds.bottom;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkTop(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkTop(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, growBy: number) {
    return bounds.inset(0, 0, 0, -growBy);
  }
}

export class ShrinkBottomStrategy extends ShrinkVerticalStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.topLayouts;
  }

  public getMaxMoveToRoot(layout: Layout) {
    return layout.bounds.top - layout.root.bounds.top;
  }

  public getMaxMoveSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layout.bounds.top - layoutToShrink.bounds.bottom;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkBottom(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkBottom(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, shrinkBy: number, moveBy: number) {
    const resizedBounds = bounds.inset(0, 0, 0, shrinkBy);
    return resizedBounds.offsetY(-moveBy);
  }
}

export class GrowLeftStrategy extends GrowStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.leftLayouts;
  }

  public getMaxGrowBy(layout: Layout) {
    if (layout.floatingBounds)
      return Number.MAX_SAFE_INTEGER;

    const initialBounds = layout.getInitialBounds();
    return layout.anchor === HorizontalAnchor.Right ? layout.bounds.left - initialBounds.left : Number.MAX_SAFE_INTEGER;
  }

  public getSpaceToRoot(bounds: Rectangle, root: Root) {
    return bounds.left - root.bounds.left;
  }

  public getMaxGrowSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layout.bounds.left - layoutToShrink.bounds.right;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkRight(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkRight(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, growBy: number) {
    return bounds.inset(-growBy, 0, 0, 0);
  }
}

export class ShrinkLeftStrategy extends ShrinkHorizontalStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.rightLayouts;
  }

  public getMaxMoveToRoot(layout: Layout) {
    return layout.root.bounds.right - layout.bounds.right;
  }

  public getMaxMoveSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layoutToShrink.bounds.left - layout.bounds.right;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkLeft(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkLeft(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, shrinkBy: number, moveBy: number) {
    const resizedBounds = bounds.inset(shrinkBy, 0, 0, 0);
    return resizedBounds.offsetX(moveBy);
  }
}

export class GrowRightStrategy extends GrowStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.rightLayouts;
  }

  public getMaxGrowBy(layout: Layout) {
    if (layout.floatingBounds)
      return Number.MAX_SAFE_INTEGER;

    const initialBounds = layout.getInitialBounds();
    return layout.anchor === HorizontalAnchor.Left ? initialBounds.right - layout.bounds.right : Number.MAX_SAFE_INTEGER;
  }

  public getSpaceToRoot(bounds: Rectangle, root: Root) {
    return root.bounds.right - bounds.right;
  }

  public getMaxGrowSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layoutToShrink.bounds.left - layout.bounds.right;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkLeft(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkLeft(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, growBy: number) {
    return bounds.inset(0, 0, -growBy, 0);
  }
}

export class ShrinkRightStrategy extends ShrinkHorizontalStrategy {
  public getLayoutsToShrink(layout: Layout) {
    return layout.leftLayouts;
  }

  public getMaxMoveToRoot(layout: Layout) {
    return layout.bounds.left - layout.root.bounds.left;
  }

  public getMaxMoveSelfBy(layoutToShrink: Layout, layout: Layout) {
    return layout.bounds.left - layoutToShrink.bounds.right;
  }

  public getMaxShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    return layoutToShrink.getShrinkRight(shrinkBy);
  }

  public tryShrinkLayout(layoutToShrink: Layout, shrinkBy: number) {
    layoutToShrink.tryShrinkRight(shrinkBy);
  }

  public getResizedBounds(bounds: Rectangle, shrinkBy: number, moveBy: number) {
    const resizedBounds = bounds.inset(0, 0, shrinkBy, 0);
    return resizedBounds.offsetX(-moveBy);
  }
}

export interface Resizers {
  readonly growTop: ResizeStrategy;
  readonly growBottom: ResizeStrategy;
  readonly shrinkTop: ResizeStrategy;
  readonly shrinkBottom: ResizeStrategy;
  readonly growLeft: ResizeStrategy;
  readonly shrinkLeft: ResizeStrategy;
  readonly growRight: ResizeStrategy;
  readonly shrinkRight: ResizeStrategy;
}

export default Layout;
