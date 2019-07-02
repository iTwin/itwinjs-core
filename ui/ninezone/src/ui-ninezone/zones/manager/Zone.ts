/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { Rectangle, RectangleProps } from "../../utilities/Rectangle";
import { Cell } from "../../utilities/Cell";
import { Layout1, Layout2, Layout3, Layout4, Layout6, Layout7, Layout8, Layout9, NineZoneRoot, WidgetZoneLayout } from "./layout/Layouts";
import { Root } from "./layout/Root";
import { NineZone, WidgetZoneIndex, ZoneIndex, StatusZoneIndex, ContentZoneIndex } from "./Zones";
import { Widget } from "./Widget";
import { TargetType } from "./Target";

/** @alpha */
export enum DropTarget {
  None,
  Merge,
  Back,
}

/** @alpha */
export interface ZoneManagerProps {
  readonly id: WidgetZoneIndex;
  readonly bounds: RectangleProps;
  readonly isLayoutChanged: boolean;
  readonly floating?: FloatingProps;
  readonly widgets: ReadonlyArray<WidgetZoneIndex>;
  readonly allowsMerging: boolean;
}

/** @alpha */
export interface FloatingZoneProps extends ZoneManagerProps {
  readonly floating: FloatingProps;
}

/** @alpha */
export interface FloatingProps {
  readonly bounds: RectangleProps;
  readonly stackId: number;
}

/** @alpha */
export interface StatusZoneManagerProps extends ZoneManagerProps {
  readonly id: StatusZoneIndex;
  readonly isInFooterMode: boolean;
}

/** @alpha */
export const isStatusZone = (zone: ZoneManagerProps): zone is StatusZoneManagerProps => {
  if (zone.id === 8)
    return true;
  return false;
};

const getDefaultAllowsMerging = (id: WidgetZoneIndex): boolean => {
  switch (id) {
    case 4:
    case 6:
    case 7:
    case 8:
    case 9:
      return true;
  }
  return false;
};

/** @alpha */
export const getDefaultZoneProps = (id: WidgetZoneIndex): ZoneManagerProps => {
  return {
    id,
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    isLayoutChanged: false,
    widgets: [id],
    allowsMerging: getDefaultAllowsMerging(id),
  };
};

/** @alpha */
export const getDefaultStatusZoneProps = (): StatusZoneManagerProps => {
  return {
    id: 8,
    isInFooterMode: true,
    isLayoutChanged: false,
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: Root.FOOTER_HEIGHT,
    },
    widgets: [8],
    allowsMerging: false,
  };
};

/** @alpha */
export interface ZoneIdToWidget {
  zoneId: ZoneIndex;
  widget: Widget | undefined;
}

/** @alpha */
export namespace ZoneIdToWidget {
  /** Sort function to sort ZoneIdToWidget array in ascending order.  */
  export const sortAscending = (a: ZoneIdToWidget, b: ZoneIdToWidget): number => {
    return a.zoneId - b.zoneId;
  };
}

/** @alpha */
export class LayoutFactory {
  public create(zone: WidgetZone, root: NineZoneRoot): WidgetZoneLayout {
    switch (zone.props.id) {
      case 1:
        return new Layout1({ zone, root });
      case 2:
        return new Layout2({ zone, root });
      case 3:
        return new Layout3({ zone, root });
      case 4:
        return new Layout4({ zone, root });
      case 6:
        return new Layout6({ zone, root });
      case 7:
        return new Layout7({ zone, root });
      case 8:
        return new Layout8({ zone, root });
      case 9:
        return new Layout9({ zone, root });
    }
    throw new RangeError();
  }
}

/** @alpha */
export class ZoneManagerHelper {
  private readonly _id: ZoneIndex;
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

  public equals(other: ZoneManagerHelper) {
    return this.id === other.id;
  }
}

/** @alpha */
export class WidgetZone extends ZoneManagerHelper {
  protected _layout: WidgetZoneLayout | undefined = undefined;
  protected _widgets: Widget[] | undefined = undefined;
  protected _widget: Widget | undefined = undefined;
  protected _cell: Cell | undefined = undefined;
  protected _isWidgetOpen: boolean | undefined = undefined;

  public constructor(public readonly nineZone: NineZone, public readonly props: ZoneManagerProps) {
    super(nineZone, props.id);
  }

  public get id(): WidgetZoneIndex {
    return this.props.id;
  }

  public get bounds() {
    return this.props.bounds;
  }

  public getLayout(): WidgetZoneLayout {
    if (!this._layout)
      this._layout = new LayoutFactory().create(this, this.nineZone.root);
    return this._layout;
  }

  public getWidgets(): ReadonlyArray<Widget> {
    if (!this._widgets) {
      this._widgets = [];
      for (const widgetId of this.props.widgets) {
        this._widgets.push(this.nineZone.getWidget(widgetId));
      }
    }
    return this._widgets;
  }

  public get isEmpty() {
    return this.props.widgets.length === 0;
  }

  public get hasSingleDefaultWidget() {
    return this.props.widgets.length === 1 && this.props.widgets[0] === this.id;
  }

  public get defaultWidget(): Widget {
    if (!this._widget)
      this._widget = this.nineZone.getWidget(this.id);
    return this._widget;
  }

  public get isWidgetOpen(): boolean {
    if (this._isWidgetOpen === undefined) {
      this._isWidgetOpen = false;
      for (const widgetId of this.props.widgets) {
        const widget = this.nineZone.props.widgets[widgetId];
        if (widget.tabIndex >= 0) {
          this._isWidgetOpen = true;
          break;
        }
      }
    }

    return this._isWidgetOpen;
  }

  public isFloating(): this is { props: FloatingZoneProps } {
    if (this.props.floating)
      return true;
    return false;
  }

  public canBeMergedTo(target: WidgetZone): boolean {
    if (!this.props.allowsMerging)
      return false;
    if (!target.props.allowsMerging)
      return false;
    if (this.equals(target))
      return false;

    const cellsBetween = this.cell.getAlignedCellsTo(target.cell);
    for (const cell of cellsBetween) {
      if (new Cell(1, 1).equals(cell))
        return false;
      const zoneBetween = this.nineZone.findZone(cell);
      if (!zoneBetween.props.allowsMerging)
        return false;
    }

    const widgets = this.getWidgets();
    const targetWidgets = target.getWidgets();
    const isMergedHorizontally = widgets.length > 1 && widgets[0].defaultZone.cell.isRowAlignedWith(widgets[1].defaultZone.cell);
    const isTargetMergedHorizontally = targetWidgets.length > 1 && targetWidgets[0].defaultZone.cell.isRowAlignedWith(targetWidgets[1].defaultZone.cell);
    if (this.cell.isRowAlignedWith(target.cell))
      if (isMergedHorizontally || this.props.widgets.length === 1)
        if (isTargetMergedHorizontally || target.props.widgets.length === 1)
          return true;

    const isMergedVertically = widgets.length > 1 && widgets[0].defaultZone.cell.isColumnAlignedWith(widgets[1].defaultZone.cell);
    const isTargetMergedVertically = targetWidgets.length > 1 && targetWidgets[0].defaultZone.cell.isColumnAlignedWith(targetWidgets[1].defaultZone.cell);
    if (this.cell.isColumnAlignedWith(target.cell))
      if (isMergedVertically || this.props.widgets.length === 1)
        if (isTargetMergedVertically || target.props.widgets.length === 1)
          return true;

    return false;
  }

  public getDropTarget(): DropTarget {
    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return DropTarget.None;

    const draggingZone = draggingWidget.zone;
    if (!this.props.allowsMerging)
      return DropTarget.None;

    if (draggingZone && draggingZone.equals(this))
      return DropTarget.Back;

    if (draggingZone && draggingZone.canBeMergedTo(this))
      return DropTarget.Merge;

    return DropTarget.None;
  }

  public getGhostOutlineBounds(): RectangleProps | undefined {
    const target = this.nineZone.target;
    if (!target)
      return undefined;

    const draggingWidget = this.nineZone.draggingWidget;

    if (!draggingWidget)
      return undefined;

    const draggingZone = draggingWidget.zone;
    if (!draggingZone)
      return undefined;
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
        const isHorizontal = widgets.length > 1 && widgets[0].defaultZone.cell.isRowAlignedWith(widgets[1].defaultZone.cell);

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

/** @alpha */
export class StatusZoneManagerHelper extends WidgetZone {
  public static readonly id: StatusZoneIndex = 8;
  public constructor(nineZone: NineZone, public readonly props: StatusZoneManagerProps) {
    super(nineZone, props);
  }

  public get id(): StatusZoneIndex {
    return this.props.id;
  }
}

/** @alpha */
export class ContentZone extends ZoneManagerHelper {
  public static readonly id: ContentZoneIndex = 5;

  public constructor(nineZone: NineZone) {
    super(nineZone, ContentZone.id);
  }

  public get id(): ContentZoneIndex {
    return super.id as ContentZoneIndex;
  }
}

/** @alpha */
export class ZoneManager {

}

/** @alpha */
export class StatusZoneManager {
  public setIsInFooterMode<TProps extends StatusZoneManagerProps>(isInFooterMode: boolean, props: TProps) {
    if (props.isInFooterMode === isInFooterMode)
      return props;
    return {
      ...props,
      allowsMerging: !isInFooterMode,
      isInFooterMode,
    };
  }
}
