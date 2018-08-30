/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Point, { PointProps } from "../../utilities/Point";
import Rectangle from "../../utilities/Rectangle";
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
    if (widget.isInHomeZone) {
      const unmergeBounds = zone.getUnmergeBounds();
      return {
        ...model.props,
        zones: {
          ...model.props.zones,
          ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
            const id = Number(key) as WidgetZoneIndex;
            const mergedZone = unmergeBounds.find((z) => z.id === id);
            if (id === zone.props.id && mergedZone) {
              acc[id] = {
                ...model.props.zones[id],
                floatingBounds: defaultZone.props.floatingBounds ? defaultZone.props.floatingBounds : defaultZone.props.bounds,
                bounds: mergedZone.bounds,
                widgets: model.props.zones[id].widgets.filter((w) => w.id === widgetId).map((w) => {
                  if (w.id === id && w.tabIndex < 1)
                    return {
                      ...w,
                      tabIndex: tabId,
                    };
                  return w;
                }),
              };
            } else if (mergedZone) {
              acc[id] = {
                ...model.props.zones[id],
                bounds: mergedZone.bounds,
                anchor: undefined,
                widgets: model.props.zones[zone.props.id].widgets.filter((w) => w.id === id).map((w) => {
                  if (w.id === id && w.tabIndex < 1)
                    return {
                      ...w,
                      tabIndex: 1,
                    };
                  return w;
                }),
              };
            }

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

    const unmergeWidgetBounds = zone.getUnmergeWidgetBounds(widget);
    const floatingBounds = Rectangle.create(widget.zone.props.bounds).offset(offset);
    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
          const id = Number(key) as WidgetZoneIndex;
          const mergedZone = unmergeWidgetBounds.find((z) => z.id === id);
          if (id === zone.props.id && mergedZone) {
            acc[id] = {
              ...model.props.zones[id],
              widgets: model.props.zones[id].widgets.filter((w) => w.id !== widgetId).map((w) => {
                if (w.id === id && w.tabIndex < 1)
                  return {
                    ...w,
                    tabIndex: 1,
                  };
                return w;
              }),
              bounds: mergedZone.bounds,
            };
          } else if (id === defaultZone.id && mergedZone) {
            acc[id] = {
              ...model.props.zones[id],
              bounds: mergedZone.bounds,
              floatingBounds,
              widgets: [
                ...model.props.zones[zone.props.id].widgets.filter((w) => w.id === widgetId).map((w) => {
                  if (w.id === id && w.tabIndex < 1)
                    return {
                      ...w,
                      tabIndex: tabId,
                    };
                  return w;
                }),
              ],
            };
          } else if (mergedZone) {
            acc[id] = {
              ...model.props.zones[id],
              bounds: mergedZone.bounds,
            };
          }

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

    if (targetWidget.isFirst(draggingZone))
      return {
        ...model.props,
        zones: {
          ...model.props.zones,
          [draggingZone.props.id]: {
            ...model.props.zones[draggingZone.props.id],
            floatingBounds: undefined,
          },
        },
        draggingWidget: undefined,
      };

    const zonesToUpdate: Partial<ZonesType> = {};
    const bounds = Rectangle.create(draggingZone.props.bounds).outerMergeWith(targetZone.props.bounds);

    const contentZone = model.getContentZone();
    const statusZone = model.getStatusZone();
    const alignedCells = targetZone.cell.getAlignedCellsTo(draggingZone.cell);
    alignedCells.push(targetZone.cell, draggingZone.cell);
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
