/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BooleanTypeConverter } from "../../components-react";
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
    it("returns parameter value if it's a localized boolean", () => {
      const trueString = TestUtils.i18n.getLocalizedString("Components:general.true");
      const falseString = TestUtils.i18n.getLocalizedString("Components:general.false");
      expect(converter.convertToString(trueString)).to.eq(trueString);
      expect(converter.convertToString(falseString)).to.eq(falseString);
    });

    it("returns localized boolean if parameter is boolean", () => {
      const trueString = TestUtils.i18n.getLocalizedString("Components:general.true");
      const falseString = TestUtils.i18n.getLocalizedString("Components:general.false");
      expect(converter.convertToString(true)).to.eq(trueString);
      expect(converter.convertToString(false)).to.eq(falseString);
    });

    it("returns localized true value if parameter is truthy", () => {
      const trueString = TestUtils.i18n.getLocalizedString("Components:general.true");
      expect(converter.convertToString("test")).to.eq(trueString);
      expect(converter.convertToString(5)).to.eq(trueString);
      expect(converter.convertToString({})).to.eq(trueString);
    });

    it("returns localized false value if parameter is falsy", () => {
      const falseString = TestUtils.i18n.getLocalizedString("Components:general.false");
      expect(converter.convertToString(0)).to.eq(falseString);
    });

    it("returns empty string if provided value is undefined", () => {
      expect(converter.convertToString(undefined)).to.eq("");
    });
  });

  describe("convertFromString", () => {

    it("returns true if parameter is localized true value", () => {
      const trueString = TestUtils.i18n.getLocalizedString("Components:general.true");
      expect(converter.convertFromString(trueString)).to.be.true;
      expect(converter.convertFromString(trueString.toLocaleUpperCase())).to.be.true;
    });

    it("returns false if parameter is not localized true value", () => {
      expect(converter.convertFromString("test")).to.be.false;
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
