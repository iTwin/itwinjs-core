/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { RectangleProps } from "../../utilities/Rectangle";
import Cell from "../../utilities/Cell";
import Layout from "./layout/Layout";
import { HorizontalAnchor, VerticalAnchor } from "../../widget/Stacked";
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7, Layout8, Layout9 } from "./layout/Layouts";
import NineZone, { WidgetZoneIndex, ZoneIndex, StatusZoneIndex, ContentZoneIndex } from "./NineZone";
import Widget, { WidgetProps, getDefaultProps as getDefaultWidgetProps } from "./Widget";
import { TargetType } from "./Target";

export enum DropTarget {
  None,
  Merge,
  Back,
}

export interface ZoneProps {
  readonly id: WidgetZoneIndex;
  readonly bounds: RectangleProps;
  readonly floatingBounds?: RectangleProps;
  readonly widgets: ReadonlyArray<WidgetProps>;
  readonly anchor?: HorizontalAnchor;
  readonly allowsMerging: boolean;
}

export interface StatusZoneProps extends ZoneProps {
  readonly id: StatusZoneIndex;
  readonly isInFooterMode: boolean;
}

export const isStatusZone = (zone: ZoneProps): zone is StatusZoneProps => {
  if (zone.id === 8)
    return true;
  return false;
};

export const getDefaultProps = (id: WidgetZoneIndex): ZoneProps => {
  return {
    id,
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    widgets: [
      getDefaultWidgetProps(id),
    ],
    allowsMerging: true,
  };
};

export const getDefaultStatusZoneProps = (): StatusZoneProps => {
  return {
    id: 8,
    isInFooterMode: true,
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    widgets: [
      getDefaultWidgetProps(8),
    ],
    allowsMerging: true,
  };
};

export interface ZoneIdToWidget {
  zoneId: ZoneIndex;
  widget: Widget | undefined;
}

export namespace ZoneIdToWidget {
  export const sortAscending = (a: ZoneIdToWidget, b: ZoneIdToWidget): number => {
    return a.zoneId - b.zoneId;
  };
}

export class LayoutFactory {
  public create(zone: WidgetZone): Layout {
    switch (zone.props.id) {
      case 1:
        return new Layout1(zone);
      case 2:
        return new Layout2(zone);
      case 3:
        return new Layout3(zone);
      case 4:
        return new Layout4(zone);
      case 6:
        return new Layout6(zone);
      case 7:
        return new Layout7(zone);
      case 8:
        return new Layout8(zone);
      case 9:
        return new Layout9(zone);
    }
    throw new RangeError();
  }
}

export default class Zone {
  private readonly _id: ZoneIndex;
  protected _layout: Layout | undefined = undefined;
  protected _widgets: Widget[] | undefined = undefined;
  protected _isWidgetOpen: boolean | undefined = undefined;
  public readonly cell: Cell;

  public constructor(
    public readonly nineZone: NineZone,
    id: ZoneIndex,
  ) {
    this._id = id;
    this.cell = new Cell(Math.floor((id - 1) / 3), (id - 1) % 3);
  }

  public get id(): ZoneIndex {
    return this._id;
  }

  public get isMergeable(): boolean {
    return false;
  }

  public equals(other: Zone) {
    return this.id === other.id;
  }

  public isWidgetZone(): this is WidgetZone {
    if (this.id === 5)
      return false;
    return true;
  }

  public isStatusZone(): this is WidgetZone {
    if (this.id === 8)
      return true;
    return false;
  }

  public isFirst(zones: ReadonlyArray<Zone>) {
    return zones.every((z) => z.id >= this.id);
  }

  public isLast(zones: ReadonlyArray<Zone>) {
    return zones.every((z) => z.id <= this.id);
  }
}

export class WidgetZone extends Zone {
  protected _layout: Layout | undefined = undefined;
  protected _widgets: Widget[] | undefined = undefined;
  protected _cell: Cell | undefined = undefined;
  protected _isWidgetOpen: boolean | undefined = undefined;

  public constructor(public readonly nineZone: NineZone, public readonly props: ZoneProps) {
    super(nineZone, props.id);
  }

  public get id(): WidgetZoneIndex {
    return this.props.id;
  }

  public getLayout(): Layout {
    if (!this._layout)
      this._layout = new LayoutFactory().create(this);
    return this._layout;
  }

  public getWidgets(): ReadonlyArray<Widget> {
    if (!this._widgets) {
      this._widgets = [];
      for (const widget of this.props.widgets)
        this._widgets.push(new Widget(this, widget));
    }
    return this._widgets;
  }

  public get isWidgetOpen(): boolean {
    if (this._isWidgetOpen === undefined) {
      this._isWidgetOpen = false;
      for (const widget of this.props.widgets) {
        if (widget.tabIndex !== -1) {
          this._isWidgetOpen = true;
          break;
        }
      }
    }

    return this._isWidgetOpen;
  }

  public get isFloating() {
    if (this.props.floatingBounds)
      return true;
    return false;
  }

  public get isMergedVertically(): boolean {
    const widgets = this.getWidgets();
    return widgets.length > 1 && widgets[0].defaultZone.cell.isColumnAlignedWith(widgets[1].defaultZone.cell);
  }

  public get isMergedHorizontally(): boolean {
    const widgets = this.getWidgets();
    return widgets.length > 1 && widgets[0].defaultZone.cell.isRowAlignedWith(widgets[1].defaultZone.cell);
  }

  public get defaultHorizontalAnchor(): HorizontalAnchor {
    switch (this.props.id) {
      case 1:
      case 4:
      case 7:
        return HorizontalAnchor.Left;
      default:
        return HorizontalAnchor.Right;
    }
  }

  public get horizontalAnchor(): HorizontalAnchor {
    if (this.props.anchor !== undefined)
      return this.props.anchor;

    return this.defaultHorizontalAnchor;
  }

  public get verticalAnchor(): VerticalAnchor {
    switch (this.props.id) {
      case 7:
      case 8:
      case 9:
        return VerticalAnchor.Bottom;
      default:
        return VerticalAnchor.Middle;
    }
  }

  public get isMergeable(): boolean {
    if (!this.props.allowsMerging)
      return false;

    switch (this.props.id) {
      case 4:
      case 6:
      case 7:
      case 8:
      case 9:
        return true;
    }
    return false;
  }

  public getDropTarget(): DropTarget {
    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return DropTarget.None;

    const draggingZone = draggingWidget.zone;
    if (!this.isMergeable)
      return DropTarget.None;

    if (draggingZone.equals(this))
      return DropTarget.Back;

    const draggingCell = draggingZone.cell;
    const targetCell = this.cell;
    const cellsBetween = draggingCell.getAlignedCellsTo(targetCell);
    for (const cell of cellsBetween) {
      const zone = this.nineZone.findZone(cell);
      if (!zone.isMergeable)
        return DropTarget.None;
    }

    if (draggingCell.isRowAlignedWith(targetCell))
      if (draggingZone.isMergedHorizontally || draggingZone.props.widgets.length === 1)
        if (this.isMergedHorizontally || this.props.widgets.length === 1)
          return DropTarget.Merge;

    if (draggingCell.isColumnAlignedWith(targetCell))
      if (draggingZone.isMergedVertically || draggingZone.props.widgets.length === 1)
        if (this.isMergedVertically || this.props.widgets.length === 1)
          return DropTarget.Merge;

    return DropTarget.None;
  }

  public getUnmergeWidgetBounds(widget: Widget): Array<{ id: WidgetZoneIndex, bounds: RectangleProps }> {
    const defaultZone = widget.defaultZone;
    const mergedZones = Widget.sort(this.getWidgets()).map((w) => w.defaultZone);
    const isFirst = defaultZone.isFirst(mergedZones);
    const isLast = defaultZone.isLast(mergedZones);
    const isMergedHorizontally = this.isMergedHorizontally;
    const isMergedVertically = this.isMergedVertically;

    if ((!isFirst && !isLast) || mergedZones.length < 3 || (!isMergedHorizontally && !isMergedVertically) || widget.isInHomeZone)
      return this.getUnmergeBounds();

    const zoneBounds = Rectangle.create(this.props.bounds);
    const segmentId = isFirst ? 0 : mergedZones.length - 1;
    const defaultZoneBounds = isMergedHorizontally ? zoneBounds.getHorizontalSegmentBounds(segmentId, mergedZones.length) :
      zoneBounds.getVerticalSegmentBounds(segmentId, mergedZones.length);
    const bounds = isFirst ?
      isMergedHorizontally ? zoneBounds.inset(defaultZoneBounds.getWidth(), 0, 0, 0) :
        zoneBounds.inset(0, defaultZoneBounds.getHeight(), 0, 0) :
      isMergedHorizontally ? zoneBounds.inset(0, 0, defaultZoneBounds.getWidth(), 0) :
        zoneBounds.inset(0, 0, 0, defaultZoneBounds.getHeight());

    return [
      {
        id: defaultZone.id,
        bounds: defaultZoneBounds,
      },
      {
        id: this.id,
        bounds,
      },
    ];
  }

  public getUnmergeBounds(): Array<{ id: WidgetZoneIndex, bounds: RectangleProps }> {
    const mergedZones = Widget.sort(this.getWidgets()).map((w) => w.defaultZone);
    const zoneBounds = Rectangle.create(this.props.bounds);
    const isMergedHorizontally = this.isMergedHorizontally;
    const isMergedVertically = this.isMergedVertically;

    if (isMergedHorizontally) {
      return mergedZones.map((z, index) => ({
        id: z.id,
        bounds: zoneBounds.getHorizontalSegmentBounds(index, mergedZones.length),
      }));
    } else if (isMergedVertically) {
      return mergedZones.map((z, index) => ({
        id: z.id,
        bounds: zoneBounds.getVerticalSegmentBounds(index, mergedZones.length),
      }));
    }
    return [{
      id: this.id,
      bounds: this.props.bounds,
    }];
  }

  public getGhostOutlineBounds(): RectangleProps | undefined {
    const target = this.nineZone.target;
    if (!target)
      return undefined;

    const draggingWidget = this.nineZone.draggingWidget;

    if (!draggingWidget)
      return undefined;

    const draggingZone = draggingWidget.zone;

    switch (target.type) {
      case TargetType.Merge: {
        const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
        const mergedBounds = draggingZoneBounds.outerMergeWith(target.zone.props.bounds);
        if (target.zone.id === this.props.id)
          return mergedBounds;
        break;
      }
      case TargetType.Back: {
        const widgets = Widget.sort(draggingZone.getWidgets());
        const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
        const isHorizontal = draggingZone.isMergedHorizontally;

        if (draggingZone.props.widgets.length > 2 && target.zone.equals(draggingZone)) {
          const widgetHeight = draggingZoneBounds.getHeight() / widgets.length;
          const widgetWidth = draggingZoneBounds.getWidth() / widgets.length;

          const first = widgets[0];
          const last = widgets[widgets.length - 1];

          const mergedZonesHeight = (widgets.length - 1) * widgetHeight;
          let mergedZonesBounds = draggingZoneBounds.setHeight(mergedZonesHeight);
          let unmergedZoneBounds = draggingZoneBounds.inset(0, mergedZonesHeight, 0, 0);
          if (isHorizontal) {
            const mergedZonesWidth = (widgets.length - 1) * widgetWidth;
            mergedZonesBounds = draggingZoneBounds.setWidth(mergedZonesWidth);
            unmergedZoneBounds = draggingZoneBounds.inset(mergedZonesWidth, 0, 0, 0);
          }

          if (first.defaultZone.props.id === this.props.id)
            return mergedZonesBounds;
          if (last.defaultZone.props.id === this.props.id)
            return unmergedZoneBounds;
        } else {
          const contentZone = this.nineZone.getContentZone();
          const statusZone = this.nineZone.getStatusZone();
          const zoneToWidgetArray =
            (
              [
                ...widgets.map((widget) => ({
                  zoneId: widget.defaultZone.props.id,
                  widget,
                })),
                ...(Widget.isCellBetweenWidgets(contentZone.cell, widgets) ? [{
                  zoneId: contentZone.id,
                  widget: undefined,
                }] : []),
                ...(statusZone.props.isInFooterMode && Widget.isCellBetweenWidgets(statusZone.cell, widgets) ? [{
                  zoneId: statusZone.id,
                  widget: undefined,
                }] : []),
              ] as ZoneIdToWidget[]
            ).sort(ZoneIdToWidget.sortAscending);

          const widgetHeight = draggingZoneBounds.getHeight() / zoneToWidgetArray.length;
          const widgetWidth = draggingZoneBounds.getWidth() / zoneToWidgetArray.length;
          for (let i = 0; i < zoneToWidgetArray.length; i++) {
            const zoneToWidget = zoneToWidgetArray[i];
            if (!zoneToWidget.widget)
              continue;

            const topInset = i * widgetHeight;
            const bottomInset = (zoneToWidgetArray.length - i - 1) * widgetHeight;
            let bounds = draggingZoneBounds.inset(0, topInset, 0, bottomInset);
            if (isHorizontal) {
              const leftInset = i * widgetWidth;
              const rightInset = (zoneToWidgetArray.length - i - 1) * widgetWidth;
              bounds = draggingZoneBounds.inset(leftInset, 0, rightInset, 0);
            }

            if (zoneToWidget.widget.defaultZone.props.id === this.props.id)
              return bounds;
          }
        }
        break;
      }
    }

    return undefined;
  }
}

export class StatusZone extends WidgetZone {
  public static readonly id: StatusZoneIndex = 8;
  public constructor(nineZone: NineZone, public readonly props: StatusZoneProps) {
    super(nineZone, props);
  }

  public get id(): StatusZoneIndex {
    return this.props.id;
  }

  public get isMergeable(): boolean {
    if (this.props.isInFooterMode)
      return false;
    return super.isMergeable;
  }
}

export class ContentZone extends Zone {
  public static readonly id: ContentZoneIndex = 5;

  public constructor(nineZone: NineZone) {
    super(nineZone, ContentZone.id);
  }

  public get id(): ContentZoneIndex {
    return super.id as ContentZoneIndex;
  }
}
