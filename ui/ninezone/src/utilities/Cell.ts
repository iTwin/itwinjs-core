/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

export interface CellProps {
  row: number;
  col: number;
}

export default class Cell implements CellProps {
  public static create(props: CellProps) {
    return new Cell(props.row, props.col);
  }

  private _row: number;
  private _col: number;

  public get row() {
    return this._row;
  }

  public get col() {
    return this._col;
  }

  public constructor(row: number, col: number) {
    this._row = row;
    this._col = col;
  }

  public equals(other: CellProps) {
    return this.row === other.row && this.col === other.col;
  }

  public isRowAlignedWith(other: CellProps) {
    if (this.row === other.row)
      if (this.col !== other.col)
        return true;
    return false;
  }

  public isColumnAlignedWith(other: CellProps) {
    if (this.col === other.col)
      if (this.row !== other.row)
        return true;
    return false;
  }

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
