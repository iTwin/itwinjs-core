/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ShortDateTypeConverter, DateTimeTypeConverter } from "../../ui-components";
import TestUtils from "../TestUtils";

describe("ShortDateTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: ShortDateTypeConverter;

  beforeEach(() => {
    converter = new ShortDateTypeConverter();
  });

  describe("convertToString", () => {
    it("returns correct string", () => {
      const date = new Date(2018, 0, 1);
      expect(converter.convertToString(date)).to.be.eq(date.toLocaleDateString());
    });

    it("returns empty string if date is undefined", () => {
      expect(converter.convertToString(undefined)).to.be.eq("");
    });

    it("returns formatted date if date is a string", () => {
      const str = "2015 - 06 - 11";
      const date = new Date(str);
      expect(converter.convertToString(str)).to.be.eq(date.toLocaleDateString());
    });
  });

  describe("convertFromString", () => {
    it("returns correct string when proper date string is provided", () => {
      const testDate = new Date(2018, 0, 1);
      const convertedDate = converter.convertFromString("1/1/2018");
      expect(convertedDate).to.not.be.undefined;
      expect(convertedDate!.valueOf()).to.eq(testDate.valueOf());
    });

    it("returns undefined when empty date string is provided", () => {
      const convertedDate = converter.convertFromString("");
      expect(convertedDate).to.be.undefined;
    });

    it("returns undefined when wrong date string is provided", () => {
      const convertedDate = converter.convertFromString("MayFifteenthTwoThousandAndTwo");
      expect(convertedDate).to.be.undefined;
    });
  });

  it("sortCompare", () => {
    expect(converter.sortCompare(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.greaterThan(0);
    expect(converter.sortCompare(new Date(2017, 0, 1), new Date(2018, 0, 1))).to.be.lessThan(0);
    expect(converter.sortCompare(new Date(2018, 0, 1), new Date(2018, 0, 1))).to.be.equal(0);
  });

  it("isLessGreaterType", () => {
    expect(converter.isLessGreaterType).to.be.true;
  });

  it("isLessThan", () => {
    expect(converter.isLessThan(new Date(2017, 0, 1), new Date(2018, 0, 1))).to.be.true;
    expect(converter.isLessThan(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.false;
  });

  it("isLessThanOrEqualTo", () => {
    expect(converter.isLessThanOrEqualTo(new Date(2017, 0, 1), new Date(2018, 0, 1))).to.be.true;
    expect(converter.isLessThanOrEqualTo(new Date(2018, 0, 1), new Date(2018, 0, 1))).to.be.true;
    expect(converter.isLessThanOrEqualTo(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.false;
  });

  it("isGreaterThan", () => {
    expect(converter.isGreaterThan(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.true;
    expect(converter.isGreaterThan(new Date(2017, 0, 1), new Date(2018, 0, 1))).to.be.false;
  });

  it("isGreaterThanOrEqualTo", () => {
    expect(converter.isGreaterThanOrEqualTo(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(new Date(2018, 0, 1), new Date(2018, 0, 1))).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(new Date(2017, 0, 1), new Date(2018, 0, 1))).to.be.false;
  });

  it("isEqualTo", () => {
    expect(converter.isEqualTo(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.false;
    expect(converter.isEqualTo(new Date(2018, 0, 1), new Date(2018, 0, 1))).to.be.true;
  });

  it("isNotEqualTo", () => {
    expect(converter.isNotEqualTo(new Date(2018, 0, 1), new Date(2017, 0, 1))).to.be.true;
    expect(converter.isNotEqualTo(new Date(2018, 0, 1), new Date(2018, 0, 1))).to.be.false;
  });

  it("isLessGreaterType returns true", () => {
    expect(converter.isLessGreaterType).to.be.true;
  });
});

describe("DateTimeTypeConverter", () => {
  let converter: DateTimeTypeConverter;

  beforeEach(() => {
    converter = new DateTimeTypeConverter();
  });

  it("convertToString", () => {
    const testDate = new Date(2018, 0, 1, 1, 15, 30);
    expect(converter.convertToString(testDate)).to.eq(testDate.toLocaleString());
  });

  it("convertFromString", () => {
    const str = "2018-01-01 01:15:30";
    const date = new Date(2018, 0, 1, 1, 15, 30);
    expect(converter.convertFromString(str)!.valueOf()).to.eq(date.valueOf());
  });

});
