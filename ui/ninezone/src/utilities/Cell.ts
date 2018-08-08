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

  /** @returns Row or column aligned cells between this and other cells. */
  public getAlignedCellsTo(other: CellProps) {
    const cells: CellProps[] = [];

    cells.push(new Cell(this.row, this.col));

    if (this.isRowAlignedWith(other)) {
      let diff = 1;
      if (this.col > other.col)
        diff = -1;

      let i = this.col;
      do {
        i += diff;
        cells.push(new Cell(this.row, i));
      } while (i !== other.col);
    } else if (this.isColumnAlignedWith(other)) {
      let diff = 1;
      if (this.row > other.row)
        diff = -1;

      let i = this.row;
      do {
        i += diff;
        cells.push(new Cell(i, this.col));
      } while (i !== other.row);
    }

    return cells;
  }

  /** @returns True if this cell is between cell1 and cell2 (column aligned or row aligned).  */
  public isBetween(cell1: CellProps, cell2: CellProps) {
    const c1 = Cell.create(cell1);
    if (c1.isRowAlignedWith(cell2) && this.row === c1.row) {
      if ((this.col < cell1.col && this.col > cell2.col) || this.col > cell1.col && this.col < cell2.col)
        return true;
    } else if (c1.isColumnAlignedWith(cell2) && this.col === c1.col)
      if ((this.row < cell1.row && this.row > cell2.row) || this.row > cell1.row && this.row < cell2.row)
        return true;

    return false;
  }
}

export class CellPropsHelpers {
  public static createCell(cellProps: CellProps): Cell {
    return new Cell(cellProps.row, cellProps.col);
  }
}
