/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { CellProps, Cell } from "../../utilities/Cell";
import { RectangleProps, Rectangle } from "../../utilities/Rectangle";
import { NineZoneRoot as Root } from "./layout/Layouts";
import { Target, TargetZoneProps, TargetType } from "./Target";
import { Widget, DraggingWidgetProps, DraggingWidget, WidgetProps, getDefaultWidgetProps, getDefaultWidgetHorizontalAnchor, getDefaultWidgetVerticalAnchor } from "./Widget";
import { ZoneManagerHelper, getDefaultZoneProps, ZoneManagerProps, ContentZone, WidgetZone, StatusZoneManagerHelper, StatusZoneManagerProps, getDefaultStatusZoneProps } from "./Zone";
import { ResizeHandle } from "../../widget/rectangular/ResizeHandle";
import { PointProps, Point } from "../../utilities/Point";
import { HorizontalAnchor, VerticalAnchor } from "../../widget/Stacked";

/** @alpha */
export type ContentZoneIndex = 5;
/** @alpha */
export type StatusZoneIndex = 8;
/** @alpha */
export type WidgetZoneIndex = 1 | 2 | 3 | 4 | 6 | 7 | StatusZoneIndex | 9;
/** @alpha */
export type ZoneIndex = WidgetZoneIndex | ContentZoneIndex;

/** @alpha */
export type ZonesType = // todo: readonly
  { [id in Exclude<WidgetZoneIndex, StatusZoneIndex>]: ZoneManagerProps } &
  { [id in StatusZoneIndex]: StatusZoneManagerProps };

/** @alpha */
export type ZonesManagerWidgets = { readonly [id in WidgetZoneIndex]: WidgetProps };

/** @alpha */
export interface ZonesManagerProps {
  readonly bounds: RectangleProps;
  readonly draggingWidget?: DraggingWidgetProps;
  readonly target?: TargetZoneProps;
  readonly widgets: ZonesManagerWidgets;
  readonly zones: Readonly<ZonesType>;
}

/** @alpha */
export const getDefaultZonesManagerZonesProps = (): Readonly<ZonesType> => {
  return {
    1: getDefaultZoneProps(1),
    2: getDefaultZoneProps(2),
    3: getDefaultZoneProps(3),
    4: getDefaultZoneProps(4),
    6: getDefaultZoneProps(6),
    7: getDefaultZoneProps(7),
    8: getDefaultStatusZoneProps(),
    9: getDefaultZoneProps(9),
  };
};

/** @alpha */
export const getDefaultZonesManagerWidgetsProps = (): ZonesManagerWidgets => {
  return {
    1: getDefaultWidgetProps(1),
    2: getDefaultWidgetProps(2),
    3: getDefaultWidgetProps(3),
    4: getDefaultWidgetProps(4),
    6: getDefaultWidgetProps(6),
    7: getDefaultWidgetProps(7),
    8: getDefaultWidgetProps(8),
    9: getDefaultWidgetProps(9),
  };
};

/** @alpha */
export const getDefaultZonesManagerProps = (): ZonesManagerProps => (
  {
    bounds: {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    },
    zones: getDefaultZonesManagerZonesProps(),
    widgets: getDefaultZonesManagerWidgetsProps(),
  }
);

const widgetZoneIds: ReadonlyArray<WidgetZoneIndex> = [1, 2, 3, 4, 6, 7, 8, 9];
const getWidgetCell = (id: WidgetZoneIndex) => new Cell(Math.floor((id - 1) / 3), (id - 1) % 3);

/** @alpha */
export class NineZone implements Iterable<ZoneManagerHelper> {
  private _zones: { [id: number]: ZoneManagerHelper } = {};
  private _widgets?: { [id in WidgetZoneIndex]: Widget };
  private _root: Root | undefined;
  private _target?: Target;
  private _draggingWidget?: DraggingWidget;

  public constructor(public readonly props: ZonesManagerProps) {
  }

  public [Symbol.iterator]() {
    let currentId = 1;
    const zones = this;
    return {
      next(): IteratorResult<ZoneManagerHelper> {
        if (currentId > 9)
          return {
            done: true,
            value: {} as ZoneManagerHelper,
          };

        return {
          done: false,
          value: zones.getZone(currentId++ as ZoneIndex),
        };
      },
    };
  }

  public get root() {
    if (!this._root)
      this._root = new Root(this);
    return this._root;
  }

  public getZone(zoneId: ZoneIndex): ZoneManagerHelper {
    if (this._zones[zoneId])
      return this._zones[zoneId];

    if (zoneId === 5)
      this._zones[zoneId] = new ContentZone(this);
    else if (zoneId === 8)
      this._zones[zoneId] = new StatusZoneManagerHelper(this, this.props.zones[zoneId]);
    else
      this._zones[zoneId] = new WidgetZone(this, this.props.zones[zoneId]);
    return this._zones[zoneId];
  }

  public getWidgetZone(zoneId: WidgetZoneIndex): WidgetZone {
    return this.getZone(zoneId) as WidgetZone;
  }

  public getStatusZone(): StatusZoneManagerHelper {
    return this.getZone(StatusZoneManagerHelper.id) as StatusZoneManagerHelper;
  }

  public getContentZone(): ContentZone {
    return this.getZone(ContentZone.id) as ContentZone;
  }

  public getWidget(widgetId: WidgetZoneIndex): Widget {
    if (!this._widgets) {
      this._widgets = widgetZoneIds.reduce((acc, wId) => {
        acc[wId] = new Widget(this, this.props.widgets[wId]);
        return acc;
      }, {} as { [id in WidgetZoneIndex]: Widget });
    }
    return this._widgets[widgetId];
  }

  public findZone(cell: CellProps): WidgetZone {
    for (const zone of this) {
      if (zone.id === 5)
        continue;
      if (zone.cell.equals(cell))
        return zone as WidgetZone;
    }

    throw new RangeError();
  }

  public get draggingWidget(): DraggingWidget | undefined {
    if (!this._draggingWidget && this.props.draggingWidget)
      this._draggingWidget = new DraggingWidget(this, this.props.draggingWidget);
    return this._draggingWidget;
  }

  public get target(): Target | undefined {
    if (!this._target && this.props.target)
      this._target = new Target(this, this.props.target);
    return this._target;
  }
}

/** @alpha */
export type NineZoneFactory = (props: ZonesManagerProps) => NineZone;

/** @alpha */
export class ZonesManager {
  private _lastStackId = 1;
  private _nineZoneFactory: NineZoneFactory;

  public constructor(nineZoneFactory: NineZoneFactory) {
    this._nineZoneFactory = nineZoneFactory;
  }

  public handleTabClick(widgetId: WidgetZoneIndex, tabIndex: number, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    const widget = model.getWidget(widgetId);
    const isClosing = tabIndex === widget.props.tabIndex;
    return this.handleWidgetStateChange(widgetId, tabIndex, !isClosing, state);
  }

  public handleWidgetStateChange(widgetId: WidgetZoneIndex, tabIndex: number, isOpening: boolean, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    const widget = model.getWidget(widgetId);
    const zone = widget.zone;

    if (!isOpening && zone && zone.isFloating())
      return state;

    if (!isOpening && widget.props.tabIndex !== tabIndex)
      return state;

    if (!zone)
      return state;

    const widgets = zone.props.widgets.reduce((acc, wId) => {
      const newTabIndex = isOpening && wId === widgetId ? tabIndex : -1;
      if (acc[wId].tabIndex === newTabIndex)
        return acc;
      return {
        ...acc,
        [wId]: {
          ...acc[wId],
          tabIndex: newTabIndex,
        },
      };
    }, state.widgets);

    const newState: ZonesManagerProps = {
      ...model.props,
      widgets,
    };

    return newState;
  }

  public layout(bounds: RectangleProps, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    model.root.bounds = Rectangle.createFromSize(Rectangle.create(bounds).getSize());
    const offset = Rectangle.create(bounds).topLeft().getOffsetTo(Rectangle.create(state.bounds).topLeft());

    const newState: ZonesManagerProps = {
      ...model.props,
      bounds: {
        ...bounds,
      },
      zones: Object.keys(model.props.zones).reduce((acc, key) => {
        const id = Number(key) as WidgetZoneIndex;
        const initialBounds = model.getWidgetZone(id).getLayout().getInitialBounds();
        const floating = model.props.zones[id].floating;

        return {
          ...acc,
          [id]: {
            ...acc[id],
            isLayoutChanged: false,
            bounds: initialBounds,
            ...floating === undefined || !state.draggingWidget || state.draggingWidget.id !== id ? {} : {
              floating: {
                ...floating,
                bounds: Rectangle.create(floating.bounds).offset(offset).toProps(),
              },
            },
          },
        };
      }, model.props.zones),
    };

    return newState;
  }

  public handleResize(zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    model.getWidgetZone(zoneId).getLayout().resize(x, y, handle, filledHeightDiff);

    const newState: ZonesManagerProps = {
      ...model.props,
      zones: Object.keys(model.props.zones).reduce((acc, key) => {
        const id = Number(key) as WidgetZoneIndex;
        const zone = state.zones[id];

        const layout = model.getWidgetZone(id).getLayout();
        const bounds = layout.bounds.equals(zone.bounds) ? zone.bounds : layout.bounds;
        const isLayoutChanged = zoneId === id ? true : zone.isLayoutChanged;

        const oldFloatingBounds = zone.floating ? zone.floating.bounds : undefined;
        const newFloatingBounds = layout.floatingBounds;

        let floating = zone.floating;
        if (newFloatingBounds && oldFloatingBounds && !newFloatingBounds.equals(oldFloatingBounds)) {
          floating = {
            ...state.zones[id].floating,
            stackId: state.zones[id].floating!.stackId,
            bounds: newFloatingBounds,
          };
        }

        if (bounds === zone.bounds &&
          floating === zone.floating &&
          isLayoutChanged === zone.isLayoutChanged) {
          return acc;
        }

        return {
          ...acc,
          [id]: {
            ...acc[id],
            bounds,
            floating,
            isLayoutChanged,
          },
        };
      }, model.props.zones),
    };

    return newState;
  }

  public setIsInFooterMode(isInFooterMode: boolean, state: ZonesManagerProps): ZonesManagerProps {
    if (isInFooterMode === state.zones[8].isInFooterMode)
      return state;

    const model = this._nineZoneFactory(state);
    const root = model.root;
    root.isInFooterMode = isInFooterMode;

    const newState: ZonesManagerProps = {
      ...model.props,
      zones: Object.keys(model.props.zones).reduce((acc, key) => {
        const id = Number(key) as WidgetZoneIndex;
        const zone = model.getWidgetZone(id);
        const bounds = zone.getLayout().getInitialBounds();

        return {
          ...acc,
          [id]: {
            ...acc[id],
            bounds,
            ...id === StatusZoneManagerHelper.id ? { isInFooterMode } as StatusZoneManagerProps : {},
          },
        };
      }, model.props.zones),
    };

    return newState;
  }

  public mergeZone(toMergeId: WidgetZoneIndex, targetId: WidgetZoneIndex, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    const zone = model.getWidgetZone(toMergeId);
    const target = model.getWidgetZone(targetId);
    if (!zone.canBeMergedTo(target))
      return state;

    const newState: ZonesManagerProps = {
      ...state,
      zones: {
        ...state.zones,
        [toMergeId]: {
          ...state.zones[toMergeId],
          widgets: [],
        },
        [targetId]: {
          ...state.zones[targetId],
          widgets: [
            ...state.zones[targetId].widgets,
            toMergeId,
          ],
        },
      },
    };
    return newState;
  }

  public addWidget<TProps extends ZonesManagerProps>(zoneId: WidgetZoneIndex, widgetId: WidgetZoneIndex, props: TProps): TProps {
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

  public removeWidget<TProps extends ZonesManagerProps>(zoneId: WidgetZoneIndex, widgetId: WidgetZoneIndex, props: TProps): TProps {
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

  public setWidgetTabId<TProps extends ZonesManagerProps>(widgetId: WidgetZoneIndex, tabIndex: number, props: TProps): TProps {
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

  public setWidgetHorizontalAnchor<TProps extends ZonesManagerProps>(widgetId: WidgetZoneIndex, horizontalAnchor: HorizontalAnchor, props: TProps): TProps {
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

  public setWidgetVerticalAnchor<TProps extends ZonesManagerProps>(widgetId: WidgetZoneIndex, verticalAnchor: VerticalAnchor, props: TProps): TProps {
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

  public handleWidgetTabDragStart(widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetBounds: RectangleProps, props: ZonesManagerProps): ZonesManagerProps {
    const zoneId = this.findZoneWithWidget(widgetId, props);
    if (!this.isWidgetOpen(zoneId, props))
      return props;

    const defaultZone = props.zones[widgetId];
    if (!defaultZone.allowsMerging)
      return props;

    const unmergeBounds = this.getUnmergeWidgetBounds(zoneId, props);
    const floatingBounds = Rectangle.create(widgetBounds).offset({ x: -props.bounds.left, y: -props.bounds.top });

    const zone = props.zones[zoneId];
    const isUnmerge = zone.widgets.length > 1;

    let newProps = {
      ...props,
      zones: Object.keys(props.zones).reduce((acc, key) => {
        const id = Number(key) as WidgetZoneIndex;
        const mergedZone = unmergeBounds.find((z) => z.id === id);
        if (!mergedZone)
          return acc;

        return {
          ...acc,
          [id]: {
            ...acc[id],
            ...defaultZone.id === id ? {
              floating: {
                bounds: {
                  bottom: floatingBounds.bottom,
                  left: floatingBounds.left,
                  right: floatingBounds.right,
                  top: floatingBounds.top,
                },
                stackId: this._lastStackId++,
              },
            } : {},
            bounds: mergedZone.bounds,
            widgets: [id],
          },
        };
      }, props.zones),
      draggingWidget: {
        id: widgetId,
        tabIndex: tabId,
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
      newProps = this.setWidgetTabId(widgetId, tabId, newProps);
    }

    // Open home widget if it is not open
    const homeWidget = props.widgets[zoneId];
    if (homeWidget.tabIndex < 0) {
      newProps = this.setWidgetTabId(zoneId, 0, newProps);
    }

    for (const ub of unmergeBounds) {
      if (ub.id === widgetId)
        continue;
      const anchor = getDefaultWidgetHorizontalAnchor(ub.id);
      newProps = this.setWidgetHorizontalAnchor(ub.id, anchor, newProps);
    }

    return newProps;
  }

  public handleWidgetTabDragEnd(state: ZonesManagerProps): ZonesManagerProps {
    if (!state.draggingWidget)
      return state;

    if (!state.target) {
      return {
        ...state,
        draggingWidget: undefined,
      };
    }

    switch (state.target.type) {
      case TargetType.Merge: {
        return this.mergeDrop(state);
      }
      case TargetType.Back: {
        return this.backDrop(state);
      }
    }
  }

  public handleWidgetTabDrag(dragged: PointProps, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    const draggingWidget = model.draggingWidget;

    if (!draggingWidget)
      return state;

    const draggingZone = draggingWidget.defaultZone;
    if (!draggingZone.props.floating)
      return state;

    const newBounds = Rectangle.create(draggingZone.props.floating.bounds).offset(dragged);
    const lastPosition = Point.create(draggingWidget.props.lastPosition).offset(dragged);
    const newState: ZonesManagerProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [draggingZone.props.id]: {
          ...model.props.zones[draggingZone.props.id],
          floating: {
            ...model.props.zones[draggingZone.props.id].floating,
            bounds: newBounds,
          },
        } as ZoneManagerProps,
      },
      draggingWidget: {
        ...draggingWidget.props,
        lastPosition,
      },
    };

    return newState;
  }

  public handleTargetChanged(target: TargetZoneProps | undefined, state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);
    const draggingWidget = model.draggingWidget;

    if (!draggingWidget || !target)
      return {
        ...state,
        target: undefined,
      };

    return {
      ...state,
      target: {
        zoneId: target.zoneId,
        type: target.type,
      },
    };
  }

  private mergeDrop(state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);

    if (!model.target)
      return model.props;

    const draggingWidget = model.draggingWidget;
    if (!draggingWidget)
      return model.props;

    const targetZone = model.target.zone;
    const draggingZone = draggingWidget.zone;
    if (!draggingZone)
      return model.props;

    const bounds = Rectangle.create(draggingZone.props.bounds).outerMergeWith(targetZone.props.bounds);
    const contentZone = model.getContentZone();
    const statusZone = model.getStatusZone();
    const alignedCells = [
      targetZone.cell,
      ...targetZone.cell.getAlignedCellsTo(draggingZone.cell),
      draggingZone.cell,
    ];
    const alignedCellsFiltered = alignedCells.filter((cell) => {
      if (contentZone.cell.equals(cell))
        return false;
      if (statusZone.props.isInFooterMode && statusZone.cell.equals(cell))
        return false;
      return true;
    });
    const alignedZones = alignedCellsFiltered.map((cell) => model.findZone(cell));
    const zoneWidgets = alignedZones.map((z) => z.getWidgets());
    let widgets: Widget[] = [];
    widgets = widgets.concat(...zoneWidgets);

    let newProps = {
      ...model.props,
      draggingWidget: undefined,
      zones: alignedZones.reduce((acc, zone) => {
        if (zone.equals(targetZone))
          return {
            ...acc,
            [zone.props.id]: {
              ...acc[zone.props.id],
              bounds,
              floating: undefined,
              widgets: widgets.map((w) => w.props.id),
            },
          };

        return {
          ...acc,
          [zone.props.id]: {
            ...model.props.zones[zone.props.id],
            floating: undefined, // dragging zone is merged and should not float anymore
            widgets: [], // dragging zone is merged and should contain no widgets
          },
        };
      }, model.props.zones),
    };

    for (const widget of widgets) {
      const horizontalAnchor = getDefaultWidgetHorizontalAnchor(draggingZone.props.id);
      newProps = this.setWidgetHorizontalAnchor(widget.props.id, horizontalAnchor, newProps);
      const verticalAnchor = getDefaultWidgetVerticalAnchor(draggingZone.props.id);
      newProps = this.setWidgetVerticalAnchor(widget.props.id, verticalAnchor, newProps);

      if (widget.equals(draggingWidget.widget))
        continue;
      newProps = this.setWidgetTabId(widget.props.id, -1, newProps);
    }

    return newProps;
  }

  private backDrop(state: ZonesManagerProps): ZonesManagerProps {
    const model = this._nineZoneFactory(state);

    const draggingWidget = model.draggingWidget;
    if (!draggingWidget)
      return state;

    const draggingZone = draggingWidget.zone;
    if (!draggingZone)
      return state;
    let newProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [draggingZone.id]: {
          ...model.props.zones[draggingZone.id],
          floating: undefined,
          anchor: undefined,
        },
      },
      draggingWidget: undefined,
    };
    const horizontalAnchor = getDefaultWidgetHorizontalAnchor(draggingZone.id);
    newProps = this.setWidgetHorizontalAnchor(draggingZone.id, horizontalAnchor, newProps);
    const verticalAnchor = getDefaultWidgetVerticalAnchor(draggingZone.id);
    newProps = this.setWidgetVerticalAnchor(draggingZone.id, verticalAnchor, newProps);
    return newProps;
  }

  public setAllowsMerging(zoneId: WidgetZoneIndex, allowsMerging: boolean, state: ZonesManagerProps): ZonesManagerProps {
    if (state.zones[zoneId].allowsMerging === allowsMerging)
      return state;

    return {
      ...state,
      zones: {
        ...state.zones,
        [zoneId]: {
          ...state.zones[zoneId],
          allowsMerging,
        },
      },
    };
  }

  public isWidgetOpen(zoneId: WidgetZoneIndex, props: ZonesManagerProps) {
    const zone = props.zones[zoneId];
    return zone.widgets.some((widgetId) => {
      const widget = props.widgets[widgetId];
      return widget.tabIndex >= 0;
    });
  }

  public findZoneWithWidget(widgetId: WidgetZoneIndex, props: ZonesManagerProps): WidgetZoneIndex {
    for (const zoneId of widgetZoneIds) {
      const zone = props.zones[zoneId];
      if (zone.widgets.some((w) => w === widgetId))
        return zoneId;
    }
    throw new RangeError();
  }

  public getUnmergeWidgetBounds(zoneId: WidgetZoneIndex, props: ZonesManagerProps): Array<{ id: WidgetZoneIndex, bounds: RectangleProps }> {
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

  public isMergedVertically(zoneId: WidgetZoneIndex, props: ZonesManagerProps): boolean {
    const zone = props.zones[zoneId];
    if (zone.widgets.length < 2)
      return false;

    const cell0 = getWidgetCell(zone.widgets[0]);
    const cell1 = getWidgetCell(zone.widgets[1]);
    return cell0.isColumnAlignedWith(cell1);
  }

  public isMergedHorizontally(zoneId: WidgetZoneIndex, props: ZonesManagerProps): boolean {
    const zone = props.zones[zoneId];
    if (zone.widgets.length < 2)
      return false;

    const cell0 = getWidgetCell(zone.widgets[0]);
    const cell1 = getWidgetCell(zone.widgets[1]);
    return cell0.isRowAlignedWith(cell1);
  }
}

const defaultFactory = (props: ZonesManagerProps): NineZone => {
  return new NineZone(props);
};

/** @alpha */
// tslint:disable-next-line:variable-name
export const DefaultStateManager = new ZonesManager(defaultFactory);
