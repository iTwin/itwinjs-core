/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ShortDateTypeConverter, DateTimeTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("ShortDateTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: ShortDateTypeConverter;

  beforeEach(() => {
    converter = new ShortDateTypeConverter();
  });

  it("convertToString", async () => {
    // NEEDSWORK - for locales
    expect(await converter.convertToString(new Date(2018, 0, 1))).to.have.length.greaterThan(0);
  });

  it("convertToString passed invalid values", async () => {
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString(undefined)).to.equal("");
  });

  it("convertFromString", async () => {
    const testDate = new Date(2018, 0, 1);
    const convertedDate = await converter.convertFromString("1/1/2018");
    expect(convertedDate.valueOf()).to.eq(testDate.valueOf());
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
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

  it("convertFromString", async () => {
    const testDate = new Date(2018, 0, 1, 1, 15, 30);
    const convertedDate = await converter.convertFromString("1/1/2018 1:15:30 AM");
    expect(convertedDate.valueOf()).to.eq(testDate.valueOf());
  });

});
