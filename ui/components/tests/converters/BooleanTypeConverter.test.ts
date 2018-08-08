/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BooleanTypeConverter } from "@src/index";
import TestUtils from "../TestUtils";

describe("BooleanTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  const converter = new BooleanTypeConverter();

  describe("convertToString", () => {

    it("returns empty string if parameter is null or undefined", async () => {
      expect(await converter.convertToString(undefined)).to.eq("");
      expect(await converter.convertToString(null)).to.eq("");
    });

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

  });

  describe("convertFromString", () => {

    it("returns undefined if parameter is null or undefined", async () => {
      expect(await converter.convertFromString((null as any))).to.be.undefined;
      expect(await converter.convertFromString((undefined as any))).to.be.undefined;
    });

    it("returns true if parameter is localized true value", async () => {
      const trueString = TestUtils.i18n.translate("Components:general.true");
      expect(await converter.convertFromString(trueString)).to.be.true;
      expect(await converter.convertFromString(trueString.toLocaleUpperCase())).to.be.true;
    });

    it("returns false if parameter is not localized true value", async () => {
      expect(await converter.convertFromString("test")).to.be.false;
    });

  });

});
