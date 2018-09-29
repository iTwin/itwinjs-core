/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Point from "../../src/utilities/Point";

describe("Point", () => {
  it("unspecified coordinates should be 0", () => {
    const sut = new Point();
    sut.x.should.eq(0);
    sut.y.should.eq(0);
  });

  it("should specify coordinates in constructor", () => {
    const sut = new Point(5, 4);
    sut.x.should.eq(5);
    sut.y.should.eq(4);
  });

  it("should specify coordinates in constructor", () => {
    const sut = new Point(5, 4);
    sut.x.should.eq(5);
    sut.y.should.eq(4);
  });

  it("should create point from point props", () => {
    const sut = Point.create({ x: 1, y: 2 });
    sut.x.should.eq(1);
    sut.y.should.eq(2);
  });

  it("should get distance to other point", () => {
    const sut = Point.create({ x: 1, y: 2 });
    sut.getDistanceTo({ x: -1, y: 2 }).should.eq(2);
  });

  it("should get offset to other point", () => {
    const sut = new Point(1, 2);
    const offset = sut.getOffsetTo({ x: 5, y: 10 });
    offset.x.should.eq(4);
    offset.y.should.eq(8);
  });

  it("should return offsetted point", () => {
    const sut = new Point(1, 2);
    const offsetted = sut.offset({ x: 5, y: 10 });
    offsetted.x.should.eq(6);
    offsetted.y.should.eq(12);
  });

  it("should return X offsetted point", () => {
    const sut = new Point(1, 2);
    const offsetted = sut.offsetX(3);
    offsetted.x.should.eq(4);
    offsetted.y.should.eq(2);
  });

  it("should return Y offsetted point", () => {
    const sut = new Point(1, 2);
    const offsetted = sut.offsetY(3);
    offsetted.x.should.eq(1);
    offsetted.y.should.eq(5);
  });

  it("should return true if other point is equal", () => {
    const sut = new Point(1, 2);
    sut.equals({ x: 1, y: 2 }).should.true;
  });

  it("should return false if other point X is not equal", () => {
    const sut = new Point(2, 2);
    sut.equals({ x: 1, y: 2 }).should.false;
  });

  it("should return false if other point Y is not equal", () => {
    const sut = new Point(1, 1);
    sut.equals({ x: 1, y: 2 }).should.false;
  });
});
