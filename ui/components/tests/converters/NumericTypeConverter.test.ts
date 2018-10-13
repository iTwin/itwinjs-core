/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IntTypeConverter, FloatTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("IntTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: IntTypeConverter;

  beforeEach(() => {
    converter = new IntTypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString(100)).to.equal("100");
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString("-")).to.equal("0");
  });

  it("convertFromString", async () => {
    expect(await converter.convertFromString("100")).to.equal(100);
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
  });

  it("sortCompare", () => {
    expect(converter.sortCompare(100, 99)).to.be.greaterThan(0);
    expect(converter.sortCompare(99, 100)).to.be.lessThan(0);
    expect(converter.sortCompare(100, 100)).to.equal(0);
  });

  it("isLessGreaterType", () => {
    expect(converter.isLessGreaterType).to.be.true;
  });

  it("isLessThan", () => {
    expect(converter.isLessThan(0, 1)).to.be.true;
    expect(converter.isLessThan(1, 0)).to.be.false;
  });

  it("isLessThanOrEqualTo", () => {
    expect(converter.isLessThanOrEqualTo(0, 1)).to.be.true;
    expect(converter.isLessThanOrEqualTo(0, 0)).to.be.true;
    expect(converter.isLessThanOrEqualTo(1, 0)).to.be.false;
  });

  it("isGreaterThan", () => {
    expect(converter.isGreaterThan(1, 0)).to.be.true;
    expect(converter.isGreaterThan(0, 1)).to.be.false;
  });

  it("isGreaterThanOrEqualTo", () => {
    expect(converter.isGreaterThanOrEqualTo(1, 0)).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(1, 1)).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(0, 1)).to.be.false;
  });

  it("isEqualTo", () => {
    expect(converter.isEqualTo(0, 0)).to.be.true;
    expect(converter.isEqualTo(1, 0)).to.be.false;
  });

  it("isNotEqualTo", () => {
    expect(converter.isNotEqualTo(0, 0)).to.be.false;
    expect(converter.isNotEqualTo(1, 0)).to.be.true;
  });

});

describe("FloatTypeConverter", () => {
  let converter: FloatTypeConverter;

  beforeEach(() => {
    converter = new FloatTypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString(100.0)).to.equal("100.0");
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString("-")).to.equal("0.0");
    expect(await converter.convertToString(0)).to.equal("0.0");
  });

  it("convertFromString", async () => {
    expect(await converter.convertFromString("100.0")).to.equal(100.0);
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
  });

  it("sortCompare", () => {
    expect(converter.sortCompare(100, 99)).to.be.greaterThan(0);
    expect(converter.sortCompare(99, 100)).to.be.lessThan(0);
    expect(converter.sortCompare(100, 100)).to.equal(0);
  });

  it("isLessGreaterType", () => {
    expect(converter.isLessGreaterType).to.be.true;
  });

  it("isLessThan", () => {
    expect(converter.isLessThan(0, 1)).to.be.true;
    expect(converter.isLessThan(1, 0)).to.be.false;
  });

  it("isLessThanOrEqualTo", () => {
    expect(converter.isLessThanOrEqualTo(0, 1)).to.be.true;
    expect(converter.isLessThanOrEqualTo(0, 0)).to.be.true;
    expect(converter.isLessThanOrEqualTo(1, 0)).to.be.false;
  });

  it("isGreaterThan", () => {
    expect(converter.isGreaterThan(1, 0)).to.be.true;
    expect(converter.isGreaterThan(0, 1)).to.be.false;
  });

  it("isGreaterThanOrEqualTo", () => {
    expect(converter.isGreaterThanOrEqualTo(1, 0)).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(1, 1)).to.be.true;
    expect(converter.isGreaterThanOrEqualTo(0, 1)).to.be.false;
  });

});
