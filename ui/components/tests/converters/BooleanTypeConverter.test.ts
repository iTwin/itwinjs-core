/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BooleanTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("BooleanTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: BooleanTypeConverter;

  beforeEach(() => {
    converter = new BooleanTypeConverter();
  });

  describe("convertToString", () => {
    it("returns parameter value if it's a localized boolean", async () => {
      const trueString = TestUtils.i18n.translate("Components:general.true");
      const falseString = TestUtils.i18n.translate("Components:general.false");
      expect(await converter.convertToString(trueString)).to.eq(trueString);
      expect(await converter.convertToString(falseString)).to.eq(falseString);
    });

    it("returns localized boolean if parameter is boolean", async () => {
      const trueString = TestUtils.i18n.translate("Components:general.true");
      const falseString = TestUtils.i18n.translate("Components:general.false");
      expect(await converter.convertToString(true)).to.eq(trueString);
      expect(await converter.convertToString(false)).to.eq(falseString);
    });

    it("returns localized true value if parameter is truthy", async () => {
      const trueString = TestUtils.i18n.translate("Components:general.true");
      expect(await converter.convertToString("test")).to.eq(trueString);
      expect(await converter.convertToString(5)).to.eq(trueString);
      expect(await converter.convertToString({})).to.eq(trueString);
    });

    it("returns localized false value if parameter is falsy", async () => {
      const falseString = TestUtils.i18n.translate("Components:general.false");
      expect(await converter.convertToString(0)).to.eq(falseString);
    });

    it("returns empty string if provided value is undefined", async () => {
      expect(await converter.convertToString(undefined)).to.eq("");
    });
  });

  describe("convertFromString", () => {

    it("returns true if parameter is localized true value", async () => {
      const trueString = TestUtils.i18n.translate("Components:general.true");
      expect(await converter.convertFromString(trueString)).to.be.true;
      expect(await converter.convertFromString(trueString.toLocaleUpperCase())).to.be.true;
    });

    it("returns false if parameter is not localized true value", async () => {
      expect(await converter.convertFromString("test")).to.be.false;
    });

  });

  describe("isBooleanType", () => {
    it("returns true", () => {
      expect(converter.isBooleanType).to.be.true;
    });
  });

  describe("sortCompare", () => {
    it("returns 0 when boolean values are equal", () => {
      expect(converter.sortCompare(1, {})).to.be.eq(0);
      expect(converter.sortCompare({}, [])).to.be.eq(0);
      expect(converter.sortCompare([], "a")).to.be.eq(0);
    });

    it("returns greater than 0 when first boolean is true and second is false", () => {
      expect(converter.sortCompare(1, 0)).to.be.greaterThan(0);
      expect(converter.sortCompare("a", "")).to.be.greaterThan(0);
    });

    it("returns less than 0 when first boolean is true and second is false", () => {
      expect(converter.sortCompare(0, 1)).to.be.lessThan(0);
      expect(converter.sortCompare("", "a")).to.be.lessThan(0);
    });
  });
});
