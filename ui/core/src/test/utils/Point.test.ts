/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point } from "../../core-react";

// cSpell:ignore offsetted

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

  it("should get Euclidean distance to other point", () => {
    const sut = new Point(1, 2);
    const distance = sut.getDistanceTo({ x: -1, y: -2 });
    distance.should.be.closeTo(4.472, 0.001);
  });

  it("should get Manhattan distance to other point", () => {
    const sut = new Point(1, 2);
    sut.getManhattanDistanceTo({ x: -1, y: -2 }).should.eq(6);
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

  it("should set x by returning a new point", () => {
    const sut = new Point(1, 1);
    const result = sut.setX(10);

    sut.x.should.eq(1);
    result.should.not.eq(sut);
    result.x.should.eq(10);
    result.y.should.eq(1);
  });

  it("should set y by returning a new point", () => {
    const sut = new Point(1, 1);
    const result = sut.setY(10);

    sut.y.should.eq(1);
    result.should.not.eq(sut);
    result.x.should.eq(1);
    result.y.should.eq(10);
  });

  it("should multiply point by a given factor", () => {
    const sut = new Point(2, 3);
    const result = sut.multiply(4);
    result.x.should.eq(8);
    result.y.should.eq(12);
  });

  it("should return {x,y} object", () => {
    const sut = new Point(1, 2);
    const props = sut.toProps();
    Object.keys(props).length.should.eq(2);
    props.x.should.eq(1);
    props.y.should.eq(2);
  });
});
