/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { formatFieldValue as fmtFldVal } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions, FieldPrimitiveValue, FieldPropertyType } from "../../core-common";

function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  return fmtFldVal({ value, type }, options);
}

describe("Field formatting", () => {
  describe("string", () => {
    it("adds prefix and/or suffix", () => {
      expect(formatFieldValue("foo", "string", { prefix: "[" })).toBe("[foo");
      expect(formatFieldValue("foo", "string", { suffix: "]" })).toBe("foo]");
      expect(formatFieldValue("foo", "string", { prefix: "[", suffix: "]" })).toBe("[foo]");
      expect(formatFieldValue("foo", "string", { suffix: ">" })).toBe("foo>");
      expect(formatFieldValue("foo", "string", { prefix: "<" })).toBe("<foo");
    });

    it("applies all case rules", () => {
      expect(formatFieldValue("fuzzy WUZZY wAS A BeAr", "string", { case: "upper" })).toBe("FUZZY WUZZY WAS A BEAR");
      expect(formatFieldValue("fuzzy WUZZY wAS A BeAr", "string", { case: "lower" })).toBe("fuzzy wuzzy was a bear");
      expect(formatFieldValue("fuzzy WUZZY wAS A BeAr", "string", { case: "as-is" })).toBe("fuzzy WUZZY wAS A BeAr");
    });

    it("does not apply case rules to prefix and suffix", () => {
      const options: FieldFormatOptions = { prefix: "aBCdEf", suffix: "GhiJkL", case: "upper" };
      expect(formatFieldValue("foo", "string", options)).toBe("aBCdEfFOOGhiJkL");
    });

    it("converts property value to default string representation", () => {
      expect(formatFieldValue(123, "string", undefined)).toBe("123");
      expect(formatFieldValue(true, "string", undefined)).toBe("true");
      expect(formatFieldValue(false, "string", undefined)).toBe("false");
    });

    it("formats empty string", () => {
      expect(formatFieldValue("", "string", undefined)).toBe("");
      expect(formatFieldValue("", "string", { prefix: "<", suffix: ">" })).toBe("<>");
    });
  });

  describe("datetime", () => {
    it("formats date as string", () => {
      const date = new Date("2023-01-01T12:34:56Z");
      expect(formatFieldValue(date, "datetime", undefined)).toBe(date.toString());
    });

    it("applies all string formatting options", () => {
      const date = new Date("2023-01-01T12:34:56Z");
      expect(formatFieldValue(date, "datetime", { prefix: "[" })).toBe(`[${  date.toString()}`);
      expect(formatFieldValue(date, "datetime", { suffix: "]" })).toBe(`${date.toString()  }]`);
      expect(formatFieldValue(date, "datetime", { prefix: "[", suffix: "]" })).toBe(`[${  date.toString()  }]`);
      expect(formatFieldValue(date, "datetime", { case: "upper" })).toBe(date.toString().toUpperCase());
      expect(formatFieldValue(date, "datetime", { case: "lower" })).toBe(date.toString().toLowerCase());
      expect(formatFieldValue(date, "datetime", { case: "as-is" })).toBe(date.toString());
    });

    it("format date as mm/dd/yyyy", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const dateTimeOpts: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }

      const options: FieldFormatOptions = {
        dateTime: {
          locale: undefined,
          formatOptions: dateTimeOpts,
        }
      }
      expect(formatFieldValue(date, "datetime", options)).to.equal("08/28/2025")
    });

    it("format date as weekday, month day, year", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const dateTimeOpts: Intl.DateTimeFormatOptions = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
      };
      const options: FieldFormatOptions = {
        dateTime: {
          locale: "en-US",
          formatOptions: dateTimeOpts,
        }
      };
      expect(formatFieldValue(date, "datetime", options)).to.equal("Thursday, August 28, 2025");
    });

    it("formats using specified locale", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const dateTimeOpts: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      };
      const options: FieldFormatOptions = {
        dateTime: {
          locale: "en-GB", // UK English uses dd/mm/yyyy
          formatOptions: dateTimeOpts,
        }
      };
      expect(formatFieldValue(date, "datetime", options)).to.equal("28/08/2025");
    });

    it("format date as short month date, year", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const dateTimeOpts: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC"
      };
      const options: FieldFormatOptions = {
        dateTime: {
          locale: "en-US",
          formatOptions: dateTimeOpts,
        }
      };
      expect(formatFieldValue(date, "datetime", options)).to.equal("Aug 28, 2025");
    });

    it("defaults to en-US locale", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const options: FieldFormatOptions = {
        dateTime: {
          formatOptions: {
            weekday: "long",
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          },
        },
      };

      expect(formatFieldValue(date, "datetime", options)).to.equal("Thursday, 08/28/2025");
    });

    it("supports other locales", () => {
      const date = new Date(2012, 5);

      const testCases = [
        ["sr-RS", "петак, 1. јун 2012."],
        ["id-u-co-pinyin", "Jumat, 1 Jun 2012"],
        ["de-ID", "Freitag, 1. Juni 2012"],
      ];

      for (const testCase of testCases) {
        const opts: FieldFormatOptions = {
          dateTime: {
            locale: testCase[0],
            formatOptions: {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            },
          },
        };

        expect(formatFieldValue(date, "datetime", opts)).to.equal(testCase[1]);
      }
    });

    it("rejects unsupported locales", () => {
      const date = new Date("2025-08-28T13:45:30.123Z");
      const options: FieldFormatOptions = {
        dateTime: {
          locale: "not-a-locale",
          formatOptions: {
            weekday: "long",
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          },
        },
      };

      expect(formatFieldValue(date, "datetime", options)).to.be.undefined;
    });
  });

  describe("coordinate", () => {
    it("applies basic formatting", () => {
      expect(formatFieldValue({ x: 1, y: 2 }, "coordinate", undefined)).to.equal("(1, 2)");
      expect(formatFieldValue({ x: 1, y: 2, z: 3 }, "coordinate", undefined)).to.equal("(1, 2, 3)");
    });
  })
});

