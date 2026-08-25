/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { BeEvent, BeUnorderedUiEvent } from "@itwin/core-bentley";
import {
  BasicUnitsProvider, Format, FormatDefinition, FormatProps, FormatsChangedArgs, FormatsProvider, FormatterSpec, FormattingSpecEntry,
  FormattingSpecProvider, ParserSpec, Units,
} from "@itwin/core-quantity";
import { collectFieldQuantityPairs, FieldValue, formatFieldValue as fmtFldVal, formatFieldValueWithSpecProvider } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions, FieldPrimitiveValue, FieldPropertyType } from "../../core-common";

function formatFieldValue(value: FieldPrimitiveValue, type: FieldPropertyType, options: FieldFormatOptions | undefined): string | undefined {
  return fmtFldVal({ value, type }, options);
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

describe("Spec-provider field formatting", () => {
  // A fake FormatsProvider used to exercise the property-KoQ / kindOfQuantity-override resolution paths
  // without requiring an EC SchemaContext in these unit tests.
  function createFakeFormatsProvider(map: Record<string, FormatDefinition>): FormatsProvider {
    return {
      getFormat: async (name: string) => map[name],
      onFormatsChanged: new BeEvent<(args: FormatsChangedArgs) => void>(),
    };
  }

  /** Mirrors what `FieldFormattingSpecProvider` does in `core-backend`: resolve every candidate
   * a value/options pair can produce, ahead of time, so that formatting itself is synchronous.
   * Candidates that resolve no format or no persistence unit are simply absent from the cache,
   * which is what drives the raw-string fallbacks asserted below.
   */
  async function warmProvider(
    formats: Record<string, FormatDefinition>,
    value: FieldValue,
    options?: FieldFormatOptions,
  ): Promise<FormattingSpecProvider> {
    const formatsProvider = createFakeFormatsProvider(formats);
    const unitsProvider = new BasicUnitsProvider();
    const specs = new Map<string, FormattingSpecEntry>();

    const candidates = collectFieldQuantityPairs({
      overrideName: options?.quantity?.kindOfQuantity,
      overridePersistence: options?.quantity?.persistenceUnit,
      propertyName: value.kindOfQuantityFullName,
      propertyPersistence: value.persistenceUnitFullName,
    });

    for (const candidate of candidates) {
      const formatProps = await formatsProvider.getFormat(candidate.name);
      if (!formatProps) {
        continue;
      }

      let persistenceUnit;
      try {
        persistenceUnit = await unitsProvider.findUnitByName(candidate.persistenceUnitName);
      } catch {
        continue;
      }
      if (!persistenceUnit?.isValid) {
        continue;
      }

      const candidateFormat = await Format.createFromJSON("fieldFormat", unitsProvider, formatProps);
      specs.set(`${candidate.name}|${candidate.persistenceUnitName}`, {
        formatterSpec: await FormatterSpec.create("fieldFormat", candidateFormat, unitsProvider, persistenceUnit),
        parserSpec: await ParserSpec.create(candidateFormat, unitsProvider, persistenceUnit),
      });
    }

    return {
      getSpecsByNameAndUnit: (args) => specs.get(`${args.name}|${args.persistenceUnitName}`),
      formatQuantity: (magnitude, spec) => spec.applyFormatting(magnitude),
      onFormattingReady: new BeUnorderedUiEvent<void>(),
    };
  }

  /** Warms a provider for exactly this value/options pair, then formats synchronously. */
  async function format(
    value: FieldValue,
    options?: FieldFormatOptions,
    formats: Record<string, FormatDefinition> = {},
  ): Promise<string | undefined> {
    return formatFieldValueWithSpecProvider(value, options, await warmProvider(formats, value, options));
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
    it("resolves format from the property's KindOfQuantity via the FormatsProvider", async () => {
      const value: FieldValue = {
        value: 2,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await format(value, undefined, { "AecUnits.LENGTH": metersFormat });
      expect(result).toBe("2 m");
    });

    it("resolves format via a kindOfQuantity override, taking precedence over KoQ", async () => {
      const value: FieldValue = {
        value: 1,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await format(
        value,
        { quantity: { kindOfQuantity: "MySet.LENGTH_FT" } },
        { "AecUnits.LENGTH": metersFormat, "MySet.LENGTH_FT": feetInchesFormat },
      );
      expect(result).toBe("3'-3 3/8\"");
    });

    it("applies prefix, suffix, and case around the formatted magnitude", async () => {
      const value: FieldValue = {
        value: 1,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await format(
        value,
        { prefix: "Length: ", suffix: "!", case: "upper" },
        { "AecUnits.LENGTH": metersFormat },
      );
      expect(result).toBe("Length: 1 M!");
    });

    it("falls back to the sync formatter when no format source is available", async () => {
      const value: FieldValue = { value: 42, type: "quantity" };
      const result = await format(value);
      expect(result).toBe("42");
    });

    it("falls back to raw when a format resolves but no persistence unit is known", async () => {
      // Regression: previously the formatter used the composite's presentation unit as a
      // stand-in persistence unit. That could either mis-convert or silently render raw
      // magnitudes with a presentation label. The correct behavior is to bail out and let the
      // caller render the raw value.
      const value: FieldValue = {
        value: 2,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        // persistenceUnitFullName intentionally omitted.
      };
      const result = await format(value, undefined, { "AecUnits.LENGTH": metersFormat });
      expect(result).toBe("2");
    });

    it("falls back to the property's KindOfQuantity when the override KoQ is missing from the provider", async () => {
      // Caller pinned "MySet.LENGTH_FT" but the active provider only knows the property KoQ.
      // The formatter should try the override, fail, then fall back to the property pair.
      const value: FieldValue = {
        value: 1,
        type: "quantity",
        kindOfQuantityFullName: "AecUnits.LENGTH",
        persistenceUnitFullName: "Units.M",
      };
      const result = await format(
        value,
        { quantity: { kindOfQuantity: "MySet.LENGTH_FT" } },
        // Note: "MySet.LENGTH_FT" is intentionally absent.
        { "AecUnits.LENGTH": metersFormat },
      );
      expect(result).toBe("1 m");
    });

    it("delegates non-quantity, non-coordinate types to the sync formatter", async () => {
      const result = await format({ value: "hello", type: "string" }, { prefix: "<", suffix: ">" });
      expect(result).toBe("<hello>");
    });
  });

  describe("coordinate", () => {
    it("formats Point2d via the FormatsProvider using kindOfQuantity", async () => {
      const result = await format(
        { value: { x: 1, y: 2 }, type: "coordinate", persistenceUnitFullName: "Units.M" },
        { quantity: { kindOfQuantity: "AecUnits.LENGTH" } },
        { "AecUnits.LENGTH": metersFormat },
      );
      expect(result).toBe("(1 m, 2 m)");
    });

    it("formats Point3d via the FormatsProvider using kindOfQuantity", async () => {
      const result = await format(
        { value: { x: 1, y: 2, z: 3 }, type: "coordinate", persistenceUnitFullName: "Units.M" },
        { quantity: { kindOfQuantity: "AecUnits.LENGTH" } },
        { "AecUnits.LENGTH": metersFormat },
      );
      expect(result).toBe("(1 m, 2 m, 3 m)");
    });

    it("falls back to the raw coordinate string when no KoQ or override is provided", async () => {
      // Core has no built-in coordinate format: presentation is app policy and belongs to the
      // FormatsProvider. When nothing resolves, formatting drops to `formatFieldValue`.
      const result = await format({ value: { x: 1.5, y: 2 }, type: "coordinate" });
      expect(result).toBe("(1.5, 2)");
    });

    it("applies a kindOfQuantity override on a coordinate value only when the caller also supplies a persistenceUnit", async () => {
      // Coordinate properties (Point2d/Point3d) that carry no KindOfQuantity produce no
      // `persistenceUnitFullName` on the FieldValue. The formatter no longer synthesizes a
      // meters persistence unit on the caller's behalf — an override `kindOfQuantity` without
      // an explicit `persistenceUnit` falls back to the raw coordinate. Callers that want the
      // BIS geometry meters convention (docs/bis/guide/other-topics/units.md) must pass it
      // explicitly, typically via `Units.LENGTH.M`.
      const feetFormat: FormatProps = {
        composite: { includeZero: true, units: [{ label: "ft", name: "Units.FT" }] },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 2,
        type: "Decimal",
        uomSeparator: " ",
      };
      const formats = { "MySet.LENGTH_FT": feetFormat };

      // Without an explicit persistenceUnit: raw coordinate, no override applied.
      const rawResult = await format(
        { value: { x: 1, y: 2, z: 3 }, type: "coordinate" },
        { quantity: { kindOfQuantity: "MySet.LENGTH_FT" } },
        formats,
      );
      expect(rawResult).toBe("(1, 2, 3)");

      // With an explicit persistenceUnit: override resolves.
      const overrideResult = await format(
        { value: { x: 1, y: 2, z: 3 }, type: "coordinate" },
        { quantity: { kindOfQuantity: "MySet.LENGTH_FT", persistenceUnit: Units.LENGTH.M } },
        formats,
      );
      expect(overrideResult).toBe("(3.28 ft, 6.56 ft, 9.84 ft)");
    });

    it("applies prefix/suffix/case around the joined coordinate", async () => {
      const result = await format(
        { value: { x: 1, y: 2 }, type: "coordinate", persistenceUnitFullName: "Units.M", kindOfQuantityFullName: "AecUnits.LENGTH" },
        { prefix: "at ", case: "upper" },
        { "AecUnits.LENGTH": metersFormat },
      );
      expect(result).toBe("at (1 M, 2 M)");
    });
  });
});


describe("collectFieldQuantityPairs candidate priority", () => {
  const PROPERTY_PAIR = { name: "P.KOQ", persistenceUnitName: "Units.M" };

  /** The property-side pair is a *presentation* fallback. It is legal for a `kindOfQuantity`-only
   * override, and for a `persistenceUnit` that agrees with the property, because neither changes
   * what the stored magnitude means. It is illegal for a `persistenceUnit` that names a different
   * unit: falling back there would format the magnitude as though it were the property's unit and
   * render a value off by the conversion factor, with nothing to signal the substitution.
   */
  it("keeps the property-side fallback for a kindOfQuantity-only override", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).toEqual([{ name: "A.KOQ", persistenceUnitName: "Units.M" }, PROPERTY_PAIR]);
  });

  it("keeps the property-side fallback when the persistence override restates the property's unit", () => {
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", overridePersistence: "Units.M", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).toEqual([{ name: "A.KOQ", persistenceUnitName: "Units.M" }, PROPERTY_PAIR]);
  });

  it("drops the property-side fallback when the persistence override names a different unit", () => {
    expect(collectFieldQuantityPairs({
      overridePersistence: "Units.FT", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).toEqual([{ name: "P.KOQ", persistenceUnitName: "Units.FT" }]);
  });

  it("treats an empty-string persistence override as unset, not as a contradicting claim", () => {
    // `??` does not fall through on "", so the effective pair is suppressed either way. What must
    // not happen is the empty string being read as "this value is in some other unit" and taking
    // the property's own pair down with it.
    expect(collectFieldQuantityPairs({
      overridePersistence: "", propertyName: "P.KOQ", propertyPersistence: "Units.M",
    })).toEqual([PROPERTY_PAIR]);
  });

  it("emits no property-side pair at all when the property has no persistence unit", () => {
    // A property with no KindOfQuantity contributes nothing to fall back to, so the override rule
    // is inert here: the field either resolves on its own two halves or renders raw.
    expect(collectFieldQuantityPairs({
      overrideName: "A.KOQ", overridePersistence: "Units.ARC_DEG", propertyName: undefined, propertyPersistence: undefined,
    })).toEqual([{ name: "A.KOQ", persistenceUnitName: "Units.ARC_DEG" }]);

    for (const overridePersistence of [undefined, "", "Units.ARC_DEG"]) {
      expect(collectFieldQuantityPairs({ overridePersistence, propertyName: undefined, propertyPersistence: undefined })).toEqual([]);
    }
  });
});
