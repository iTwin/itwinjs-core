/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { RectangleProps } from "../../core-react";
import { Corner, Point, Rectangle } from "../../core-react";

// cSpell:ignore offsetted

describe("Rectangle", () => {
  it("unspecified bounds should be 0", () => {
    const sut = new Rectangle();
    sut.left.should.eq(0);
    sut.top.should.eq(0);
    sut.right.should.eq(0);
    sut.bottom.should.eq(0);
  });

  it("should specify bounds while constructing", () => {
    const sut = new Rectangle(1, 2, 3, 4);
    sut.left.should.eq(1);
    sut.top.should.eq(2);
    sut.right.should.eq(3);
    sut.bottom.should.eq(4);
  });

  it("should create from size with left top at (0, 0)", () => {
    const sut = Rectangle.createFromSize({ width: 10, height: 15 });
    sut.left.should.eq(0);
    sut.top.should.eq(0);
    sut.right.should.eq(10);
    sut.bottom.should.eq(15);
  });

  it("should get size of this rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const size = sut.getSize();
    size.width.should.eq(10);
    size.height.should.eq(2);
  });

  it("should get top left corner", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const corner = sut.getCorner(Corner.TopLeft);
    corner.x.should.eq(-5);
    corner.y.should.eq(2);
  });

  it("should get top right corner", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const corner = sut.getCorner(Corner.TopRight);
    corner.x.should.eq(5);
    corner.y.should.eq(2);
  });

  it("should get bottom left corner", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const corner = sut.getCorner(Corner.BottomLeft);
    corner.x.should.eq(-5);
    corner.y.should.eq(4);
  });

  it("should get bottom right corner", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const corner = sut.getCorner(Corner.BottomRight);
    corner.x.should.eq(5);
    corner.y.should.eq(4);
  });

  it("should return offsetted rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const offsetted = sut.offset({ x: 2, y: 3 });
    offsetted.left.should.eq(-3);
    offsetted.top.should.eq(5);
    offsetted.right.should.eq(7);
    offsetted.bottom.should.eq(7);
  });

  it("should return X offsetted rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const offsetted = sut.offsetX(3);
    offsetted.left.should.eq(-2);
    offsetted.top.should.eq(2);
    offsetted.right.should.eq(8);
    offsetted.bottom.should.eq(4);
  });

  it("should return Y offsetted rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const offsetted = sut.offsetY(3);
    offsetted.left.should.eq(-5);
    offsetted.top.should.eq(5);
    offsetted.right.should.eq(5);
    offsetted.bottom.should.eq(7);
  });

  it("should return rectangle with specified height, but with same left and top bounds", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const offsetted = sut.setHeight(1);
    offsetted.left.should.eq(-5);
    offsetted.top.should.eq(2);
    offsetted.right.should.eq(5);
    offsetted.bottom.should.eq(3);
  });

  it("should return rectangle with new size", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const newRect = sut.setSize({
      height: 100,
      width: 150,
    });
    newRect.left.should.eq(-5);
    newRect.top.should.eq(2);
    newRect.right.should.eq(145);
    newRect.bottom.should.eq(102);
  });

  it("should return true if other rectangle is equal", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const other: RectangleProps = {
      left: -5,
      top: 2,
      right: 5,
      bottom: 8,
    };
    sut.equals(other).should.true;
  });

  it("should return false if left bound of other rectangle is not equal", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const other: RectangleProps = {
      left: 5,
      top: 2,
      right: 5,
      bottom: 8,
    };
    sut.equals(other).should.false;
  });

  it("should return false if top bound of other rectangle is not equal", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const other: RectangleProps = {
      left: 5,
      top: 6,
      right: 5,
      bottom: 8,
    };
    sut.equals(other).should.false;
  });

  it("should return false if right bound of other rectangle is not equal", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const other: RectangleProps = {
      left: 5,
      top: 6,
      right: 6,
      bottom: 8,
    };
    sut.equals(other).should.false;
  });

  it("should return false if bottom bound of other rectangle is not equal", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    const other: RectangleProps = {
      left: 5,
      top: 6,
      right: 5,
      bottom: 10,
    };
    sut.equals(other).should.false;
  });

  it("should return true if rectangle contains the point", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    sut.containsPoint({ x: 2, y: 2 }).should.true;
  });

  it("should return false if rectangle does not contain the point", () => {
    const sut = new Rectangle(-5, 0, 5, 1);
    sut.containsPoint({ x: 2, y: 2 }).should.false;
  });

  it("should return true if rectangle contains the x,y", () => {
    const sut = new Rectangle(-5, 2, 5, 8);
    sut.containsXY(2, 2).should.true;
  });

  it("should return false if rectangle does not contain the x,y", () => {
    const sut = new Rectangle(-5, 0, 5, 1);
    sut.containsXY(2, 2).should.false;
  });

  it("should return true if rectangle contains other rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 7);
    const other: RectangleProps = {
      left: -4,
      top: 3,
      right: 4,
      bottom: 6,
    };
    sut.contains(other).should.true;
  });

  it("should return false if rectangle does not contain other rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 7);
    const other: RectangleProps = {
      left: -4,
      top: 3,
      right: 4,
      bottom: 8,
    };
    sut.contains(other).should.false;
  });

  it("should get top left point", () => {
    const sut = new Rectangle(-5, 2, 5, 4);
    const topLeft = sut.topLeft();
    topLeft.x.should.eq(-5);
    topLeft.y.should.eq(2);
  });

  it("should return true if rectangle intersects other rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 7);
    const other: RectangleProps = {
      left: -4,
      top: 3,
      right: 4,
      bottom: 8,
    };
    sut.intersects(other).should.true;
  });

  it("should return false if rectangle does not intersect other rectangle", () => {
    const sut = new Rectangle(-5, 2, 5, 7);
    const other: RectangleProps = {
      left: -4,
      top: 3,
      right: 4,
      bottom: 6,
    };
    sut.intersects(other).should.true;
  });

  it("should outer merge with other rectangle", () => {
    const sut = new Rectangle(0, 5, 10, 20);
    const other: RectangleProps = {
      left: 0,
      top: 20,
      right: 10,
      bottom: 30,
    };
    const merged = sut.outerMergeWith(other);
    merged.left.should.eq(0);
    merged.top.should.eq(5);
    merged.right.should.eq(10);
    merged.bottom.should.eq(30);
  });

  it("should return new positioned rectangle", () => {
    const sut = new Rectangle(0, 5, 10, 20);
    const positioned = sut.setPosition({ x: 10, y: 1 });

    sut.should.not.eq(positioned);
    positioned.left.should.eq(10);
    positioned.top.should.eq(1);
    positioned.right.should.eq(20);
    positioned.bottom.should.eq(16);
  });

  it("should contain vertically in rectangle", () => {
    const sut = new Rectangle(1, 5, 11, 17);
    const contained = sut.containVerticallyIn({
      left: 2,
      top: 8,
      right: 10,
      bottom: 12,
    });

    contained.left.should.eq(1);
    contained.right.should.eq(11);
    contained.top.should.eq(8);
    contained.bottom.should.eq(20);
  });

  it("should contain horizontally in rectangle", () => {
    const sut = new Rectangle(1, 5, 11, 17);
    const contained = sut.containHorizontallyIn({
      left: 2,
      top: 8,
      right: 10,
      bottom: 12,
    });

    contained.left.should.eq(2);
    contained.right.should.eq(12);
    contained.top.should.eq(5);
    contained.bottom.should.eq(17);
  });

  it("create should create rectangle", () => {
    const sut = Rectangle.create({ left: 1, top: 2, right: 3, bottom: 4 });
    sut.left.should.eq(1);
    sut.top.should.eq(2);
    sut.right.should.eq(3);
    sut.bottom.should.eq(4);
  });

  it("inset should return updated rectangle", () => {
    const sut = new Rectangle(0, 0, 10, 10);
    const sut2 = sut.inset(1, 2, 3, 4);
    sut2.left.should.eq(1);
    sut2.top.should.eq(2);
    sut2.right.should.eq(7);
    sut2.bottom.should.eq(6);
  });

  it("setWidth should update width", () => {
    const sut = new Rectangle(0, 0, 10, 10);
    const sut2 = sut.setWidth(20);
    sut2.right.should.eq(20);
  });

  it("containIn should return correct rectangle", () => {
    const sut1 = Rectangle.create({ left: 0, top: 0, right: 10, bottom: 10 });
    const sut2 = Rectangle.create({ left: 5, top: 5, right: 20, bottom: 20 });
    const result = sut1.containIn(sut2);
    expect(result.equals(new Rectangle(5, 5, 15, 15))).to.be.true;
  });

  it("center should return correct point", () => {
    const sut = new Rectangle(0, 0, 10, 10);
    const result = sut.center();
    expect(result.equals(new Point(5, 5))).to.be.true;
  });

  it("toProps should return correct props", () => {
    const sut = new Rectangle(0, 5, 10, 20);
    const props = sut.toProps();
    props.left.should.eq(0);
    props.top.should.eq(5);
    props.right.should.eq(10);
    props.bottom.should.eq(20);
  });

  it("getVerticalSegmentBounds should return correct point", () => {
    const sut = new Rectangle(0, 0, 30, 30);
    let result = sut.getVerticalSegmentBounds(0, 3);
    expect(result.equals(new Rectangle(0, 0, 30, 10))).to.be.true;
    result = sut.getVerticalSegmentBounds(1, 3);
    expect(result.equals(new Rectangle(0, 10, 30, 20))).to.be.true;
    result = sut.getVerticalSegmentBounds(2, 3);
    expect(result.equals(new Rectangle(0, 20, 30, 30))).to.be.true;
  });

  it("getHorizontalSegmentBounds should return correct point", () => {
    const sut = new Rectangle(0, 0, 30, 30);
    let result = sut.getHorizontalSegmentBounds(0, 3);
    expect(result.equals(new Rectangle(0, 0, 10, 30))).to.be.true;
    result = sut.getHorizontalSegmentBounds(1, 3);
    expect(result.equals(new Rectangle(10, 0, 20, 30))).to.be.true;
    result = sut.getHorizontalSegmentBounds(2, 3);
    expect(result.equals(new Rectangle(20, 0, 30, 30))).to.be.true;
  });

  it("getShortestDistanceToPoint should return correct distance", () => {
    const sut = new Rectangle(10, 10, 30, 30);

    let result = sut.getShortestDistanceToPoint(new Point(10, 0));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(30, 0));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(0, 10));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(40, 10));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(10, 40));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(30, 40));
    expect(result).to.eq(10);

    result = sut.getShortestDistanceToPoint(new Point(0, 20));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(40, 20));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(20, 0));
    expect(result).to.eq(10);
    result = sut.getShortestDistanceToPoint(new Point(40, 20));
    expect(result).to.eq(10);

    const isoscelesLength = 14.142135623730951;
    result = sut.getShortestDistanceToPoint(new Point(0, 0));
    expect(result).to.eq(isoscelesLength);
    result = sut.getShortestDistanceToPoint(new Point(40, 0));
    expect(result).to.eq(isoscelesLength);
    result = sut.getShortestDistanceToPoint(new Point(0, 40));
    expect(result).to.eq(isoscelesLength);
    result = sut.getShortestDistanceToPoint(new Point(40, 40));
    expect(result).to.eq(isoscelesLength);

    result = sut.getShortestDistanceToPoint(new Point(20, 20));
    expect(result).to.eq(0);
  });

});
