/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { DateTimeTypeConverter, DateTimeTypeConverterBase, ShortDateTypeConverter } from "../../components-react";
import TestUtils from "../TestUtils";
import { TimeFormat } from "@itwin/core-react";
import { AlternateDateFormats, TimeDisplay } from "@itwin/appui-abstract";

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

  describe("convertToStringWithOptions", () => {
    it("returns correct string", () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      let options = { alternateDateFormat: AlternateDateFormats.IsoDateTime };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("2018-01-01");
      options = { alternateDateFormat: AlternateDateFormats.IsoShort };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("2018-01-01");
      options = { alternateDateFormat: AlternateDateFormats.UtcShort };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("01 Jan 2018");
      options = { alternateDateFormat: AlternateDateFormats.UtcShortWithDay };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("Mon, 01 Jan 2018");
      options = { alternateDateFormat: AlternateDateFormats.UtcDateTime };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("01 Jan 2018");
      options = { alternateDateFormat: AlternateDateFormats.UtcDateTimeWithDay };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("Mon, 01 Jan 2018");
      expect(converter.convertToStringWithOptions(undefined, options)).to.be.eq("");
      expect(converter.convertToStringWithOptions(date, undefined)).to.be.eq(converter.convertToString(date));
    });

    it("returns formatted date if date is a string", () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      const str = "2018-01-01";
      const options = { alternateDateFormat: AlternateDateFormats.IsoDateTime };
      expect(converter.convertToStringWithOptions(str, options)).to.be.eq(converter.convertToStringWithOptions(date, options));
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

  describe("convertFromStringWithOptions", () => {
    it("returns correct string when proper date string is provided", () => {
      const testDate = new Date(2018, 0, 1);
      const convertedDate = converter.convertFromStringWithOptions("1/1/2018");
      expect(convertedDate).to.not.be.undefined;
      expect(convertedDate!.valueOf()).to.eq(testDate.valueOf());
    });

    it("returns undefined when empty date string is provided", () => {
      const convertedDate = converter.convertFromStringWithOptions("");
      expect(convertedDate).to.be.undefined;
    });

    it("returns undefined when wrong date string is provided", () => {
      const convertedDate = converter.convertFromStringWithOptions("MayFifteenthTwoThousandAndTwo");
      expect(convertedDate).to.be.undefined;
    });

    it("returns date at UTC-0", () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      const str = "2018-01-01";
      const options = { alternateDateFormat: AlternateDateFormats.IsoDateTime };
      const convertedDate = converter.convertFromStringWithOptions(str, options) as Date;
      expect(date.getDate()).to.be.eq(convertedDate.getDate());
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

  describe("convertToStringWithOptions", () => {
    it("returns correct string", () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      let options = { alternateDateFormat: AlternateDateFormats.IsoDateTime };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("2018-01-01T00:00:00.000Z");
      options = { alternateDateFormat: AlternateDateFormats.IsoShort };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("2018-01-01T00:00:00.000Z");
      options = { alternateDateFormat: AlternateDateFormats.UtcShort };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("01 Jan 2018 00:00:00 GMT");
      options = { alternateDateFormat: AlternateDateFormats.UtcShortWithDay };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("Mon, 01 Jan 2018 00:00:00 GMT");
      options = { alternateDateFormat: AlternateDateFormats.UtcDateTime };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("01 Jan 2018 00:00:00 GMT");
      options = { alternateDateFormat: AlternateDateFormats.UtcDateTimeWithDay };
      expect(converter.convertToStringWithOptions(date, options)).to.be.eq("Mon, 01 Jan 2018 00:00:00 GMT");
      expect(converter.convertToStringWithOptions(undefined, options)).to.be.eq("");
      expect(converter.convertToStringWithOptions(date, undefined)).to.be.eq(converter.convertToString(date));
    });

    it("returns correct time string", async () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      let options = { timeDisplay: TimeDisplay.H24M };
      const hour24 = await converter.convertToStringWithOptions(date, options);
      options = { timeDisplay: TimeDisplay.H12MC };
      const hour12 = await converter.convertToStringWithOptions(date, options);
      expect(hour12.length > hour24.length);
    });

    it("returns formatted date if date is a string", () => {
      const date = new Date(Date.UTC(2018, 0, 1));
      const str = "2018-01-01";
      const options = { alternateDateFormat: AlternateDateFormats.IsoDateTime };
      expect(converter.convertToStringWithOptions(str, options)).to.be.eq(converter.convertToStringWithOptions(date, options));
    });
  });

});

class NoneDateTypeConverter extends DateTimeTypeConverterBase {
  protected getTimeFormat(): TimeFormat { return TimeFormat.None; }
}

describe("NoneDateTypeConverter", () => {
  let converter: NoneDateTypeConverter;

  beforeEach(() => {
    converter = new NoneDateTypeConverter();
  });

  it("convertToString", () => {
    const testDate = new Date(2018, 0, 1, 1, 15, 30);
    expect(converter.convertToString(testDate)).to.eq(testDate.toISOString());
  });

});

