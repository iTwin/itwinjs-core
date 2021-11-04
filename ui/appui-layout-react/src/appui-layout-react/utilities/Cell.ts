/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Describes [[Cell]].
 * @alpha
 */
export interface CellProps {
  /** Cell column. */
  readonly col: number;
  /** Cell row. */
  readonly row: number;
}

/** Provides methods to work with [[CellProps]].
 * @alpha
 */
export class Cell implements CellProps {
  /** Creates cell from [[CellProps]]. */
  public static create(props: CellProps) {
    return new Cell(props.row, props.col);
  }

  /** Creates a new cell. */
  public constructor(public readonly row: number, public readonly col: number) {
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
  public getVerticallyAlignedCellsTo(other: CellProps): CellProps[] {
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
  public getHorizontallyAlignedCellsTo(other: CellProps): CellProps[] {
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
  public getAlignedCellsTo(other: CellProps): CellProps[] {
    const cells = this.getHorizontallyAlignedCellsTo(other);
    if (cells.length > 0)
      return cells;

    return this.getVerticallyAlignedCellsTo(other);
  }

  /** @returns True if this cell is between cell1 and cell2 on vertical axis. */
  public isVerticallyBetween(cell1: CellProps, cell2: CellProps) {
    if (!this.isColumnAlignedWith(cell1) || !this.isColumnAlignedWith(cell2))
      return false;

    const min = Math.min(cell1.row, cell2.row);
    const max = Math.max(cell1.row, cell2.row);
    return this.row > min && this.row < max;
  }

  /** @returns True if this cell is between cell1 and cell2 on horizontal axis. */
  public isHorizontallyBetween(cell1: CellProps, cell2: CellProps) {
    if (!this.isRowAlignedWith(cell1) || !this.isRowAlignedWith(cell2))
      return false;

    const min = Math.min(cell1.col, cell2.col);
    const max = Math.max(cell1.col, cell2.col);
    return this.col > min && this.col < max;
  }

  /** @returns True if this cell is between cell1 and cell2 (column aligned or row aligned).  */
  public isBetween(cell1: CellProps, cell2: CellProps) {
    return this.isVerticallyBetween(cell1, cell2) || this.isHorizontallyBetween(cell1, cell2);
  }
}
