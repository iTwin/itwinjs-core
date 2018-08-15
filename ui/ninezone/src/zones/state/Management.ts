/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Cell, { CellProps } from "../../utilities/Cell";
import { PointProps } from "../../utilities/Point";
import Rectangle, { RectangleProps } from "../../utilities/Rectangle";
import { SizeProps } from "../../utilities/Size";
import { ResizeHandle } from "../../widget/rectangular/ResizeHandle";
import { Anchor } from "../../widget/Stacked";
import { UnmergeCell, CellType } from "../target/Unmerge";

import NineZoneProps, { NineZone } from "./NineZone";
import { Widget } from "./Widget";
import ZoneProps from "./Zone";

interface ZoneToWidget {
  zoneId: number;
  widget: Widget | undefined;
}

const zoneToWidgetSortAscending = (a: ZoneToWidget, b: ZoneToWidget): number => {
  return a.zoneId - b.zoneId;
};

export enum DropTarget {
  None,
  Merge,
  Unmerge,
}

export default class Management {
  public static getZoneAnchor(zoneId: number): Anchor {
    switch (zoneId) {
      case 1:
      case 4:
      case 7:
        return Anchor.Left;
      default:
        return Anchor.Right;
    }
  }

  public getZone(zoneId: number, state: NineZoneProps): ZoneProps {
    const model = this.getModel(state);
    return model.getZone(zoneId).props;
  }

  public getDropTarget(widgetId: number, state: NineZoneProps): DropTarget {
    const model = this.getModel(state);
    const draggingWidget = model.getDraggingWidget();
    if (!draggingWidget)
      return DropTarget.None;

    const draggingZone = draggingWidget.zone;
    const targetWidget = model.getWidget(widgetId);
    const targetZone = targetWidget.zone;

    // Widgets are in the same zone
    if (draggingZone.equals(targetZone))
      if (draggingZone.isFirstWidget(targetWidget))
        return DropTarget.Merge;
      else
        return DropTarget.Unmerge;

    if (targetZone.props.widgets.length > 1 && !targetZone.isFirstWidget(targetWidget))
      return DropTarget.None;

    const draggingCell = draggingZone.getCell();
    const targetCell = targetZone.getCell();
    if (draggingCell.isRowAlignedWith(targetCell))
      if (draggingZone.isMergedHorizontally || draggingZone.props.widgets.length === 1)
        if (targetZone.isMergedHorizontally || targetZone.props.widgets.length === 1)
          return DropTarget.Merge;

    if (draggingCell.isColumnAlignedWith(targetCell))
      if (draggingZone.isMergedVertically || draggingZone.props.widgets.length === 1)
        if (targetZone.isMergedVertically || targetZone.props.widgets.length === 1)
          return DropTarget.Merge;

    return DropTarget.None;
  }

  public getMergeTargetCells(widgetId: number, state: NineZoneProps): CellProps[] {
    const model = this.getModel(state);
    const cells = new Array<CellProps>();

    const draggingWidget = model.getDraggingWidget();
    if (!draggingWidget)
      return cells;

    const draggingZone = draggingWidget.zone;
    const draggingCell = draggingZone.getCell();
    const targetWidget = model.getWidget(widgetId);
    const targetZone = targetWidget.zone;
    const targetCell = targetZone.getCell();

    if (draggingZone.isFirstWidget(targetWidget)) {
      cells.push(draggingZone.getCell());
      for (const widget of draggingZone.getWidgets()) {
        if (cells.length === draggingZone.props.widgets.length)
          break;

        const cell = widget.getDefaultZone().getCell();
        if (cell.equals(draggingZone.getCell()))
          continue;
        cells.push(cell);
      }

      const zone5Cell = new Cell(1, 1);
      if (Widget.isCellBetweenWidgets(zone5Cell, draggingZone.getWidgets()))
        cells.push(zone5Cell);
      const zone8Cell = new Cell(2, 1);
      if (model.props.isInFooterMode && Widget.isCellBetweenWidgets(zone8Cell, draggingZone.getWidgets()))
        cells.push(zone8Cell);
    } else
      if (draggingCell.isRowAlignedWith(targetCell)) {
        const min = Math.min(draggingCell.col, targetCell.col);
        const max = Math.max(draggingCell.col, targetCell.col);
        for (let i = min; i <= max; i++)
          cells.push(new Cell(draggingCell.row, i));
      } else if (draggingCell.isColumnAlignedWith(targetCell)) {
        const min = Math.min(draggingCell.row, targetCell.row);
        const max = Math.max(draggingCell.row, targetCell.row);
        for (let i = min; i <= max; i++)
          cells.push(new Cell(i, draggingCell.col));
      }

    return cells;
  }

  public getUnmergeTargetCells(widgetId: number, state: NineZoneProps): UnmergeCell[] {
    const model = this.getModel(state);
    const cells = new Array<UnmergeCell>();

    const draggingWidget = model.getDraggingWidget();
    if (!draggingWidget)
      return cells;

    const draggingZone = draggingWidget.zone;
    const targetWidget = model.getWidget(widgetId);

    // Need to unmerge single widget and keep the other two merged.
    if (draggingZone.props.widgets.length > 2 && draggingZone.isLastWidget(targetWidget)) {
      const widgets = Widget.sort(draggingZone.getWidgets());
      const lastWidget = widgets[widgets.length - 1];
      for (const widget of widgets) {
        let type = CellType.Merge;
        if (widget.equals(lastWidget))
          type = CellType.Unmerge;

        const unmergeCell = {
          row: widget.getDefaultZone().getCell().row,
          col: widget.getDefaultZone().getCell().col,
          type,
        };
        cells.push(unmergeCell);
      }
    } else
      for (const widget of draggingZone.getWidgets()) {
        const cell = widget.getDefaultZone().getCell();
        const unmergeCell = {
          row: cell.row,
          col: cell.col,
          type: CellType.Unmerge,
        };
        cells.push(unmergeCell);
      }

    return cells;
  }

  public onTabClick(widgetId: number, tabIndex: number, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);

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

  public onInitialLayout(size: SizeProps, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);
    model.getRoot().setSize(size);

    const newState: NineZoneProps = {
      ...model.props,
      size: {
        ...size,
      },
      zones: Object.keys(model.props.zones).reduce((acc: { [id: number]: ZoneProps }, key) => {
        const id = Number(key);
        const bounds = model.getZone(id).getLayout().getInitialBounds();
        acc[id] = {
          ...model.props.zones[id],
          bounds,
        };
        return acc;
      }, {}),
    };

    return newState;
  }

  public onResize(zoneId: number, x: number, y: number, handle: ResizeHandle, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);
    model.getZone(zoneId).getLayout().resize(x, y, handle);

    const newState: NineZoneProps = {
      ...model.props,
      zones: Object.keys(model.props.zones).reduce((acc: { [id: number]: ZoneProps }, key) => {
        const id = Number(key);
        const bounds = model.getZone(id).getLayout().bounds;
        acc[id] = {
          ...model.props.zones[id],
          bounds,
        };
        return acc;
      }, {}),
    };

    return newState;
  }

  public onChangeFooterMode(isInFooterMode: boolean, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);
    if (model.getRoot().isInFooterMode === isInFooterMode)
      return { ...model.props };

    model.getRoot().isInFooterMode = isInFooterMode;

    const newState: NineZoneProps = {
      ...model.props,
      isInFooterMode,
      zones: Object.keys(model.props.zones).reduce((acc: { [id: number]: ZoneProps }, key) => {
        const id = Number(key);
        const bounds = model.getZone(id).getLayout().getInitialBounds();
        acc[id] = {
          ...model.props.zones[id],
          bounds,
        };
        return acc;
      }, {}),
    };

    return newState;
  }

  public onDragBehaviorChanged(widgetId: number, isDragging: boolean, state: NineZoneProps) {
    const model = this.getModel(state);

    if (model.props.targetedZone) {
      switch (model.props.targetedZone.target) {
        case DropTarget.Merge: {
          return this.mergeDrop(model.props.targetedZone.widgetId, state);
        }
        case DropTarget.Unmerge: {
          return this.unmergeDrop(model.props.targetedZone.widgetId, state);
        }
        default:
          break;
      }
    }

    return this.changeDraggingWidget(widgetId, isDragging, state);
  }

  public changeDraggingWidget(widgetId: number, isDragging: boolean, state: NineZoneProps) {
    const model = this.getModel(state);

    const widget = model.getWidget(widgetId);
    const zone = widget.zone;

    if (!zone.isWidgetOpen)
      return { ...model.props };

    let floatingBounds = zone.props.floatingBounds;
    if (isDragging && !zone.props.floatingBounds)
      floatingBounds = zone.props.bounds;

    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [zone.props.id]: {
          ...model.props.zones[zone.props.id],
          floatingBounds,
        },
      },
      draggingWidgetId: isDragging ? widgetId : undefined,
    };

    return newState;
  }

  public mergeDrop(targetWidgetId: number, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);

    const draggingWidget = model.getDraggingWidget();
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
        draggingWidgetId: undefined,
      };

    const zonesToUpdate: { [id: number]: ZoneProps } = {};
    const bounds = Rectangle.create(draggingZone.props.bounds).outerMergeWith(targetZone.props.bounds);

    const alignedCells = targetZone.getCell().getAlignedCellsTo(draggingZone.getCell());
    const alignedCellsFiltered = alignedCells.filter((cell) => {
      if (cell.col === 1 && cell.row === 1)
        return false;
      if (model.props.isInFooterMode && cell.col === 1 && cell.row === 2)
        return false;
      return true;
    });
    const alignedZones = alignedCellsFiltered.map((cell) => model.findZone(cell));
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
              if (w.equals(draggingWidget))
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
      draggingWidgetId: undefined,
    };
  }

  public unmergeDrop(targetWidgetId: number, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);

    const draggingWidget = model.getDraggingWidget();
    if (!draggingWidget)
      return { ...state };

    const zonesToUpdate: { [id: number]: ZoneProps } = {};
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

      zonesToUpdate[first.getDefaultZone().props.id] = {
        ...model.props.zones[first.getDefaultZone().props.id],
        bounds: mergedZonesBounds,
        floatingBounds: undefined,
        widgets: widgets.filter((w) => !w.equals(last)).map((w) => w.props),
      };
      zonesToUpdate[last.getDefaultZone().props.id] = {
        ...model.props.zones[last.getDefaultZone().props.id],
        bounds: unmergedZoneBounds,
        floatingBounds: undefined,
        widgets: [last.props],
      };
    } else {
      const targetIndex = draggingZone.getWidgets().findIndex((w) => w.equals(targetWidget));
      const widgetsToUnmerge = draggingZone.getWidgets().slice().filter((w) => !w.equals(draggingWidget));
      const zoneSlots = widgets.map((w) => w.getDefaultZone().props.id).filter((_id, index) => index !== targetIndex);

      const zoneToWidgetArray: ZoneToWidget[] = [
        ...zoneSlots.map((zoneSlot, index) => ({
          zoneId: zoneSlot,
          widget: widgetsToUnmerge[index],
        })),
        {
          zoneId: widgets[targetIndex].getDefaultZone().props.id,
          widget: draggingWidget,
        },
        ...(Widget.isCellBetweenWidgets(new Cell(1, 1), widgets) ?
          [
            {
              zoneId: 5,
              widget: undefined,
            },
          ] : []),
        ...(model.props.isInFooterMode && Widget.isCellBetweenWidgets(new Cell(2, 1), widgets) ?
          [
            {
              zoneId: 8,
              widget: undefined,
            },
          ] : []),
      ].sort(zoneToWidgetSortAscending);

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
      draggingWidgetId: undefined,
    };
  }

  public onWidgetTabDrag(dragged: PointProps, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);
    const draggingWidget = model.getDraggingWidget();

    if (!draggingWidget)
      return { ...model.props };

    const draggingZone = draggingWidget.zone;
    if (!draggingZone.props.floatingBounds)
      return { ...model.props };

    const newBounds = Rectangle.create(draggingZone.props.floatingBounds).offset(dragged);
    const newState: NineZoneProps = {
      ...model.props,
      zones: {
        ...model.props.zones,
        [draggingZone.props.id]: {
          ...model.props.zones[draggingZone.props.id],
          floatingBounds: newBounds,
        },
      },
    };

    return newState;
  }

  public onTargetChanged(widgetId: number | undefined, target: DropTarget, state: NineZoneProps): NineZoneProps {
    const model = this.getModel(state);
    const draggingWidget = model.getDraggingWidget();

    if (!draggingWidget || !widgetId)
      return {
        ...state,
        targetedZone: undefined,
      };

    return {
      ...state,
      targetedZone: {
        widgetId,
        target,
      },
    };
  }

  public getGhostOutlineBounds(zoneId: number, state: NineZoneProps): RectangleProps | undefined {
    const model = this.getModel(state);

    if (!model.props.targetedZone)
      return undefined;

    const draggingWidget = model.getDraggingWidget();
    const widgetId = model.props.targetedZone.widgetId;

    if (!draggingWidget)
      return undefined;

    const targetWidget = model.getWidget(widgetId);
    const targetZone = targetWidget.zone;
    const draggingZone = draggingWidget.zone;

    switch (model.props.targetedZone.target) {
      case DropTarget.Merge: {
        const draggingZoneBounds = Rectangle.create(draggingZone.props.bounds);
        const mergedBounds = draggingZoneBounds.outerMergeWith(targetZone.props.bounds);
        if (widgetId === zoneId)
          return mergedBounds;
        break;
      }
      case DropTarget.Unmerge: {
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

          if (first.getDefaultZone().props.id === zoneId)
            return mergedZonesBounds;
          if (last.getDefaultZone().props.id === zoneId)
            return unmergedZoneBounds;
        } else {
          const zoneToWidgetArray =
            (
              [
                ...widgets.map((widget) => ({
                  zoneId: widget.getDefaultZone().props.id,
                  widget,
                })),
                ...(Widget.isCellBetweenWidgets(new Cell(1, 1), widgets) ? [{
                  zoneId: 5,
                  widget: undefined,
                }] : []),
                ...(model.props.isInFooterMode && Widget.isCellBetweenWidgets(new Cell(2, 1), widgets) ? [{
                  zoneId: 8,
                  widget: undefined,
                }] : []),
              ] as ZoneToWidget[]
            ).sort(zoneToWidgetSortAscending);

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

            if (zoneToWidget.widget.getDefaultZone().props.id === zoneId)
              return bounds;
          }
        }
        break;
      }
    }

    return undefined;
  }

  protected getModel(state: NineZoneProps) {
    return new NineZone(state);
  }
}
