/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Point, { PointProps } from "../../utilities/Point";
import Rectangle from "../../utilities/Rectangle";
import { SizeProps } from "../../utilities/Size";
import { ResizeHandle } from "../../widget/rectangular/ResizeHandle";
import NineZone, { NineZoneProps, WidgetZoneIndex, ZonesType } from "./NineZone";
import Widget, { WidgetProps } from "./Widget";
import { ZoneIdToWidget, WidgetZone, StatusZone, StatusZoneProps } from "./Zone";
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

  public handleWidgetTabDragStart(widgetId: WidgetZoneIndex, initialPosition: PointProps, offset: PointProps, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const widget = model.getWidget(widgetId);
    const zone = widget.zone;
    if (!zone.isWidgetOpen)
      return { ...model.props };

    if (!widget.isInHomeZone) {
      const mergedZones = zone.getWidgets().map((w) => w.defaultZone);
      const zoneBounds = Rectangle.create(zone.props.bounds);
      const floatingBounds = Rectangle.create(widget.zone.props.bounds).offset(offset);
      return {
        ...model.props,
        zones: {
          ...model.props.zones,
          ...Object.keys(model.props.zones).reduce((acc: Partial<ZonesType>, key) => {
            const id = Number(key) as WidgetZoneIndex;
            const mergedZoneIndex = mergedZones.findIndex((mz) => mz.id === id);
            const mergedZone = mergedZoneIndex > -1 ? mergedZones[mergedZoneIndex] : undefined;
            if (id === zone.props.id && mergedZone) {
              acc[id] = {
                ...model.props.zones[id],
                widgets: model.props.zones[zone.props.id].widgets.filter((w) => w.id !== widgetId),
                bounds: zoneBounds.getVerticalSegmentBounds(mergedZoneIndex, mergedZones.length),
              };
            } else if (id === widget.defaultZone.id && mergedZone) {
              acc[id] = {
                ...model.props.zones[id],
                bounds: zoneBounds.getVerticalSegmentBounds(mergedZoneIndex, mergedZones.length),
                floatingBounds,
                widgets: [{
                  ...model.props.zones[zone.props.id].widgets.find((w) => w.id === widgetId),
                }] as WidgetProps[],
              };
            } else if (mergedZone) {
              acc[id] = {
                ...model.props.zones[id],
                bounds: zoneBounds.getVerticalSegmentBounds(mergedZoneIndex, mergedZones.length),
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

    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        [zone.props.id]: {
          ...model.props.zones[zone.props.id],
          floatingBounds: widget.defaultZone.props.floatingBounds ? widget.defaultZone.props.floatingBounds : widget.defaultZone.props.bounds,
        },
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
        case TargetType.Unmerge: {
          return this.unmergeDrop(state.target.widgetId, state);
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

    if (draggingZone.isFirstWidget(targetWidget))
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

  public unmergeDrop(targetWidgetId: number, state: NineZoneProps): NineZoneProps {
    const model = new NineZone(state);

    const draggingWidget = model.draggingWidget;
    if (!draggingWidget)
      return { ...state };

    const zonesToUpdate: Partial<ZonesType> = {};
    const draggingZone = draggingWidget.zone;
    const targetWidget = model.getWidget(targetWidgetId);

    const widgets = Widget.sort(draggingZone.getWidgets());
    const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
    const isHorizontal = draggingZone.isMergedHorizontally;

    if (draggingZone.getWidgets().length > 2 && draggingZone.isLastWidget(targetWidget)) {
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

      zonesToUpdate[first.defaultZone.props.id] = {
        ...model.props.zones[first.defaultZone.props.id],
        bounds: mergedZonesBounds,
        floatingBounds: undefined,
        widgets: widgets.filter((w) => !w.equals(last)).map((w) => w.props),
      };
      zonesToUpdate[last.defaultZone.props.id] = {
        ...model.props.zones[last.defaultZone.props.id],
        bounds: unmergedZoneBounds,
        floatingBounds: undefined,
        widgets: [last.props],
      };
    } else {
      const targetIndex = draggingZone.getWidgets().findIndex((w) => w.equals(targetWidget));
      const widgetsToUnmerge = draggingZone.getWidgets().slice().filter((w) => !w.equals(draggingWidget.widget));
      const zoneSlots = widgets.map((w) => w.defaultZone.props.id).filter((_id, index) => index !== targetIndex);
      const contentZone = model.getContentZone();
      const statusZone = model.getStatusZone();

      const zoneToWidgetArray: ZoneIdToWidget[] = [
        ...zoneSlots.map((zoneSlot, index) => ({
          zoneId: zoneSlot,
          widget: widgetsToUnmerge[index],
        })),
        {
          zoneId: widgets[targetIndex].defaultZone.props.id,
          widget: draggingWidget.widget,
        },
        ...(Widget.isCellBetweenWidgets(contentZone.cell, widgets) ?
          [
            {
              zoneId: contentZone.id,
              widget: undefined,
            } as ZoneIdToWidget,
          ] : []),
        ...(statusZone.props.isInFooterMode && Widget.isCellBetweenWidgets(statusZone.cell, widgets) ?
          [
            {
              zoneId: statusZone.id,
              widget: undefined,
            } as ZoneIdToWidget,
          ] : []),
      ].sort(ZoneIdToWidget.sortAscending);

      const widgetHeight = draggingZoneBounds.getHeight() / zoneToWidgetArray.length;
      const widgetWidth = draggingZoneBounds.getWidth() / zoneToWidgetArray.length;

      for (let i = 0; i < zoneToWidgetArray.length; i++) {
        const zoneToWidget = zoneToWidgetArray[i];
        if (!zoneToWidget.widget || zoneToWidget.zoneId === 5)
          continue;

        const topInset = i * widgetHeight;
        const bottomInset = (zoneToWidgetArray.length - i - 1) * widgetHeight;
        let bounds = draggingZoneBounds.inset(0, topInset, 0, bottomInset);
        if (isHorizontal) {
          const leftInset = i * widgetWidth;
          const rightInset = (zoneToWidgetArray.length - i - 1) * widgetWidth;
          bounds = draggingZoneBounds.inset(leftInset, 0, rightInset, 0);
        }

        const zoneId = zoneToWidget.zoneId;
        const widget = zoneToWidget.widget;
        zonesToUpdate[zoneId] = {
          ...model.props.zones[zoneId],
          bounds,
          floatingBounds: undefined,
          widgets: [
            {
              ...widget.props,
              ...(widget.props.id === zoneId ? {} :
                {
                  defaultZoneId: zoneId,
                }
              ),
            },
          ],
        };
      }
    }

    return {
      ...model.props,
      zones: {
        ...model.props.zones,
        ...zonesToUpdate,
      },
      draggingWidget: undefined,
    };
  }
}

// tslint:disable-next-line:variable-name
export const Manager = new StateManager();
export default Manager;
