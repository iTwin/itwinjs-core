/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { RectangleProps } from "../../utilities/Rectangle";

import Layout from "./layout/Layout";
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7, Layout8, Layout9 } from "./layout/Layouts";
import NineZone from "./NineZone";
import WidgetProps, { Widget, getDefaultProps as getDefaultWidgetProps } from "./Widget";
import Cell from "../../utilities/Cell";
import { Anchor } from "../../widget/Stacked";
import { TargetType } from "./Target";

export default interface ZoneProps {
  readonly id: number;
  readonly bounds: RectangleProps;
  readonly floatingBounds?: RectangleProps;
  readonly widgets: ReadonlyArray<WidgetProps>;
}

export const getDefaultProps = (id: number): ZoneProps => {
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
  };
};

export interface ZoneIdToWidget {
  zoneId: number;
  widget: Widget | undefined;
}

export namespace ZoneIdToWidget {
  export const sortAscending = (a: ZoneIdToWidget, b: ZoneIdToWidget): number => {
    return a.zoneId - b.zoneId;
  };
}

export class LayoutFactory {
  public create(zone: Zone): Layout {
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

export class Zone {
  protected _layout: Layout | undefined = undefined;
  protected _widgets: Widget[] | undefined = undefined;
  protected _cell: Cell | undefined = undefined;
  protected _isWidgetOpen: boolean | undefined = undefined;

  public constructor(public readonly nineZone: NineZone, public readonly props: ZoneProps) {
  }

  public getCell() {
    if (!this._cell)
      this._cell = new Cell(Math.floor((this.props.id - 1) / 3), (this.props.id - 1) % 3);
    return this._cell;
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
    return widgets.length > 1 && widgets[0].defaultZone.getCell().isColumnAlignedWith(widgets[1].defaultZone.getCell());
  }

  public get isMergedHorizontally(): boolean {
    const widgets = this.getWidgets();
    return widgets.length > 1 && widgets[0].defaultZone.getCell().isRowAlignedWith(widgets[1].defaultZone.getCell());
  }

  public get anchor(): Anchor {
    switch (this.props.id) {
      case 1:
      case 4:
        return Anchor.Left;
      case 7:
        return Anchor.BottomLeft;
      case 9:
        return Anchor.BottomRight;
      default:
        return Anchor.Right;
    }
  }

  public isFirstWidget(widget: Widget): boolean {
    if (this.props.widgets.length > 0 && this.props.widgets[0].id === widget.props.id)
      return true;
    return false;
  }

  public isLastWidget(widget: Widget): boolean {
    if (this.props.widgets.length > 0 && this.props.widgets[this.props.widgets.length - 1].id === widget.props.id)
      return true;
    return false;
  }

  public equals(other: Zone) {
    return this.props.id === other.props.id;
  }

  public getGhostOutlineBounds(): RectangleProps | undefined {
    const target = this.nineZone.target;
    if (!target)
      return undefined;

    const draggingWidget = this.nineZone.draggingWidget;
    const widgetId = target.props.widgetId;

    if (!draggingWidget)
      return undefined;

    const targetWidget = target.widget;
    const targetZone = targetWidget.zone;
    const draggingZone = draggingWidget.zone;

    switch (target.type) {
      case TargetType.Merge: {
        const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
        const mergedBounds = draggingZoneBounds.outerMergeWith(targetZone.props.bounds);
        if (widgetId === this.props.id)
          return mergedBounds;
        break;
      }
      case TargetType.Unmerge: {
        const widgets = Widget.sort(draggingZone.getWidgets());
        const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
        const isHorizontal = draggingZone.isMergedHorizontally;

        if (draggingZone.props.widgets.length > 2 && draggingZone.isLastWidget(targetWidget)) {
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
          const zoneToWidgetArray =
            (
              [
                ...widgets.map((widget) => ({
                  zoneId: widget.defaultZone.props.id,
                  widget,
                })),
                ...(Widget.isCellBetweenWidgets(new Cell(1, 1), widgets) ? [{
                  zoneId: 5,
                  widget: undefined,
                }] : []),
                ...(this.nineZone.props.isInFooterMode && Widget.isCellBetweenWidgets(new Cell(2, 1), widgets) ? [{
                  zoneId: 8,
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
