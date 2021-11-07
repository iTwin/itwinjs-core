/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Zone
 */

import produce from "immer";
import { PointProps } from "@itwin/appui-abstract";
import { Point, Rectangle, RectangleProps } from "@itwin/core-react";
import { Cell, CellProps } from "../../utilities/Cell";
import { DisabledResizeHandles } from "../../utilities/DisabledResizeHandles";
import { HorizontalAnchor, ResizeHandle, VerticalAnchor } from "../../widget/Stacked";
import { BottomZones, LeftZones, RightZones, TopZones } from "./AdjacentZones";
import {
  GrowBottom, GrowLeft, GrowRight, GrowTop, ResizeStrategy, ShrinkBottom, ShrinkLeft, ShrinkRight, ShrinkTop, UpdateWindowResizeSettings,
} from "./ResizeStrategy";
import {
  DraggedWidgetManager, DraggedWidgetManagerProps, getDefaultToolSettingsWidgetManagerProps, getDefaultWidgetHorizontalAnchor,
  getDefaultWidgetManagerProps, getDefaultWidgetVerticalAnchor, ToolSettingsWidgetManagerProps, ToolSettingsWidgetMode, WidgetManagerProps,
} from "./Widget";
import { getDefaultZoneManagerProps, getWindowResizeSettings, ZoneManager, ZoneManagerProps } from "./Zone";
import { setRectangleProps } from "../../base/NineZoneState";

/** Widget zone id.
 *
 * ||&nbsp;&nbsp;&nbsp;&nbsp;||
 * |:--|:-:|:--|
 * |`1`|`2`|`3`|
 * |`4`| 5 |`6`|
 * |`7`|`8`|`9`|
 *
 * @beta
 */
export type WidgetZoneId = 1 | 2 | 3 | 4 | 6 | 7 | 8 | 9;

/** Content zone id.
 *
 * ||&nbsp;&nbsp;&nbsp;&nbsp;||
 * |:|:-:|:|
 * |1| 2 |3|
 * |4|`5`|6|
 * |7| 8 |9|
 *
 * @internal
 */
export type ContentZoneId = 5;

/** Zone id.
 *
 * ||&nbsp;&nbsp;&nbsp;&nbsp;||
 * |:--|:-:|:--|
 * |`1`|`2`|`3`|
 * |`4`|`5`|`6`|
 * |`7`|`8`|`9`|
 *
 * @internal
 */
export type ZoneId = WidgetZoneId | ContentZoneId;

/** Zones used in [[ZonesManagerProps]].
 * @beta
 */
export type ZonesManagerZonesProps = { readonly [id in WidgetZoneId]: ZoneManagerProps };

/** Widgets used in [[ZonesManagerProps]].
 * @beta
 */
export type ZonesManagerWidgetsProps =
  { readonly [id in Exclude<WidgetZoneId, 2>]: WidgetManagerProps } &
  { readonly [2]: ToolSettingsWidgetManagerProps };

/** Available zone targets.
 * @beta
 */
export enum ZoneTargetType {
  Back = 1,
  Merge,
}

/** Zone target used in [[ZonesManagerProps]].
 * @beta
 */
export interface ZonesManagerTargetProps {
  readonly zoneId: WidgetZoneId;
  readonly type: ZoneTargetType;
}

/** Properties used by [[ZonesManager]].
 * @beta
 */
export interface ZonesManagerProps {
  readonly draggedWidget?: DraggedWidgetManagerProps;
  readonly isInFooterMode: boolean;
  readonly target?: ZonesManagerTargetProps;
  readonly widgets: ZonesManagerWidgetsProps;
  readonly zones: ZonesManagerZonesProps;
  readonly zonesBounds: RectangleProps;
  readonly floatingZonesBounds?: RectangleProps;
}

/** Returns default [[ZonesManagerProps]] object.
 * @beta
 */
export const getDefaultZonesManagerProps = (): ZonesManagerProps => ({
  isInFooterMode: true,
  zones: getDefaultZonesManagerZonesProps(),
  widgets: getDefaultZonesManagerWidgetsProps(),
  zonesBounds: {
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },
});

/** Array of all widget zone Ids.
 * @beta
 */
export const widgetZoneIds: ReadonlyArray<WidgetZoneId> = [1, 2, 3, 4, 6, 7, 8, 9];

/** Returns default [[ZonesManagerZonesProps]] object.
 * @internal
 */
export const getDefaultZonesManagerZonesProps = (): ZonesManagerZonesProps => {
  return {
    1: getDefaultZoneManagerProps(1),
    2: getDefaultZoneManagerProps(2),
    3: getDefaultZoneManagerProps(3),
    4: getDefaultZoneManagerProps(4),
    6: getDefaultZoneManagerProps(6),
    7: getDefaultZoneManagerProps(7),
    8: getDefaultZoneManagerProps(8),
    9: getDefaultZoneManagerProps(9),
  };
};

/** Returns default [[ZonesManagerWidgetsProps]] object.
 * @internal
 */
export const getDefaultZonesManagerWidgetsProps = (): ZonesManagerWidgetsProps => {
  return {
    1: getDefaultWidgetManagerProps(1),
    2: getDefaultToolSettingsWidgetManagerProps(),
    3: getDefaultWidgetManagerProps(3),
    4: getDefaultWidgetManagerProps(4),
    6: getDefaultWidgetManagerProps(6),
    7: getDefaultWidgetManagerProps(7),
    8: getDefaultWidgetManagerProps(8),
    9: getDefaultWidgetManagerProps(9),
  };
};

/** @internal */
export const getZoneCell = (id: ZoneId) => new Cell(Math.floor((id - 1) / 3), (id - 1) % 3);

/** @internal */
export const getColumnZones = (id: WidgetZoneId) => {
  const cell = getZoneCell(id);
  const zones: WidgetZoneId[] = [];
  for (let i = 0; i < 3; i++) {
    if (cell.col === 1 && i === 1)
      continue;
    zones.push(getZoneIdFromCell({
      col: cell.col,
      row: i,
    }));
  }
  return zones;
};

/** @internal */
export const widgetZoneColumnIds: ReadonlyArray<WidgetZoneId> = [1, 2, 3];

/** @internal */
export const getZoneIdFromCell = (cell: CellProps): WidgetZoneId => {
  const id = cell.row * 3 + cell.col + 1;
  return id as WidgetZoneId;
};

/** Arguments used in [[ZonesManager.handleWidgetResize]].
 * @beta
 */
export interface ZonesManagerWidgetResizeArgs {
  readonly filledHeightDiff: number;
  readonly handle: ResizeHandle;
  readonly resizeBy: number;
  readonly zoneId: WidgetZoneId;
}

/** @internal */
export const getClosedWidgetTabIndex = (tabIndex: number) => {
  return tabIndex < 0 ? tabIndex : -1;
};

/** Class used to manage [[ZonesManagerProps]].
 * @beta
 */
export class ZonesManager {
  private _lastStackId = 1;
  private _zoneManagers?: Map<WidgetZoneId, ZoneManager>;
  private _draggedWidgetManager?: DraggedWidgetManager;

  /** @internal */
  public readonly growTop = new UpdateWindowResizeSettings(this, new GrowTop(this));
  /** @internal */
  public readonly shrinkTop = new UpdateWindowResizeSettings(this, new ShrinkTop(this));
  /** @internal */
  public readonly growBottom = new UpdateWindowResizeSettings(this, new GrowBottom(this));
  /** @internal */
  public readonly shrinkBottom = new UpdateWindowResizeSettings(this, new ShrinkBottom(this));
  /** @internal */
  public readonly growLeft = new UpdateWindowResizeSettings(this, new GrowLeft(this));
  /** @internal */
  public readonly shrinkLeft = new UpdateWindowResizeSettings(this, new ShrinkLeft(this));
  /** @internal */
  public readonly growRight = new UpdateWindowResizeSettings(this, new GrowRight(this));
  /** @internal */
  public readonly shrinkRight = new UpdateWindowResizeSettings(this, new ShrinkRight(this));
  /** @internal */
  public readonly leftZones = new LeftZones(this);
  /** @internal */
  public readonly topZones = new TopZones(this);
  /** @internal */
  public readonly rightZones = new RightZones(this);
  /** @internal */
  public readonly bottomZones = new BottomZones(this);

  public handleWidgetResize({ filledHeightDiff, handle, zoneId, resizeBy }: ZonesManagerWidgetResizeArgs, props: ZonesManagerProps): ZonesManagerProps {
    const zone = props.zones[zoneId];
    const zoneBounds = Rectangle.create(zone.bounds);
    const bounds = zoneBounds.setHeight(zoneBounds.getHeight() - filledHeightDiff).toProps();
    const filledProps = this.setZoneBounds(zoneId, bounds, props);

    let resizedProps;
    const resizeStrategy = this.getResizeStrategy(handle, resizeBy);
    if (zone.floating)
      resizedProps = resizeStrategy.tryResizeFloating(zoneId, Math.abs(resizeBy), filledProps);
    else
      resizedProps = resizeStrategy.tryResize(zoneId, Math.abs(resizeBy), filledProps);

    if (resizedProps === filledProps)
      return props;

    return this.setZoneIsLayoutChanged(zoneId, true, resizedProps);
  }

  public handleWidgetTabClick(widgetId: WidgetZoneId, tabIndex: number, props: ZonesManagerProps): ZonesManagerProps {
    const zone = this.findZoneWithWidget(widgetId, props);
    if (!zone)
      return props;

    const widget = props.widgets[widgetId];
    const closeWidget = tabIndex === widget.tabIndex;
    if (closeWidget && zone.floating)
      return props;

    for (const wId of zone.widgets) {
      const w = props.widgets[wId];
      const newTabIndex = wId === widgetId && !closeWidget ? tabIndex : getClosedWidgetTabIndex(w.tabIndex);
      props = this.setWidgetTabIndex(wId, newTabIndex, props);
    }

    return props;
  }

  public handleWidgetTabDragStart(widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps, props: ZonesManagerProps): ZonesManagerProps {
    const zone = this.findZoneWithWidget(widgetId, props);
    if (!zone)
      return props;
    if (!this.isWidgetOpen(zone.id, props))
      return props;

    if (!zone.allowsMerging)
      return props;

    const zonesBounds = Rectangle.create(props.zonesBounds);
    const unmergeBounds = this.getUnmergeWidgetBounds(zone.id, props);
    const floatingBounds = Rectangle.create(widgetBounds).offset({ x: -zonesBounds.left, y: -zonesBounds.top });

    const isUnmerge = zone.widgets.length > 1;

    let newProps = {
      ...props,
      zones: Object.keys(props.zones).reduce((acc, key) => {
        const id = Number(key) as WidgetZoneId;
        const mergedZone = unmergeBounds.find((z) => z.id === id);
        if (!mergedZone)
          return acc;
        return {
          ...acc,
          [id]: {
            ...acc[id],
            ...widgetId === id ? {
              floating: {
                bounds: {
                  bottom: floatingBounds.bottom,
                  left: floatingBounds.left,
                  right: floatingBounds.right,
                  top: floatingBounds.top,
                },
                stackId: this._lastStackId++,
              },
            } : undefined,
            bounds: mergedZone.bounds,
            widgets: [id],
          },
        };
      }, props.zones),
      draggedWidget: {
        id: widgetId,
        tabIndex,
        lastPosition: {
          x: initialPosition.x,
          y: initialPosition.y,
        },
        isUnmerge,
      },
    };

    // Open widget tab if drag started by dragging closed merged widget
    const widget = props.widgets[widgetId];
    if (widget.tabIndex < 0) {
      newProps = this.setWidgetTabIndex(widgetId, tabIndex, newProps);
    }

    // Open home widget if it is not open
    const homeWidget = props.widgets[zone.id];
    if (homeWidget.tabIndex < 0) {
      newProps = this.setWidgetTabIndex(zone.id, 0, newProps);
    }

    for (const ub of unmergeBounds) {
      this.saveWindowSettings(ub.id, newProps);
      if (ub.id === widgetId)
        continue;
      const anchor = getDefaultWidgetHorizontalAnchor(ub.id);
      newProps = this.setWidgetHorizontalAnchor(ub.id, anchor, newProps);
    }

    return newProps;
  }

  public handleWidgetTabDrag(dragged: PointProps, props: ZonesManagerProps): ZonesManagerProps {
    const draggedWidget = props.draggedWidget;
    if (!draggedWidget)
      return props;

    const draggedZone = this.findZoneWithWidget(draggedWidget.id, props);
    if (!draggedZone || !draggedZone.floating)
      return props;

    const floatingBounds = Rectangle.create(draggedZone.floating.bounds).offset(dragged).toProps();
    const lastPosition = Point.create(draggedWidget.lastPosition).offset(dragged).toProps();
    props = this.setZoneFloatingBounds(draggedZone.id, floatingBounds, props);
    return this.setDraggedWidgetLastPosition(lastPosition, props);
  }

  public handleWidgetTabDragEnd(props: ZonesManagerProps): ZonesManagerProps {
    const draggedWidget = props.draggedWidget;
    if (!draggedWidget)
      return props;

    const draggedZone = this.findZoneWithWidget(draggedWidget.id, props);
    if (!props.target) {
      if (draggedZone && draggedZone.floating && props.floatingZonesBounds) {
        const bounds = Rectangle.create(draggedZone.floating.bounds);
        const contained = bounds.containIn(props.floatingZonesBounds);
        props = this.setZoneFloatingBounds(draggedZone.id, contained.toProps(), props);
      }
      return {
        ...props,
        draggedWidget: undefined,
      };
    }

    if (!draggedZone)
      return props;
    switch (props.target.type) {
      case ZoneTargetType.Merge: {
        const targetZone = props.zones[props.target.zoneId];
        const bounds = Rectangle.create(draggedZone.bounds).outerMergeWith(targetZone.bounds);
        const targetZoneCell = getZoneCell(targetZone.id);
        const contentZoneCell = getZoneCell(5);
        const draggedZoneCell = getZoneCell(draggedZone.id);
        const alignedCells = [
          targetZoneCell,
          ...targetZoneCell.getAlignedCellsTo(draggedZoneCell),
          draggedZoneCell,
        ];
        const statusZoneCell = getZoneCell(8);
        const alignedCellsFiltered = alignedCells.filter((cell) => {
          if (contentZoneCell.equals(cell))
            return false;
          if (props.isInFooterMode && statusZoneCell.equals(cell))
            return false;
          return true;
        });
        const alignedZones = alignedCellsFiltered.map((cell) => {
          const zoneId = getZoneIdFromCell(cell);
          return props.zones[zoneId];
        });
        const zoneWidgets = alignedZones.map((z) => z.widgets);
        const widgets = ([] as WidgetZoneId[]).concat(...zoneWidgets);

        let newProps = {
          ...props,
          draggedWidget: undefined,
          zones: alignedZones.reduce((acc, zone) => {
            if (zone.id === targetZone.id)
              return {
                ...acc,
                [zone.id]: {
                  ...acc[zone.id],
                  bounds,
                  floating: undefined,
                  widgets,
                },
              };
            return {
              ...acc,
              [zone.id]: {
                ...props.zones[zone.id],
                floating: undefined, // dragging zone is merged and should not float anymore
                widgets: [], // dragging zone is merged and should contain no widgets
              },
            };
          }, props.zones),
        };

        for (const widget of widgets) {
          const horizontalAnchor = getDefaultWidgetHorizontalAnchor(draggedZone.id);
          newProps = this.setWidgetHorizontalAnchor(widget, horizontalAnchor, newProps);
          const verticalAnchor = getDefaultWidgetVerticalAnchor(draggedZone.id);
          newProps = this.setWidgetVerticalAnchor(widget, verticalAnchor, newProps);

          if (widget === draggedWidget.id)
            continue;
          newProps = this.setWidgetTabIndex(widget, -1, newProps);
        }

        this.saveWindowSettings(targetZone.id, newProps);
        return newProps;
      }
      case ZoneTargetType.Back: {
        let newProps = {
          ...props,
          zones: {
            ...props.zones,
            [draggedZone.id]: {
              ...props.zones[draggedZone.id],
              floating: undefined,
              anchor: undefined,
            },
          },
          draggedWidget: undefined,
        };
        const horizontalAnchor = getDefaultWidgetHorizontalAnchor(draggedZone.id);
        newProps = this.setWidgetHorizontalAnchor(draggedZone.id, horizontalAnchor, newProps);
        const verticalAnchor = getDefaultWidgetVerticalAnchor(draggedZone.id);
        newProps = this.setWidgetVerticalAnchor(draggedZone.id, verticalAnchor, newProps);
        if (draggedZone.id === 2)
          newProps = this.setToolSettingsWidgetMode(ToolSettingsWidgetMode.TitleBar, newProps);
        return newProps;
      }
    }
  }

  public handleTargetChanged(target: ZonesManagerTargetProps | undefined, props: ZonesManagerProps): ZonesManagerProps {
    if (props.target === target)
      return props;
    if (!target)
      return {
        ...props,
        target: undefined,
      };

    if (props.target && target.zoneId === props.target.zoneId && target.type === props.target.type) {
      return props;
    }

    return {
      ...props,
      target: {
        zoneId: target.zoneId,
        type: target.type,
      },
    };
  }

  public setFloatingZonesBounds(bounds: RectangleProps | undefined, props: ZonesManagerProps): ZonesManagerProps {
    props = produce(props, (draft) => {
      if (draft.floatingZonesBounds) {
        if (!bounds)
          draft.floatingZonesBounds = undefined;
        else {
          setRectangleProps(draft.floatingZonesBounds, bounds);
        }
      } else {
        draft.floatingZonesBounds = bounds && Rectangle.create(bounds).toProps();
      }
    });
    const draggedZone = props.draggedWidget && this.findZoneWithWidget(props.draggedWidget.id, props);
    for (const zId of widgetZoneIds) {
      const zone = props.zones[zId];
      const floating = zone.floating;
      if (draggedZone?.id === zId)
        continue;
      if (!floating)
        continue;
      if (!props.floatingZonesBounds)
        continue;

      const floatingBounds = Rectangle.create(floating.bounds).containIn(props.floatingZonesBounds);
      props = this.setZoneFloatingBounds(zId, floatingBounds.toProps(), props);
    }

    return props;
  }

  public setZonesBounds(zonesBounds: RectangleProps, props: ZonesManagerProps): ZonesManagerProps {
    const newBounds = Rectangle.create(zonesBounds);
    if (newBounds.equals(props.zonesBounds))
      return props;

    const offset = newBounds.topLeft().getOffsetTo(Rectangle.create(props.zonesBounds).topLeft());
    props = {
      ...props,
      zonesBounds,
    };

    const resizeBounds = this.getWindowResizeBounds(props);
    for (const zId of widgetZoneIds) {
      props = this.setZoneBounds(zId, resizeBounds[zId], props);

      const zone = props.zones[zId];
      const floating = zone.floating;
      if (!floating)
        continue;

      const floatingBounds = Rectangle.create(floating.bounds).offset(offset);
      props = this.setZoneFloatingBounds(zId, floatingBounds.toProps(), props);
    }

    return props;
  }

  public restoreLayout(props: ZonesManagerProps): ZonesManagerProps {
    for (const zId of widgetZoneIds) {
      const bounds = this.getInitialBounds(zId, props);
      props = this.setZoneBounds(zId, bounds, props);
      props = this.setZoneIsLayoutChanged(zId, false, props);

      const manager = this.getZoneManager(zId);
      manager.windowResize = getWindowResizeSettings(zId);
    }
    return props;
  }

  public getInitialBounds(zoneId: WidgetZoneId, props: ZonesManagerProps): RectangleProps {
    const zonesBounds = Rectangle.create(props.zonesBounds);
    const rootBounds = Rectangle.createFromSize(zonesBounds.getSize());
    if (zoneId === 8 && props.isInFooterMode) {
      return new Rectangle(rootBounds.left, rootBounds.bottom, rootBounds.right, rootBounds.bottom);
    }

    const rootSize = rootBounds.getSize();
    const cell = getZoneCell(zoneId);
    const left = rootBounds.left + rootSize.width * cell.col / 3;
    const right = rootBounds.left + rootSize.width * (cell.col + 1) / 3;
    const top = rootBounds.top + rootSize.height * cell.row / 3;
    const bottom = rootBounds.top + rootSize.height * (cell.row + 1) / 3;
    const zoneBounds = new Rectangle(left, top, right, bottom);

    const zone = props.zones[zoneId];
    if (zone.widgets.length === 1 && zone.widgets[0] === zone.id)
      return zoneBounds;

    const mergedBounds = zone.widgets.reduce<Rectangle>((acc, wId) => {
      if (zoneId === wId)
        return acc;

      const bounds = this.getInitialBounds(wId, props);
      return acc.outerMergeWith(bounds);
    }, zoneBounds);
    return mergedBounds.toProps();
  }

  public setIsInFooterMode(isInFooterMode: boolean, props: ZonesManagerProps): ZonesManagerProps {
    if (isInFooterMode === props.isInFooterMode)
      return props;

    return {
      ...props,
      isInFooterMode,
    };
  }

  public setAllowsMerging(zoneId: WidgetZoneId, allowsMerging: boolean, props: ZonesManagerProps): ZonesManagerProps {
    const zone = props.zones[zoneId];
    const manager = this.getZoneManager(zoneId);
    const zoneProps = manager.setAllowsMerging(allowsMerging, zone);
    return this.setZoneProps(zoneProps, props);
  }

  public mergeZone(zoneId: WidgetZoneId, targetZoneId: WidgetZoneId, props: ZonesManagerProps): ZonesManagerProps {
    if (!this.canBeMergedTo(zoneId, targetZoneId, props))
      return props;
    const managerSettings = this.getZoneManager(zoneId).windowResize;
    const targetSettings = this.getZoneManager(targetZoneId).windowResize;
    targetSettings.vStart = Math.min(managerSettings.vStart, targetSettings.vStart);
    targetSettings.vEnd = Math.max(managerSettings.vEnd, targetSettings.vEnd);
    targetSettings.hStart = Math.min(managerSettings.hStart, targetSettings.hStart);
    targetSettings.hEnd = Math.max(managerSettings.hEnd, targetSettings.hEnd);

    const zone = props.zones[zoneId];
    const targetZone = props.zones[targetZoneId];
    const bounds = Rectangle.create(zone.bounds).outerMergeWith(targetZone.bounds).toProps();
    return {
      ...props,
      zones: {
        ...props.zones,
        [zoneId]: {
          ...props.zones[zoneId],
          widgets: [],
        },
        [targetZoneId]: {
          ...props.zones[targetZoneId],
          bounds,
          widgets: [
            ...props.zones[targetZoneId].widgets,
            zoneId,
          ],
        },
      },
    };
  }

  public findZoneWithWidget(widgetId: WidgetZoneId, props: ZonesManagerProps) {
    const zoneId = this.findZoneIdWithWidget(widgetId, props);
    return zoneId === undefined ? undefined : props.zones[zoneId];
  }

  public getGhostOutlineBounds(zoneId: WidgetZoneId, props: ZonesManagerProps): RectangleProps | undefined {
    const target = props.target;
    if (!target)
      return undefined;

    if (target.zoneId !== zoneId)
      return undefined;

    const draggedWidget = props.draggedWidget;
    if (!draggedWidget)
      return undefined;

    const draggedZone = this.findZoneWithWidget(draggedWidget.id, props);
    if (!draggedZone)
      return undefined;
    const targetZone = props.zones[target.zoneId];
    switch (target.type) {
      case ZoneTargetType.Merge: {
        const draggedZoneBounds = Rectangle.create(draggedZone.bounds);
        const mergedBounds = draggedZoneBounds.outerMergeWith(targetZone.bounds);
        return mergedBounds;
      }
      case ZoneTargetType.Back: {
        return draggedZone.bounds;
      }
    }
  }

  public getDisabledResizeHandles(zoneId: WidgetZoneId, props: ZonesManagerProps): DisabledResizeHandles {
    const zone = props.zones[zoneId];
    if (zone.floating)
      return DisabledResizeHandles.None;

    let disabledResizeHandles = DisabledResizeHandles.None;
    if (this.growTop.getMaxResize(zoneId, props) <= 0 && this.shrinkTop.getMaxResize(zoneId, props) <= 0)
      disabledResizeHandles |= DisabledResizeHandles.Top;
    if (this.growBottom.getMaxResize(zoneId, props) <= 0 && this.shrinkBottom.getMaxResize(zoneId, props) <= 0)
      disabledResizeHandles |= DisabledResizeHandles.Bottom;
    if (this.growLeft.getMaxResize(zoneId, props) <= 0 && this.shrinkLeft.getMaxResize(zoneId, props) <= 0)
      disabledResizeHandles |= DisabledResizeHandles.Left;
    if (this.growRight.getMaxResize(zoneId, props) <= 0 && this.shrinkRight.getMaxResize(zoneId, props) <= 0)
      disabledResizeHandles |= DisabledResizeHandles.Right;
    return disabledResizeHandles;
  }

  public getDropTarget(zoneId: WidgetZoneId, props: ZonesManagerProps): ZoneTargetType | undefined {
    const draggedWidget = props.draggedWidget;
    if (!draggedWidget)
      return undefined;

    const zone = props.zones[zoneId];
    if (!zone.allowsMerging)
      return undefined;

    const draggedZone = this.findZoneWithWidget(draggedWidget.id, props);
    if (!draggedZone)
      return undefined;

    if (draggedZone.id === zoneId)
      return ZoneTargetType.Back;

    if (this.canBeMergedTo(draggedZone.id, zoneId, props))
      return ZoneTargetType.Merge;

    return undefined;
  }

  public setZoneWidth(zoneId: WidgetZoneId, width: number, props: ZonesManagerProps) {
    const manager = this.getZoneManager(zoneId);
    const minWidth = manager.windowResize.minWidth;
    const initialBounds = Rectangle.create(this.getInitialBounds(zoneId, props));
    const maxWidth = initialBounds.getWidth();
    width = Math.min(Math.max(width, minWidth), maxWidth);

    const zone = props.zones[zoneId];
    let bounds = Rectangle.create(zone.bounds);
    bounds = bounds.setWidth(width);
    if ((zoneId === 3) || (zoneId === 6) || (zoneId === 9)) {
      const offset = zone.bounds.right - bounds.right;
      bounds = bounds.offsetX(offset);
    }
    props = this.setZoneBounds(zoneId, bounds, props);
    this.saveWindowSettings(zoneId, props);
    return props;
  }

  /** @internal */
  public getZoneManager(id: WidgetZoneId): ZoneManager {
    if (!this._zoneManagers)
      this._zoneManagers = new Map();
    let manager = this._zoneManagers.get(id);
    if (!manager) {
      manager = new ZoneManager(getWindowResizeSettings(id));
      this._zoneManagers.set(id, manager);
    }
    return manager;
  }

  /** @internal */
  public get draggedWidgetManager(): DraggedWidgetManager {
    if (!this._draggedWidgetManager)
      this._draggedWidgetManager = new DraggedWidgetManager();
    return this._draggedWidgetManager;
  }

  /** @internal */
  public getResizeStrategy(handle: ResizeHandle, resizeBy: number): ResizeStrategy {
    switch (handle) {
      case ResizeHandle.Top: {
        if (resizeBy < 0)
          return this.growTop;
        return this.shrinkTop;
      }
      case ResizeHandle.Bottom: {
        if (resizeBy > 0)
          return this.growBottom;
        return this.shrinkBottom;
      }
      case ResizeHandle.Left: {
        if (resizeBy < 0)
          return this.growLeft;
        return this.shrinkLeft;
      }
      case ResizeHandle.Right: {
        if (resizeBy > 0)
          return this.growRight;
        return this.shrinkRight;
      }
    }
  }

  /** @internal */
  public getWindowResizeBounds(props: ZonesManagerProps): { [id in WidgetZoneId]: RectangleProps } {
    let resizeBounds: { [id in WidgetZoneId]: RectangleProps } = {
      1: props.zones[1].bounds,
      2: props.zones[2].bounds,
      3: props.zones[3].bounds,
      4: props.zones[4].bounds,
      6: props.zones[6].bounds,
      7: props.zones[7].bounds,
      8: props.zones[8].bounds,
      9: props.zones[9].bounds,
    };

    const zonesBounds = Rectangle.create(props.zonesBounds);
    const zonesWidth = zonesBounds.getWidth();
    resizeBounds = widgetZoneIds.reduce((acc, zoneId) => {
      const manager = this.getZoneManager(zoneId);
      const initialBounds = Rectangle.create(this.getInitialBounds(zoneId, props));
      const initialWidth = initialBounds.getWidth();
      const minWidth = Math.min(initialWidth, manager.windowResize.minWidth);

      let width = minWidth;
      switch (manager.windowResize.hMode) {
        case "Minimum": {
          width = minWidth;
          break;
        }
        case "Percentage": {
          const left = zonesWidth * manager.windowResize.hStart;
          const right = zonesWidth * manager.windowResize.hEnd;
          width = Math.max(minWidth, right - left);
          break;
        }
      }

      let bounds = initialBounds;
      const horizontalAnchor = getDefaultWidgetHorizontalAnchor(zoneId);
      switch (horizontalAnchor) {
        case HorizontalAnchor.Left: {
          bounds = bounds.setWidth(width);
          break;
        }
        case HorizontalAnchor.Right: {
          const offsetX = Math.max(initialWidth - width, 0);
          bounds = bounds.setWidth(width);
          bounds = bounds.offsetX(offsetX);
          break;
        }
      }
      acc = {
        ...acc,
        [zoneId]: bounds,
      };
      return acc;
    }, resizeBounds);

    const zonesBoundsHeight = zonesBounds.getHeight();

    for (const columnZoneId of widgetZoneColumnIds) {
      let zones = getColumnZones(columnZoneId);
      zones = zones.filter((zoneId) => {
        const zone = props.zones[zoneId];
        return zone.widgets.length !== 0;
      });

      const minZoneHeights = zones.map((zoneId) => {
        const manager = this.getZoneManager(zoneId);
        return manager.windowResize.minHeight;
      });
      const totalMinZonesHeight = minZoneHeights.reduce((acc, h) => acc + h, 0);

      const zoneHeights = zones.map((zoneId) => {
        const manager = this.getZoneManager(zoneId);
        const top = manager.windowResize.vStart * zonesBoundsHeight;
        const bottom = manager.windowResize.vEnd * zonesBoundsHeight;
        let zoneHeight = bottom - top;
        const minHeight = manager.windowResize.minHeight;
        if (manager.windowResize.vMode === "Minimum")
          zoneHeight = minHeight;
        const height = Math.max(zoneHeight, minHeight);
        return height;
      });
      const totalZonesHeight = zoneHeights.reduce((acc, h) => acc + h, 0);

      // Spacing ratio to top zone.
      const zoneSpacingRatios = zones.map((zoneId, index) => {
        const manager = this.getZoneManager(zoneId);
        if (index === 0)
          return manager.windowResize.vStart;

        const to = manager.windowResize.vStart;
        const topZoneId = zones[index - 1];
        const topManager = this.getZoneManager(topZoneId);
        const from = topManager.windowResize.vEnd;
        return to - from;
      });
      const lastZoneId = zones[zones.length - 1];
      const lastZoneManager = this.getZoneManager(lastZoneId);
      const lastZoneBottomSpacing = 1 - lastZoneManager.windowResize.vEnd;
      const totalZoneSpacingRatios = zoneSpacingRatios.reduce((acc, zoneSpacingRatio) => acc + zoneSpacingRatio, 0) + lastZoneBottomSpacing;

      // Fallback to initial layout when not enough space.
      if (zonesBoundsHeight < totalMinZonesHeight)
        return resizeBounds;

      // Shrink some zones (expect those that are already at minimum height)
      const shrinkZonesBy = Math.max(totalZonesHeight - zonesBoundsHeight, 0);
      const availableShrinkBy = zones.map((_, index) => {
        const height = zoneHeights[index];
        const minHeight = minZoneHeights[index];
        return height - minHeight;
      });
      const totalAvailableShrinkBy = availableShrinkBy.reduce((acc, shrinkBy) => acc + shrinkBy, 0);

      const totalSpacing = Math.max(zonesBoundsHeight - totalZonesHeight, 0);
      let lastBottom = 0;
      for (let i = 0; i < zones.length; i++) {
        const zoneId = zones[i];
        const zoneHeight = zoneHeights[i];
        const spacing = totalZoneSpacingRatios > 0 ? zoneSpacingRatios[i] / totalZoneSpacingRatios : 0;
        const offset = spacing * totalSpacing;
        const top = lastBottom + offset;

        const shrinkBy = totalAvailableShrinkBy > 0 ? availableShrinkBy[i] * shrinkZonesBy / totalAvailableShrinkBy : 0;
        const bottom = top + zoneHeight - shrinkBy;
        lastBottom = bottom;
        resizeBounds = {
          ...resizeBounds,
          [zoneId]: {
            ...resizeBounds[zoneId],
            top,
            bottom,
          },
        };
      }
    }

    return resizeBounds;
  }

  /** @internal */
  public canBeMergedTo(zoneId: WidgetZoneId, targetZoneId: WidgetZoneId, props: ZonesManagerProps): boolean {
    if (zoneId === targetZoneId)
      return false;
    if (props.isInFooterMode && (zoneId === 8 || targetZoneId === 8))
      return false;

    const zone = props.zones[zoneId];
    const target = props.zones[targetZoneId];
    if (!zone.allowsMerging || !target.allowsMerging)
      return false;

    const zoneCell = getZoneCell(zoneId);
    const targetCell = getZoneCell(targetZoneId);
    const cellsBetween = zoneCell.getAlignedCellsTo(targetCell);
    for (const cell of cellsBetween) {
      if (getZoneCell(5).equals(cell))
        return false;
      if (props.isInFooterMode && getZoneCell(8).equals(cell))
        return false;
      const zoneBetweenId = getZoneIdFromCell(cell);
      const zoneBetween = props.zones[zoneBetweenId];
      if (!zoneBetween.allowsMerging)
        return false;
    }

    const isMergedHorizontally = this.isMergedHorizontally(zoneId, props);
    const isTargetMergedHorizontally = this.isMergedHorizontally(targetZoneId, props);
    if (zoneCell.isRowAlignedWith(targetCell) &&
      (isMergedHorizontally || zone.widgets.length === 1) &&
      (isTargetMergedHorizontally || target.widgets.length === 1)) {
      return true;
    }

    const isMergedVertically = this.isMergedVertically(zoneId, props);
    const isTargetMergedVertically = this.isMergedVertically(targetZoneId, props);
    if (zoneCell.isColumnAlignedWith(targetCell) &&
      (isMergedVertically || zone.widgets.length === 1) &&
      (isTargetMergedVertically || target.widgets.length === 1)) {
      return true;
    }

    return false;
  }

  /** @internal */
  public addWidget(zoneId: WidgetZoneId, widgetId: WidgetZoneId, props: ZonesManagerProps): ZonesManagerProps {
    const widgetIndex = props.zones[zoneId].widgets.indexOf(widgetId);
    if (widgetIndex >= 0)
      return props;

    return {
      ...props,
      zones: {
        ...props.zones,
        [zoneId]: {
          ...props.zones[zoneId],
          widgets: [
            ...props.zones[zoneId].widgets,
            widgetId,
          ],
        },
      },
    };
  }

  /** @internal */
  public removeWidget(zoneId: WidgetZoneId, widgetId: WidgetZoneId, props: ZonesManagerProps): ZonesManagerProps {
    const widgetIndex = props.zones[zoneId].widgets.indexOf(widgetId);
    if (widgetIndex < 0)
      return props;

    return {
      ...props,
      zones: {
        ...props.zones,
        [zoneId]: {
          ...props.zones[zoneId],
          widgets: [
            ...props.zones[zoneId].widgets.slice(0, widgetIndex),
            ...props.zones[zoneId].widgets.slice(widgetIndex + 1),
          ],
        },
      },
    };
  }

  /** @internal */
  public isWidgetOpen(zoneId: WidgetZoneId, props: ZonesManagerProps) {
    const zone = props.zones[zoneId];
    return zone.widgets.some((widgetId) => {
      const widget = props.widgets[widgetId];
      return widget.tabIndex >= 0;
    });
  }

  /** @internal */
  private findZoneIdWithWidget(widgetId: WidgetZoneId, props: ZonesManagerProps): WidgetZoneId | undefined {
    for (const zoneId of widgetZoneIds) {
      const zone = props.zones[zoneId];
      if (zone.widgets.some((w) => w === widgetId))
        return zoneId;
    }
    return undefined;
  }

  /** @internal */
  public getUnmergeWidgetBounds(zoneId: WidgetZoneId, props: ZonesManagerProps): Array<{ id: WidgetZoneId, bounds: RectangleProps }> {
    const zone = props.zones[zoneId];
    const sortedWidgets = zone.widgets.slice().sort((a, b) => a - b);
    const mergedZones = sortedWidgets.map((w) => props.zones[w]);
    const zoneBounds = Rectangle.create(zone.bounds);
    const isMergedHorizontally = this.isMergedHorizontally(zoneId, props);
    const isMergedVertically = this.isMergedVertically(zoneId, props);

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
      id: zoneId,
      bounds: zone.bounds,
    }];
  }

  /** @internal */
  public isMergedVertically(zoneId: WidgetZoneId, props: ZonesManagerProps): boolean {
    const zone = props.zones[zoneId];
    if (zone.widgets.length < 2)
      return false;

    const cell0 = getZoneCell(zone.widgets[0]);
    const cell1 = getZoneCell(zone.widgets[1]);
    return cell0.isColumnAlignedWith(cell1);
  }

  /** @internal */
  public isMergedHorizontally(zoneId: WidgetZoneId, props: ZonesManagerProps): boolean {
    const zone = props.zones[zoneId];
    if (zone.widgets.length < 2)
      return false;

    const cell0 = getZoneCell(zone.widgets[0]);
    const cell1 = getZoneCell(zone.widgets[1]);
    return cell0.isRowAlignedWith(cell1);
  }

  /** @internal */
  public isResizable(zoneId: WidgetZoneId): boolean {
    if (zoneId === 1 || zoneId === 2 || zoneId === 3)
      return false;
    return true;
  }

  /** @internal */
  public setWidgetTabIndex<TProps extends ZonesManagerProps>(widgetId: WidgetZoneId, tabIndex: number, props: TProps): TProps {
    if (props.widgets[widgetId].tabIndex === tabIndex)
      return props;
    return {
      ...props,
      widgets: {
        ...props.widgets,
        [widgetId]: {
          ...props.widgets[widgetId],
          tabIndex,
        },
      },
    };
  }

  /** @internal */
  public setWidgetHorizontalAnchor<TProps extends ZonesManagerProps>(widgetId: WidgetZoneId, horizontalAnchor: HorizontalAnchor, props: TProps): TProps {
    if (props.widgets[widgetId].horizontalAnchor === horizontalAnchor)
      return props;
    return {
      ...props,
      widgets: {
        ...props.widgets,
        [widgetId]: {
          ...props.widgets[widgetId],
          horizontalAnchor,
        },
      },
    };
  }

  /** @internal */
  public setWidgetVerticalAnchor<TProps extends ZonesManagerProps>(widgetId: WidgetZoneId, verticalAnchor: VerticalAnchor, props: TProps): TProps {
    if (props.widgets[widgetId].verticalAnchor === verticalAnchor)
      return props;
    return {
      ...props,
      widgets: {
        ...props.widgets,
        [widgetId]: {
          ...props.widgets[widgetId],
          verticalAnchor,
        },
      },
    };
  }

  /** @internal */
  public setToolSettingsWidgetMode<TProps extends ZonesManagerProps>(mode: ToolSettingsWidgetMode, props: TProps): TProps {
    if (props.widgets[2].mode === mode)
      return props;
    return {
      ...props,
      widgets: {
        ...props.widgets,
        2: {
          ...props.widgets[2],
          mode,
        },
      },
    };
  }

  /** @internal */
  public setZoneProps(zoneProps: ZoneManagerProps, props: ZonesManagerProps) {
    if (props.zones[zoneProps.id] === zoneProps)
      return props;
    return {
      ...props,
      zones: {
        ...props.zones,
        [zoneProps.id]: zoneProps,
      },
    };
  }

  /** @internal */
  public setDraggedWidgetProps(draggedWidget: DraggedWidgetManagerProps | undefined, props: ZonesManagerProps) {
    if (props.draggedWidget === draggedWidget)
      return props;
    return {
      ...props,
      draggedWidget,
    };
  }

  /** @internal */
  public setDraggedWidgetLastPosition(lastPosition: PointProps, props: ZonesManagerProps) {
    if (!props.draggedWidget)
      throw new ReferenceError();
    const draggedWidget = this.draggedWidgetManager.setLastPosition(lastPosition, props.draggedWidget);
    return this.setDraggedWidgetProps(draggedWidget, props);
  }

  /** @internal */
  public setZoneFloatingBounds(zoneId: WidgetZoneId, bounds: RectangleProps, props: ZonesManagerProps) {
    const zone = props.zones[zoneId];
    const manager = this.getZoneManager(zoneId);
    const zoneProps = manager.setFloatingBounds(bounds, zone);
    return this.setZoneProps(zoneProps, props);
  }

  /** @internal */
  public setZoneBounds(zoneId: WidgetZoneId, bounds: RectangleProps, props: ZonesManagerProps) {
    const zone = props.zones[zoneId];
    const manager = this.getZoneManager(zoneId);
    const zoneProps = manager.setBounds(bounds, zone);
    return this.setZoneProps(zoneProps, props);
  }

  /** @internal */
  public setZoneIsLayoutChanged(zoneId: WidgetZoneId, isLayoutChanged: boolean, props: ZonesManagerProps) {
    const zone = props.zones[zoneId];
    const manager = this.getZoneManager(zoneId);
    const zoneProps = manager.setIsLayoutChanged(isLayoutChanged, zone);
    return this.setZoneProps(zoneProps, props);
  }

  /** @internal */
  public saveWindowSettings(id: WidgetZoneId, props: ZonesManagerProps) {
    const zone = props.zones[id];
    const zonesBounds = Rectangle.create(props.zonesBounds);
    const zonesHeight = zonesBounds.getHeight();
    const zonesWidth = zonesBounds.getWidth();
    const manager = this.getZoneManager(id);
    manager.windowResize.vMode = "Percentage";
    manager.windowResize.vStart = zone.bounds.top / zonesHeight;
    manager.windowResize.vEnd = zone.bounds.bottom / zonesHeight;
    manager.windowResize.hMode = "Percentage";
    manager.windowResize.hStart = zone.bounds.left / zonesWidth;
    manager.windowResize.hEnd = zone.bounds.right / zonesWidth;
  }
}
