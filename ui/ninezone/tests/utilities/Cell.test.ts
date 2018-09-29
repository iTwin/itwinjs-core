/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Cell from "../../src/utilities/Cell";

describe("Cell", () => {
  it("should specify row and col in constructor", () => {
    const sut = new Cell(5, 4);
    sut.row.should.eq(5);
    sut.col.should.eq(4);
  });

  it("should return true when cells are equal", () => {
    const sut = new Cell(5, 4);
    sut.equals({ row: 5, col: 4 }).should.true;
  });

  it("should return false when cell row differs", () => {
    const sut = new Cell(5, 4);
    sut.equals({ row: 4, col: 4 }).should.false;
  });

  it("should return false when cell col differs", () => {
    const sut = new Cell(5, 4);
    sut.equals({ row: 5, col: 5 }).should.false;
  });

  it("should return false when col and row differs", () => {
    const sut = new Cell(5, 4);
    sut.equals({ row: 4, col: 5 }).should.false;
  });

  it("should return true when cell is between other cells horizontally", () => {
    const sut = new Cell(5, 4);
    sut.isHorizontallyBetween({ row: 5, col: 2 }, { row: 5, col: 10 }).should.true;
  });

  it("should return true when cell is between other cells vertically", () => {
    const sut = new Cell(5, 4);
    sut.isVerticallyBetween({ row: 4, col: 4 }, { row: 6, col: 4 }).should.true;
  });

  it("should return vertically aligned cells to other cell", () => {
    const sut = new Cell(5, 4);
    const cells = sut.getVerticallyAlignedCellsTo({ row: 7, col: 4 });
    cells.length.should.eq(1, "length");
    cells[0].row.should.eq(6, "row");
    cells[0].col.should.eq(4, "col");
  });

  it("should return horizontally aligned cells to other cell", () => {
    const sut = new Cell(5, 4);
    const cells = sut.getHorizontallyAlignedCellsTo({ row: 5, col: 6 });
    cells.length.should.eq(1, "length");
    cells[0].row.should.eq(5, "row");
    cells[0].col.should.eq(5, "col");
  });
});
