/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { WidgetZone } from "./Zone";
import Cell, { CellProps } from "../../utilities/Cell";
import { UnmergeCell, CellType } from "../target/Unmerge";
import { WidgetZoneIndex } from "./NineZone";

export enum DropTarget {
  None,
  Merge,
  Unmerge,
}

export default interface WidgetProps {
  readonly id: WidgetZoneIndex;
  readonly defaultZoneId?: WidgetZoneIndex;
  readonly tabIndex: number;
}

export const getDefaultProps = (id: WidgetZoneIndex): WidgetProps => {
  return {
    id,
    tabIndex: -1,
  };
};

export class Widget {
  public static sort(widgets: ReadonlyArray<Widget>) {
    return widgets.slice().sort((a, b) => a.defaultZone.props.id - b.defaultZone.props.id);
  }

  public static isCellBetweenWidgets(cell: Cell, widgets: ReadonlyArray<Widget>) {
    if (widgets.length !== 2)
      return false;

    const w0 = widgets[0];
    const w1 = widgets[1];
    if (cell.isBetween(w0.defaultZone.cell, w1.defaultZone.cell))
      return true;

    return false;
  }

  private _defaultZone: WidgetZone | undefined = undefined;

  public constructor(public readonly zone: WidgetZone, public readonly props: WidgetProps) {
  }

  public get nineZone() {
    return this.zone.nineZone;
  }

  public get defaultZone(): WidgetZone {
    if (!this._defaultZone)
      this._defaultZone = this.nineZone.getWidgetZone(this.props.defaultZoneId || this.props.id);
    return this._defaultZone;
  }

  public equals(other: Widget) {
    return this.props.id === other.props.id;
  }

  public getDropTarget(): DropTarget {
    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return DropTarget.None;

    const draggingZone = draggingWidget.zone;
    const targetZone = this.zone;
    if (!targetZone.isMergeable)
      return DropTarget.None;

    // Widgets are in the same zone
    if (draggingZone.equals(targetZone))
      if (draggingZone.isFirstWidget(this))
        return DropTarget.Merge;
      else
        return DropTarget.Unmerge;

    if (targetZone.props.widgets.length > 1 && !targetZone.isFirstWidget(this))
      return DropTarget.None;

    const draggingCell = draggingZone.cell;
    const targetCell = targetZone.cell;
    const zone5Cell = this.nineZone.getZone(5).cell;
    if (zone5Cell.isBetween(draggingCell, targetCell))
      return DropTarget.None;

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

  public getMergeTargetCells(): CellProps[] {
    const cells = new Array<CellProps>();

    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return cells;

    const draggingZone = draggingWidget.zone;
    const draggingCell = draggingZone.cell;
    const targetZone = this.zone;
    const targetCell = targetZone.cell;

    if (draggingZone.isFirstWidget(this)) {
      cells.push(draggingZone.cell);
      for (const widget of draggingZone.getWidgets()) {
        if (cells.length === draggingZone.props.widgets.length)
          break;

        const cell = widget.defaultZone.cell;
        if (cell.equals(draggingZone.cell))
          continue;
        cells.push(cell);
      }

      const zone5Cell = new Cell(1, 1);
      if (Widget.isCellBetweenWidgets(zone5Cell, draggingZone.getWidgets()))
        cells.push(zone5Cell);
      const zone8Cell = new Cell(2, 1);
      if (this.nineZone.props.isInFooterMode && Widget.isCellBetweenWidgets(zone8Cell, draggingZone.getWidgets()))
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

  public getUnmergeTargetCells(): UnmergeCell[] {
    const cells = new Array<UnmergeCell>();

    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return cells;

    const draggingZone = draggingWidget.zone;

    // Need to unmerge single widget and keep the other two merged.
    if (draggingZone.props.widgets.length > 2 && draggingZone.isLastWidget(this)) {
      const widgets = Widget.sort(draggingZone.getWidgets());
      const lastWidget = widgets[widgets.length - 1];
      for (const widget of widgets) {
        let type = CellType.Merge;
        if (widget.equals(lastWidget))
          type = CellType.Unmerge;

        const unmergeCell = {
          row: widget.defaultZone.cell.row,
          col: widget.defaultZone.cell.col,
          type,
        };
        cells.push(unmergeCell);
      }
    } else
      for (const widget of draggingZone.getWidgets()) {
        const cell = widget.defaultZone.cell;
        const unmergeCell = {
          row: cell.row,
          col: cell.col,
          type: CellType.Unmerge,
        };
        cells.push(unmergeCell);
      }

    return cells;
  }
}
