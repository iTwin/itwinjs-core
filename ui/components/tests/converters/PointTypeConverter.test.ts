/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point2dTypeConverter, Point3dTypeConverter, ConvertedPrimitives } from "../../src/index";
import TestUtils from "../TestUtils";

describe("Point2dTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: Point2dTypeConverter;

  beforeEach(() => {
    converter = new Point2dTypeConverter();
  });

  describe("convertToString", () => {
    it("returns correct string", async () => {
      expect(await converter.convertToString(["50", "100"])).to.equal("50, 100");
    });

    it("returns empty string if value is undefined", async () => {
      expect(await converter.convertToString(undefined)).to.equal("");
    });
  });

  describe("convertFromString", () => {
    it("returns correct object", async () => {
      const point2d = await converter.convertFromString("50, 100");

      expect(point2d).to.not.be.undefined;
      expect(point2d!.x).to.equal(50);
      expect(point2d!.y).to.equal(100);
    });

    it("returns undefined if string is wrong", async () => {
      expect(await converter.convertFromString("50, 100, 150")).to.be.undefined;
    });
  });

  describe("sortCompare", () => {
    it("returns less than 0 when first value is invalid", async () => {
      expect(await converter.sortCompare(["a", "b", "c"], ["1", "2"])).to.be.lessThan(0);
    });

    it("returns greater than 0 when second value is invalid", async () => {
      expect(await converter.sortCompare(["1", "2"], ["a", "b", "c"])).to.be.greaterThan(0);
    });

    it("returns 0 if points are mirrored", async () => {
      expect(await converter.sortCompare(["1", "1"], ["-1", "-1"])).to.be.eq(0);
    });

    it("returns less than 0 if second point is further from [0,0]", async () => {
      expect(await converter.sortCompare(["1", "1"], ["2", "2"])).to.be.lessThan(0);
    });

    it("returns greater than 0 if first point is further from [0,0]", async () => {
      expect(await converter.sortCompare(["2", "2"], ["1", "1"])).to.be.greaterThan(0);
    });
  });

});

describe("Point3dTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: Point3dTypeConverter;

  beforeEach(() => {
    converter = new Point3dTypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString(["50", "100", "150"])).to.equal("50, 100, 150");
  });

  describe("convertFromString", () => {
    it("returns correct object", async () => {
      const point3d = await converter.convertFromString("50, 100, 150") as ConvertedPrimitives.Point3d;

      expect(point3d).to.not.be.undefined;
      expect(point3d.x).to.equal(50);
      expect(point3d.y).to.equal(100);
      expect(point3d.z).to.equal(150);
    });

    it("returns undefined if string is wrong", async () => {
      expect(await converter.convertFromString("50, 100")).to.be.undefined;
    });
  });

  describe("sortCompare", () => {
    it("returns less than 0 when first value is invalid", async () => {
      expect(await converter.sortCompare(["a", "b", "c"], ["1", "2", "1"])).to.be.lessThan(0);
    });

    it("returns 0 if points are mirrored", async () => {
      expect(await converter.sortCompare(["1", "1", "-2"], ["-1", "-1", "2"])).to.be.eq(0);
    });

    it("returns less than 0 if second point is further from [0,0,0]", async () => {
      expect(await converter.sortCompare(["1", "1", "1"], ["2", "2", "2"])).to.be.lessThan(0);
    });

    it("returns greater than 0 if first point is further from [0,0,0]", async () => {
      expect(await converter.sortCompare(["2", "2", "2"], ["1", "1", "1"])).to.be.greaterThan(0);
    });
  });
});
