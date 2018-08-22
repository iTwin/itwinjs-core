/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { Zone } from "./Zone";
import Cell, { CellProps } from "../../utilities/Cell";
import { UnmergeCell, CellType } from "../target/Unmerge";

export enum DropTarget {
  None,
  Merge,
  Unmerge,
}

export default interface WidgetProps {
  readonly id: number;
  readonly defaultZoneId?: number;
  readonly tabIndex: number;
}

export const getDefaultProps = (id: number): WidgetProps => {
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
    if (cell.isBetween(w0.defaultZone.getCell(), w1.defaultZone.getCell()))
      return true;

    return false;
  }

  private _defaultZone: Zone | undefined = undefined;

  public constructor(public readonly zone: Zone, public readonly props: WidgetProps) {
  }

  public get nineZone() {
    return this.zone.nineZone;
  }

  public get defaultZone(): Zone {
    if (!this._defaultZone)
      this._defaultZone = this.nineZone.getZone(this.props.defaultZoneId || this.props.id);
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

    // Widgets are in the same zone
    if (draggingZone.equals(targetZone))
      if (draggingZone.isFirstWidget(this))
        return DropTarget.Merge;
      else
        return DropTarget.Unmerge;

    if (targetZone.props.widgets.length > 1 && !targetZone.isFirstWidget(this))
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

  public getMergeTargetCells(): CellProps[] {
    const cells = new Array<CellProps>();

    const draggingWidget = this.nineZone.draggingWidget;
    if (!draggingWidget)
      return cells;

    const draggingZone = draggingWidget.zone;
    const draggingCell = draggingZone.getCell();
    const targetZone = this.zone;
    const targetCell = targetZone.getCell();

    if (draggingZone.isFirstWidget(this)) {
      cells.push(draggingZone.getCell());
      for (const widget of draggingZone.getWidgets()) {
        if (cells.length === draggingZone.props.widgets.length)
          break;

        const cell = widget.defaultZone.getCell();
        if (cell.equals(draggingZone.getCell()))
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
          row: widget.defaultZone.getCell().row,
          col: widget.defaultZone.getCell().col,
          type,
        };
        cells.push(unmergeCell);
      }
    } else
      for (const widget of draggingZone.getWidgets()) {
        const cell = widget.defaultZone.getCell();
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
