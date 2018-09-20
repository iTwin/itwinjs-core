/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { RectangleProps } from "../../../utilities/Rectangle";
import { WidgetZone } from "../Zone";
import NineZone from "../NineZone";
import Layout from "./Layout";
import Root from "./Root";
import { HorizontalAnchor } from "../../../widget/Stacked";

export class NineZoneRoot extends Root {
  public constructor(public readonly nineZone: NineZone) {
    super(nineZone.props.size, nineZone.getStatusZone().props.isInFooterMode);
  }
}

export interface WidgetZoneLayoutProps {
  readonly zone: WidgetZone;
  readonly root: NineZoneRoot;
  readonly leftZones?: WidgetZoneLayout.AdjacentZonesGetter;
  readonly topZones?: WidgetZoneLayout.AdjacentZonesGetter;
  readonly rightZones?: WidgetZoneLayout.AdjacentZonesGetter;
  readonly bottomZones?: WidgetZoneLayout.AdjacentZonesGetter;
}

export class WidgetZoneLayout extends Layout {
  public readonly zone: WidgetZone;
  public readonly root: NineZoneRoot;
  private readonly _leftZones: WidgetZoneLayout.AdjacentZonesGetter;
  private readonly _topZones: WidgetZoneLayout.AdjacentZonesGetter;
  private readonly _rightZones: WidgetZoneLayout.AdjacentZonesGetter;
  private readonly _bottomZones: WidgetZoneLayout.AdjacentZonesGetter;

  public constructor(props: WidgetZoneLayoutProps) {
    super({
      bounds: props.zone.bounds,
      root: props.root,
    });

    this.zone = props.zone;
    this.root = props.root;

    this._leftZones = props.leftZones || WidgetZoneLayout.adjacentZones(new WidgetZoneLayout.LeftZones());
    this._topZones = props.topZones || WidgetZoneLayout.adjacentZones(new WidgetZoneLayout.TopZones());
    this._rightZones = props.rightZones || WidgetZoneLayout.adjacentZones(new WidgetZoneLayout.RightZones());
    this._bottomZones = props.bottomZones || WidgetZoneLayout.adjacentZones(new WidgetZoneLayout.BottomZones());
  }

  private get _columnStartFraction() {
    return this.zone.cell.col / 3;
  }

  private get _columnEndFraction() {
    return (this.zone.cell.col + 1) / 3;
  }

  private get _rowStartFraction() {
    return this.zone.cell.row / 3;
  }

  private get _rowEndFraction() {
    return (this.zone.cell.row + 1) / 3;
  }

  public getInitialBounds(): RectangleProps {
    const isInFooterMode = this.zone.nineZone.root.isInFooterMode;
    const rootBounds = this.zone.nineZone.root.bounds;
    const parentBounds = isInFooterMode ? rootBounds.inset(0, 0, 0, Root.FOOTER_HEIGHT) : rootBounds;
    const parentSize = parentBounds.getSize();

    const left = parentBounds.left + parentSize.width * this._columnStartFraction;
    const right = parentBounds.left + parentSize.width * this._columnEndFraction;
    const top = parentBounds.top + parentSize.height * this._rowStartFraction;
    const bottom = parentBounds.top + parentSize.height * this._rowEndFraction;

    return new Rectangle(left, top, right, bottom);
  }

  public get anchor(): HorizontalAnchor {
    return this.zone.horizontalAnchor;
  }

  public getInitialLeftZone(): WidgetZone | undefined {
    return undefined;
  }

  public getInitialTopZone(): WidgetZone | undefined {
    return undefined;
  }

  public getInitialRightZone(): WidgetZone | undefined {
    return undefined;
  }

  public getInitialBottomZone(): WidgetZone | undefined {
    return undefined;
  }

  public getLeftZones(): WidgetZone[] {
    return this._leftZones(this);
  }

  public getRightZones(): WidgetZone[] {
    return this._rightZones(this);
  }

  public getTopZones(): WidgetZone[] {
    return this._topZones(this);
  }

  public getBottomZones(): WidgetZone[] {
    return this._bottomZones(this);
  }

  public get leftLayouts() {
    return this.getLeftZones().map((z) => z.getLayout());
  }

  public get topLayouts() {
    return this.getTopZones().map((z) => z.getLayout());
  }

  public get rightLayouts() {
    return this.getRightZones().map((z) => z.getLayout());
  }

  public get bottomLayouts() {
    return this.getBottomZones().map((z) => z.getLayout());
  }
}

export namespace WidgetZoneLayout {
  export interface AdjacentZonesStrategy {
    getSingleMergedZone(isMergedVertically: boolean): boolean;
    reduceToFirstZone(): boolean;
    getInitialZone(layout: WidgetZoneLayout): WidgetZone | undefined;
  }

  export class LeftZones implements AdjacentZonesStrategy {
    public getSingleMergedZone(isMergedVertically: boolean): boolean {
      return !isMergedVertically;
    }

    public reduceToFirstZone(): boolean {
      return true;
    }

    public getInitialZone(layout: WidgetZoneLayout): WidgetZone | undefined {
      return layout.getInitialLeftZone();
    }
  }

  export class TopZones implements AdjacentZonesStrategy {
    public getSingleMergedZone(isMergedVertically: boolean): boolean {
      return isMergedVertically;
    }

    public reduceToFirstZone(): boolean {
      return true;
    }

    public getInitialZone(layout: WidgetZoneLayout): WidgetZone | undefined {
      return layout.getInitialTopZone();
    }
  }

  export class BottomZones implements AdjacentZonesStrategy {
    public getSingleMergedZone(isMergedVertically: boolean): boolean {
      return isMergedVertically;
    }

    public reduceToFirstZone(): boolean {
      return false;
    }

    public getInitialZone(layout: WidgetZoneLayout): WidgetZone | undefined {
      return layout.getInitialBottomZone();
    }
  }

  export class RightZones implements AdjacentZonesStrategy {
    public getSingleMergedZone(isMergedVertically: boolean): boolean {
      return !isMergedVertically;
    }

    public reduceToFirstZone(): boolean {
      return false;
    }

    public getInitialZone(layout: WidgetZoneLayout): WidgetZone | undefined {
      return layout.getInitialRightZone();
    }
  }

  export type AdjacentZonesGetter = (layout: WidgetZoneLayout) => WidgetZone[];

  export const adjacentZones = (strategy: AdjacentZonesStrategy): AdjacentZonesGetter => (layout: WidgetZoneLayout) => {
    const zone = layout.zone;
    if (zone.hasMergedWidgets) {
      const widgets = zone.getWidgets();
      const zones = widgets.map((w) => w.defaultZone);
      if (strategy.getSingleMergedZone(zone.isMergedVertically)) {
        const reducedZone = strategy.reduceToFirstZone() ? zones.reduce((prev, current) => prev.id < current.id ? prev : current, zones[0]) : zones.reduce((prev, current) => prev.id > current.id ? prev : current, zones[0]);
        const bottomZone = strategy.getInitialZone(reducedZone.getLayout());
        return bottomZone ? [bottomZone] : [];
      }
      const bottomZones = zones.reduce<WidgetZone[]>((prev, current) => {
        const initial = strategy.getInitialZone(current.getLayout());
        if (initial)
          prev.push(initial);
        return prev;
      }, []);
      return bottomZones;
    }

    const initialZone = strategy.getInitialZone(layout);
    if (!initialZone)
      return [];

    if (zone.hasSingleDefaultWidget && initialZone.isEmpty) {
      return [initialZone.defaultWidget.zone];
    }

    return [initialZone];
  };
}

export class Layout1 extends WidgetZoneLayout {
  public getInitialBottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(4);
  }

  public getInitialRightZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(2);
  }

  public get isResizable() {
    return false;
  }
}

export class Layout2 extends WidgetZoneLayout {
  public getInitialBottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(7);
  }

  public getInitialLeftZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(1);
  }

  public getInitialRightZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3);
  }

  public get isResizable() {
    return false;
  }
}

export class Layout3 extends WidgetZoneLayout {
  public getInitialBottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6);
  }

  public getInitialLeftZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(2);
  }

  public get minWidth() {
    return Layout.FREE_FORM_DEFAULT_MIN_WIDTH;
  }

  public get minHeight() {
    return Layout.FREE_FORM_DEFAULT_MIN_HEIGHT;
  }

  public get isResizable() {
    return false;
  }
}

export class Layout4 extends WidgetZoneLayout {
  public getInitialBottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(7);
  }

  public getInitialTopZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3);
  }
}

export class Layout6 extends WidgetZoneLayout {
  public getInitialBottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(9);
  }

  public getInitialTopZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3);
  }
}

export class Layout7 extends WidgetZoneLayout {
  public getInitialTopZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(4);
  }

  public getInitialBottomZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(8);
    return undefined;
  }

  public getInitialRightZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return undefined;
    return this.zone.nineZone.root.nineZone.getWidgetZone(8);
  }
}

export class Layout8 extends WidgetZoneLayout {
  public getInitialLeftZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return undefined;
    return this.zone.nineZone.root.nineZone.getWidgetZone(7);
  }

  public getInitialRightZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return undefined;
    return this.zone.nineZone.root.nineZone.getWidgetZone(9);
  }

  public getInitialBounds(): RectangleProps {
    const parentBounds = this.zone.nineZone.root.bounds;
    if (this.zone.nineZone.root.isInFooterMode)
      return new Rectangle(parentBounds.left, parentBounds.bottom - Root.FOOTER_HEIGHT, parentBounds.right, parentBounds.bottom);

    return super.getInitialBounds();
  }
}

export class Layout9 extends WidgetZoneLayout {
  public getInitialTopZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6);
  }

  public getInitialBottomZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(8);
    return undefined;
  }

  public getInitialLeftZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return undefined;
    return this.zone.nineZone.root.nineZone.getWidgetZone(8);
  }
}
