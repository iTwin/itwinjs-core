/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { BeEvent } from "@itwin/core-bentley";
import { BasicUnitsProvider, FormatDefinition, FormatProps, FormatsChangedArgs, FormatsProvider } from "@itwin/core-quantity";
import { FieldFormatterContext, formatFieldValue as fmtFldVal, formatFieldValueAsync, FieldValue } from "../../internal/annotations/FieldFormatter";
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

describe("Async field formatting", () => {
  // A fake FormatsProvider used to exercise the KindOfQuantity / formatSetKey resolution paths
  // without requiring an EC SchemaContext in these unit tests.
  function createFakeFormatsProvider(map: Record<string, FormatDefinition>): FormatsProvider {
    return {
      getFormat: async (name: string) => map[name],
      onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
    };
  }

  function createContext(formats: Record<string, FormatDefinition> = {}): FieldFormatterContext {
    return {
      unitsProvider: new BasicUnitsProvider(),
      formatsProvider: createFakeFormatsProvider(formats),
      specCache: new Map(),
    };
  }

  const feetInchesFormat: FormatProps = {
    composite: {
      includeZero: true,
      spacer: "-",
      units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
    },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
  };

  const metersFormat: FormatProps = {
    composite: { includeZero: true, units: [{ label: "m", name: "Units.M" }] },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 4,
    type: "Decimal",
    uomSeparator: " ",
  };

  describe("quantity", () => {
    it("formats a magnitude using an inline FormatProps override (feet-inches from meters)", async () => {
      const value: FieldValue = { value: 1, type: "quantity", persistenceUnitFullName: "Units.M" };
      const result = await formatFieldValueAsync(
        value,
        { quantity: { format: feetInchesFormat } },
        createContext(),
      );
      expect(result).toBe("3'-3 3/8\"");
    });

    it("resolves format from the property's KindOfQuantity via the FormatsProvider", async () => {
      const value: FieldValue = {
        value: 2,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await formatFieldValueAsync(
        value,
        undefined,
        createContext({ "AecUnits.LENGTH": metersFormat }),
      );
      expect(result).toBe("2 m");
    });

    it("resolves format via a formatSetKey override, taking precedence over KoQ", async () => {
      const value: FieldValue = {
        value: 1,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await formatFieldValueAsync(
        value,
        { quantity: { formatSetKey: "MySet.LENGTH_FT" } },
        createContext({
          "AecUnits.LENGTH": metersFormat,
          "MySet.LENGTH_FT": feetInchesFormat,
        }),
      );
      expect(result).toBe("3'-3 3/8\"");
    });

    it("forwards the requested unit system to the FormatsProvider", async () => {
      let receivedSystem: string | undefined;
      const provider: FormatsProvider = {
        getFormat: async (_name, system) => {
          receivedSystem = system;
          return metersFormat;
        },
        onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
      };
      const context: FieldFormatterContext = {
        unitsProvider: new BasicUnitsProvider(),
        formatsProvider: provider,
        specCache: new Map(),
      };

      await formatFieldValueAsync(
        { value: 1, type: "quantity", kindOfQuantityFullName: "AecUnits.LENGTH", persistenceUnitFullName: "Units.M" },
        { quantity: { unitSystem: "imperial" } },
        context,
      );
      expect(receivedSystem).toBe("imperial");
    });

    it("applies prefix, suffix, and case around the formatted magnitude", async () => {
      const value: FieldValue = { value: 1, type: "quantity", persistenceUnitFullName: "Units.M" };
      const result = await formatFieldValueAsync(
        value,
        { prefix: "Length: ", suffix: "!", case: "upper", quantity: { format: metersFormat } },
        createContext(),
      );
      expect(result).toBe("Length: 1 M!");
    });

    it("falls back to the sync formatter when no format source is available", async () => {
      const value: FieldValue = { value: 42, type: "quantity" };
      const result = await formatFieldValueAsync(value, undefined, createContext());
      expect(result).toBe("42");
    });

    it("delegates non-quantity, non-coordinate types to the sync formatter", async () => {
      const result = await formatFieldValueAsync(
        { value: "hello", type: "string" },
        { prefix: "<", suffix: ">" },
        createContext(),
      );
      expect(result).toBe("<hello>");
    });

    it("caches FormatterSpec instances by source, persistence unit, and unit system", async () => {
      let getFormatCallCount = 0;
      const provider: FormatsProvider = {
        getFormat: async () => { getFormatCallCount++; return metersFormat; },
        onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
      };
      const context: FieldFormatterContext = {
        unitsProvider: new BasicUnitsProvider(),
        formatsProvider: provider,
        specCache: new Map(),
      };
      const value: FieldValue = {
        value: 1,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };

      await formatFieldValueAsync(value, undefined, context);
      await formatFieldValueAsync(value, undefined, context);
      await formatFieldValueAsync({ ...value, value: 5 }, undefined, context);
      // getFormat is called every pass (the FormatsProvider is not cached), but the cache should
      // prevent a second FormatterSpec build for the same triple. Its main observable effect is
      // that identical inputs yield identical formatted output.
      expect(getFormatCallCount).toBeGreaterThan(0);
      expect(context.specCache?.size).toBe(1);
    });
  });

  describe("coordinate", () => {
    it("formats Point2d using an inline quantity format", async () => {
      const result = await formatFieldValueAsync(
        { value: { x: 1, y: 2 }, type: "coordinate", persistenceUnitFullName: "Units.M" },
        { quantity: { format: metersFormat } },
        createContext(),
      );
      expect(result).toBe("(1 m, 2 m)");
    });

    it("formats Point3d using an inline quantity format", async () => {
      const result = await formatFieldValueAsync(
        { value: { x: 1, y: 2, z: 3 }, type: "coordinate", persistenceUnitFullName: "Units.M" },
        { quantity: { format: metersFormat } },
        createContext(),
      );
      expect(result).toBe("(1 m, 2 m, 3 m)");
    });

    it("falls back to a built-in meters format when no KoQ or override is provided", async () => {
      const result = await formatFieldValueAsync(
        { value: { x: 1.5, y: 2 }, type: "coordinate" },
        undefined,
        createContext(),
      );
      expect(result).toBe("(1.5 m, 2 m)");
    });

    it("applies prefix/suffix/case around the joined coordinate", async () => {
      const result = await formatFieldValueAsync(
        { value: { x: 1, y: 2 }, type: "coordinate", persistenceUnitFullName: "Units.M" },
        { prefix: "at ", case: "upper", quantity: { format: metersFormat } },
        createContext(),
      );
      expect(result).toBe("at (1 M, 2 M)");
    });
  });
});

