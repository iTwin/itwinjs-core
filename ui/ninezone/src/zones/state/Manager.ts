/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Point, { PointProps } from "../../utilities/Point";
import Rectangle, { RectangleProps } from "../../utilities/Rectangle";
import { SizeProps } from "../../utilities/Size";
import { ResizeHandle } from "../../widget/rectangular/ResizeHandle";
import NineZone, { NineZoneProps, WidgetZoneIndex, ZonesType } from "./NineZone";
import Widget from "./Widget";
import { WidgetZone, StatusZone, StatusZoneProps } from "./Zone";
import { TargetType, TargetProps } from "./Target";

export class StateManager {
  public handleTabClick(widgetId: number, tabIndex: number, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const widget = model.getWidget(widgetId);
    const zone = widget.zone;

    const isClosing = tabIndex === widget.props.tabIndex;

    if (isClosing && zone.isFloating)
      return { ...model.props };

    // Close all widgets
    const widgets = zone.props.widgets.map((w) => ({
      ...w,
      tabIndex: -1,
    }));
    const widgetIndex = widgets.findIndex((w) => w.id === widgetId);

    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [zone.props.id]: {
          ...model.props.zones[zone.props.id],
          widgets: isClosing ? widgets :
            [
              // Open clicked widget
              ...widgets.slice(0, widgetIndex),
              {
                ...widgets[widgetIndex],
                tabIndex,
              },
              ...widgets.slice(widgetIndex + 1),
            ],
        },
      },
    };

    return newState;
  }

  public handleInitialLayout(size: SizeProps, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);
    model.root.setSize(size);

    const newState: NineZoneProps = {
      ...model.props,
      size: {
        ...size,
      },
      zones: {
        ...model.props.zones,
        ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
          const id = Number(key) as WidgetZoneIndex;
          const bounds = model.getWidgetZone(id).getLayout().getInitialBounds();
          acc[id] = {
            ...model.props.zones[id],
            bounds,
          };
          return acc;
        }, {}),
      },

    };

    return newState;
  }

  public handleResize(zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);
    model.getWidgetZone(zoneId).getLayout().resize(x, y, handle);

    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
          const id = Number(key) as WidgetZoneIndex;
          const bounds = model.getWidgetZone(id).getLayout().bounds;
          acc[id] = {
            ...model.props.zones[id],
            bounds,
          };
          return acc;
        }, {}),
      },
    };

    return newState;
  }

  public handleChangeFooterMode(isInFooterMode: boolean, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);
    const root = model.root;
    if (root.isInFooterMode === isInFooterMode)
      return { ...model.props };

    root.isInFooterMode = isInFooterMode;

    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
          const id = Number(key) as WidgetZoneIndex;
          const zone = model.getWidgetZone(id);
          const bounds = zone.getLayout().getInitialBounds();

          acc[id] = {
            ...model.props.zones[id],
            bounds,
            ...(id === StatusZone.id && { isInFooterMode } as StatusZoneProps),
          };

          return acc;
        }, {}),
      },
    };

    return newState;
  }

  public handleWidgetTabDragStart(widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const widget = model.getWidget(widgetId);
    const zone = widget.zone;
    if (!zone.isWidgetOpen)
      return { ...model.props };

    const defaultZone = widget.defaultZone;
    const unmergeBounds = zone.getUnmergeWidgetBounds(widget);
    let floatingBounds: RectangleProps = Rectangle.create(widget.zone.props.bounds).offset(offset);
    if (widget.isInHomeZone)
      floatingBounds = defaultZone.props.floatingBounds ? defaultZone.props.floatingBounds : defaultZone.props.bounds;

    // const restoreAllWidgets = widget.isInHomeZone || widget.isMiddle;
    const isUnmerge = zone.getWidgets().length > unmergeBounds.length;
    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
          const id = Number(key) as WidgetZoneIndex;
          const mergedZone = unmergeBounds.find((z) => z.id === id);

          if (!mergedZone)
            return acc;

          const isDefaultZone = id === defaultZone.id;
          const isZone = id === zone.id;

          const filterOthers = isZone && isUnmerge;
          const widgets = model.props.zones[zone.props.id].widgets.filter((w) => {
            if (filterOthers)
              return w.id !== widgetId;
            return w.id === id;
          }).map((w, index) => {
            const isFirstWidget = index === 0;
            const openWidget = isFirstWidget && w.tabIndex < 1;
            if (openWidget) {
              const tabIndex = isDefaultZone ? tabId : 1;
              return {
                ...w,
                tabIndex,
              };
            }

            return w;
          });

          acc[id] = {
            ...model.props.zones[id],
            ...defaultZone.id === id ? { floatingBounds } : {},
            anchor: undefined,
            bounds: mergedZone.bounds,
            widgets,
          };

          return acc;
        }, {}),
      },
      draggingWidget: {
        id: widgetId,
        lastPosition: {
          x: initialPosition.x,
          y: initialPosition.y,
        },
      },
    };
  }

  public handleWidgetTabDragFinish(state: NineZoneProps): NineZoneProps {
    if (state.target) {
      switch (state.target.type) {
        case TargetType.Merge: {
          return this.mergeDrop(state.target.widgetId, state);
        }
        case TargetType.Back: {
          return this.backDrop(state);
        }
        default:
          break;
      }
    }

    return {
      ...state,
      draggingWidget: undefined,
    };
  }

  public handleWidgetTabDrag(dragged: PointProps, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);
    const draggingWidget = model.draggingWidget;

    if (!draggingWidget)
      return { ...model.props };

    const draggingZone = draggingWidget.defaultZone;
    if (!draggingZone.props.floatingBounds)
      return { ...model.props };

    const newBounds = Rectangle.create(draggingZone.props.floatingBounds).offset(dragged);
    const lastPosition = Point.create(draggingWidget.props.lastPosition).offset(dragged);
    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [draggingZone.props.id]: {
          ...model.props.zones[draggingZone.props.id],
          floatingBounds: newBounds,
        },
      },
      draggingWidget: {
        ...draggingWidget.props,
        lastPosition,
      },
    };

    return newState;
  }

  public handleTargetChanged(target: TargetProps | undefined, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);
    const draggingWidget = model.draggingWidget;

    if (!draggingWidget || !target)
      return {
        ...state,
        target: undefined,
      };

    return {
      ...state,
      target: {
        widgetId: target.widgetId,
        type: target.type,
      },
    };
  }

  public mergeDrop(targetWidgetId: number, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const draggingWidget = model.draggingWidget;
    if (!draggingWidget)
      return { ...model.props };

    const targetWidget = model.getWidget(targetWidgetId);
    const targetZone = targetWidget.zone;
    const draggingZone = draggingWidget.zone;

    const zonesToUpdate: Partial<ZonesType> = {};
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
    const alignedZones = alignedCellsFiltered.map((cell) => model.findZone(cell))
      .filter<WidgetZone>((z): z is WidgetZone => z.isWidgetZone());
    const zoneWidgets = alignedZones.map((z) => z.getWidgets());
    let widgets: Widget[] = [];
    widgets = widgets.concat(...zoneWidgets);

    for (const zone of alignedZones)
      if (zone.equals(targetZone))
        zonesToUpdate[zone.props.id] = {
          ...model.props.zones[zone.props.id],
          bounds,
          floatingBounds: undefined,
          widgets: [
            ...widgets.map((w) => {
              if (w.equals(draggingWidget.widget))
                return {
                  ...w.props,
                };
              return {
                ...w.props,
                tabIndex: -1,
              };
            }),
          ],
          anchor: draggingZone.defaultHorizontalAnchor,
        };
      else
        zonesToUpdate[zone.props.id] = {
          ...model.props.zones[zone.props.id],
          floatingBounds: undefined, // dragging zone is merged and should not float anymore
          widgets: [], // dragging zone is merged and should contain no widgets
        };

    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...zonesToUpdate,
      },
      draggingWidget: undefined,
    };
  }

  public backDrop(state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const draggingWidget = model.draggingWidget;
    if (!draggingWidget)
      return { ...state };

    const draggingZone = draggingWidget.zone;
    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        [draggingZone.id]: {
          ...model.props.zones[draggingZone.id],
          floatingBounds: undefined,
          anchor: undefined,
        },
      },
      draggingWidget: undefined,
    };
  }
}

// tslint:disable-next-line:variable-name
export const Manager = new StateManager();
export default Manager;
