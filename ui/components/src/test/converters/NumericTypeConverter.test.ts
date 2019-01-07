/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IntTypeConverter, FloatTypeConverter } from "../../ui-components";
import TestUtils from "../TestUtils";

describe("IntTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: IntTypeConverter;

  beforeEach(() => {
    converter = new IntTypeConverter();
  });

  describe("convertToString", () => {
    it("returns correct strings", () => {
      expect(converter.convertToString(100)).to.equal("100");
      expect(converter.convertToString("-")).to.equal("0");
    });

    it("returns empty string when value is undefined", () => {
      expect(converter.convertToString(undefined)).to.be.eq("");
    });
  });

  it("convertFromString", () => {
    expect(converter.convertFromString("100")).to.equal(100);
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

  describe("convertToString", () => {
    it("returns correct strings", () => {
      expect(converter.convertToString(100.0)).to.equal("100.0");
      expect(converter.convertToString("-")).to.equal("0.0");
      expect(converter.convertToString(0)).to.equal("0.0");
    });

    it("returns empty string when value is undefined", () => {
      expect(converter.convertToString(undefined)).to.be.eq("");
    });
  });

  it("convertFromString", () => {
    expect(converter.convertFromString("100.0")).to.equal(100.0);
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
