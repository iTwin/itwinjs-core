/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Describes [[Cell]]. */
export interface CellProps {
  row: number;
  col: number;
}

/** Provides methods to work with cells. */
export default class Cell implements CellProps {
  /** Creates cell from [[CellProps]]. */
  public static create(props: CellProps) {
    return new Cell(props.row, props.col);
  }

  private _row: number;
  private _col: number;

  /** @returns Row of this cell. */
  public get row() {
    return this._row;
  }

  /** @returns Column of this cell. */
  public get col() {
    return this._col;
  }

  /** Creates a new cell. */
  public constructor(row: number, col: number) {
    this._row = row;
    this._col = col;
  }

  /** @returns True if this and other cells are equal.  */
  public equals(other: CellProps) {
    return this.row === other.row && this.col === other.col;
  }

  /** @returns True if this and other cells are on same row, but different columns. */
  public isRowAlignedWith(other: CellProps) {
    if (this.row === other.row)
      if (this.col !== other.col)
        return true;
    return false;
  }

  /** @returns True if this and other cells are on same column, but different rows. */
  public isColumnAlignedWith(other: CellProps) {
    if (this.col === other.col)
      if (this.row !== other.row)
        return true;
    return false;
  }

  /** @returns Column aligned cells between this and other cells. */
  public getVerticallyAlignedCellsTo(other: CellProps) {
    const cells: CellProps[] = [];

    if (!this.isColumnAlignedWith(other))
      return cells;

    const diff = this.row > other.row ? -1 : 1;
    for (let i = this.row + diff; i !== other.row; i += diff) {
      cells.push(new Cell(i, this.col));
    }

    return cells;
  }

  /** @returns Row aligned cells between this and other cells. */
  public getHorizontallyAlignedCellsTo(other: CellProps) {
    const cells: CellProps[] = [];

    if (!this.isRowAlignedWith(other))
      return cells;

    const diff = this.col > other.col ? -1 : 1;
    for (let i = this.col + diff; i !== other.col; i += diff) {
      cells.push(new Cell(this.row, i));
    }

    return cells;
  }

  /** @returns Row or column aligned cells between this and other cells. */
  public getAlignedCellsTo(other: CellProps) {
    const cells = this.getHorizontallyAlignedCellsTo(other);
    if (cells.length > 0)
      return cells;

    return this.getVerticallyAlignedCellsTo(other);
  }

  /** @returns True if this cell is between cell1 and cell2 on vertical axis. */
  public isVerticallyBetween(cell1: CellProps, cell2: CellProps) {
    if (this.isColumnAlignedWith(cell1) && this.isColumnAlignedWith(cell2))
      if ((this.row < cell1.row && this.row > cell2.row) || this.row > cell1.row && this.row < cell2.row)
        return true;

    return false;
  }

  /** @returns True if this cell is between cell1 and cell2 on horizontal axis. */
  public isHorizontallyBetween(cell1: CellProps, cell2: CellProps) {
    if (this.isRowAlignedWith(cell1) && this.isRowAlignedWith(cell2))
      if ((this.col < cell1.col && this.col > cell2.col) || this.col > cell1.col && this.col < cell2.col)
        return true;

    return false;
  }

  /** @returns True if this cell is between cell1 and cell2 (column aligned or row aligned).  */
  public isBetween(cell1: CellProps, cell2: CellProps) {
    if (this.isVerticallyBetween(cell1, cell2))
      return true;
    return this.isHorizontallyBetween(cell1, cell2);
  }
}
