/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { FieldValue, formatFieldValue as fmtFldVal, FormatMagnitude } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions, FieldPrimitiveValue, FieldPropertyType } from "../../core-common";

function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  return fmtFldVal({ value: { value, type }, options });
}

//cspell:ignore WUZZY Freitag Jumat Juni петак

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

describe("magnitude callback", () => {
  /** Stands in for a caller that resolved a [FormatterSpec]($core-quantity) ahead of time. Real
   * spec resolution is `core-backend`'s job and is covered by its `FieldFormat.test.ts`; what
   * matters here is only that `formatFieldValue` routes the right magnitudes through whatever
   * callback it is handed, and assembles the result correctly around them.
   */
  const millimeters: FormatMagnitude = (magnitude) => `${magnitude * 1000} mm`;

  function format(value: FieldValue, options?: FieldFormatOptions, formatMagnitude?: FormatMagnitude): string | undefined {
    return fmtFldVal({ value, options, formatMagnitude });
  }

  describe("quantity", () => {
    it("renders the magnitude through the callback", () => {
      expect(format({ value: 2.5, type: "quantity" }, undefined, millimeters)).toBe("2500 mm");
    });

    it("falls back to the raw string when no callback is supplied", () => {
      expect(format({ value: 2.5, type: "quantity" })).toBe("2.5");
    });

    it("ignores the callback for a non-numeric quantity value", () => {
      // A "quantity" FieldValue whose value is not a number has no magnitude to convert, so it
      // renders raw rather than being handed to a callback that expects a number.
      expect(format({ value: "N/A", type: "quantity" }, undefined, millimeters)).toBe("N/A");
    });

    it("applies prefix, suffix, and case around the formatted magnitude", () => {
      const result = format({ value: 2.5, type: "quantity" }, { prefix: "<", suffix: ">", case: "upper" }, millimeters);
      expect(result).toBe("<2500 MM>");
    });
  });

  describe("coordinate", () => {
    it("renders each component of a Point2d through the callback", () => {
      expect(format({ value: { x: 1, y: 2 }, type: "coordinate" }, undefined, millimeters)).toBe("(1000 mm, 2000 mm)");
    });

    it("renders each component of a Point3d through the callback", () => {
      expect(format({ value: { x: 1, y: 2, z: 3 }, type: "coordinate" }, undefined, millimeters)).toBe("(1000 mm, 2000 mm, 3000 mm)");
    });

    it("falls back to the raw coordinate when no callback is supplied", () => {
      // Core has no built-in coordinate format: presentation is app policy and belongs to the
      // FormatsProvider. When the caller resolves no spec, the components render bare.
      expect(format({ value: { x: 1.5, y: 2 }, type: "coordinate" })).toBe("(1.5, 2)");
    });

    it("returns undefined for a coordinate value that is not a point", () => {
      expect(format({ value: 5, type: "coordinate" }, undefined, millimeters)).to.be.undefined;
    });

    it("applies prefix/suffix/case around the joined coordinate", () => {
      const result = format({ value: { x: 1, y: 2 }, type: "coordinate" }, { prefix: "at ", case: "upper" }, millimeters);
      expect(result).toBe("at (1000 MM, 2000 MM)");
    });
  });

  it("ignores the callback for types that carry no magnitude", () => {
    expect(format({ value: "hello", type: "string" }, undefined, millimeters)).toBe("hello");
    expect(format({ value: true, type: "boolean" }, undefined, millimeters)).toBe("true");
  });
});
