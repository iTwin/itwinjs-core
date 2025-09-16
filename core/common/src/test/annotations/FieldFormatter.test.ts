/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeAll, describe, expect, it } from "vitest";
import { formatFieldValue as fmtFldVal } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions, FieldPrimitiveValue, FieldPropertyType, QuantityFieldFormatOptions } from "../../core-common";
import { Format, FormatterSpec } from "@itwin/core-quantity";
import { KindOfQuantity, SchemaContext, SchemaFormatsProvider, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import * as path from "path";
import * as fs from "fs";

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

  describe("boolean", () => {
    it("fails if property value is not boolean", () => {
      const options: FieldFormatOptions = { bool: { trueString: "Yes", falseString: "No" } };
      expect(formatFieldValue("notbool", "boolean", options)).toBeUndefined();
      expect(formatFieldValue(1, "boolean", options)).toBeUndefined();
      expect(formatFieldValue(undefined as any, "boolean", options)).toBeUndefined();
    });

    it("converts boolean to display label (all string options)", () => {
      const options: FieldFormatOptions = { bool: { trueString: "Yes", falseString: "No" } };
      expect(formatFieldValue(true, "boolean", options)).toBe("Yes");
      expect(formatFieldValue(false, "boolean", options)).toBe("No");
      expect(formatFieldValue(true, "boolean", { bool: { trueString: "T", falseString: "F" } })).toBe("T");
      expect(formatFieldValue(false, "boolean", { bool: { trueString: "T", falseString: "F" } })).toBe("F");
    });

    it("defaults to 1 and 0", () => {
      expect(formatFieldValue(true, "boolean", undefined)).to.equal("1");
      expect(formatFieldValue(false, "boolean", {})).to.equal("0");
      expect(formatFieldValue(true, "boolean", { bool: {} })).to.equal("1");
    });

    it("applies all string formatting options", () => {
      const base: FieldFormatOptions = { bool: { trueString: "yes", falseString: "no" } };
      expect(formatFieldValue(true, "boolean", { ...base, prefix: "<" })).toBe("<yes");
      expect(formatFieldValue(false, "boolean", { ...base, suffix: ">" })).toBe("no>");
      expect(formatFieldValue(true, "boolean", { ...base, prefix: "<", suffix: ">" })).toBe("<yes>");
      expect(formatFieldValue(true, "boolean", { ...base, case: "upper" })).toBe("YES");
      expect(formatFieldValue(false, "boolean", { ...base, case: "upper" })).toBe("NO");
      expect(formatFieldValue(true, "boolean", { ...base, case: "lower" })).toBe("yes");
      expect(formatFieldValue(true, "boolean", { ...base, case: "as-is" })).toBe("yes");
    });
  });

  describe("int-enum", () => {
    const enumOptions: FieldFormatOptions = {
      enum: { labels: [{ value: 1, label: "One" }, { value: 2, label: "Two" }] }
    };

    it("fails if property value is not integer", () => {
      expect(formatFieldValue("notint", "int-enum", enumOptions)).toBeUndefined();
      expect(formatFieldValue(1.5, "int-enum", enumOptions)).toBeUndefined();
      expect(formatFieldValue(undefined as any, "int-enum", enumOptions)).toBeUndefined();
    });

    it("converts integer to display label (all label options)", () => {
      expect(formatFieldValue(1, "int-enum", enumOptions)).toBe("One");
      expect(formatFieldValue(2, "int-enum", enumOptions)).toBe("Two");
      const options: FieldFormatOptions = { enum: { labels: [{ value: 5, label: "FIVE" }] } };
      expect(formatFieldValue(5, "int-enum", options)).toBe("FIVE");
    });

    it("fails if display label is not specified and no fallback label is provided", () => {
      expect(formatFieldValue(3, "int-enum", enumOptions)).toBeUndefined();
      expect(formatFieldValue(1, "int-enum", undefined)).toBeUndefined();
      expect(formatFieldValue(1, "int-enum", {})).toBeUndefined();
      expect(formatFieldValue(1, "int-enum", { enum: { labels: [] } })).toBeUndefined();
    });

    it("uses fallback label if value is not in display labels", () => {
      const optsWithFallback: FieldFormatOptions = {
        enum: {
          fallbackLabel: "fallback",
          labels: [{ value: 1, label: "One" }, { value: 2, label: "Two" }],
        },
      };

      expect(formatFieldValue(3, "int-enum", optsWithFallback)).toBe("fallback");
    });

    it("applies all string formatting options", () => {
      const base: FieldFormatOptions = { enum: { labels: [{ value: 1, label: "one" }] } };
      expect(formatFieldValue(1, "int-enum", { ...base, prefix: "<" })).toBe("<one");
      expect(formatFieldValue(1, "int-enum", { ...base, suffix: ">" })).toBe("one>");
      expect(formatFieldValue(1, "int-enum", { ...base, prefix: "<", suffix: ">" })).toBe("<one>");
      expect(formatFieldValue(1, "int-enum", { ...base, case: "upper" })).toBe("ONE");
      expect(formatFieldValue(1, "int-enum", { ...base, case: "lower" })).toBe("one");
      expect(formatFieldValue(1, "int-enum", { ...base, case: "as-is" })).toBe("one");
    });
  });

  describe("quantity", () => {
    let schemaContext: SchemaContext;
    beforeAll(async () => {
      // test schema context, normally collected from imodel
      schemaContext = new SchemaContext();
      const unitSchemaFile = path.join(__dirname, "..","..", "..", "..", "..", "example-code", "snippets", "node_modules", "@bentley", "units-schema");
      const locUnits = new SchemaXmlFileLocater();
      locUnits.addSchemaSearchPath(unitSchemaFile)
      schemaContext.addLocater(locUnits);

      const schemaFile = path.join(__dirname, "..", "..", "..", "..", "..", "example-code", "snippets", "node_modules", "@bentley", "formats-schema");
      const locFormats = new SchemaXmlFileLocater();
      locFormats.addSchemaSearchPath(schemaFile)
      schemaContext.addLocater(locFormats);

      const aecSchemaFile = path.join(__dirname, "..", "..", "..", "..", "..", "example-code", "snippets", "node_modules", "@bentley", "aec-units-schema");
      expect(fs.existsSync(aecSchemaFile), `AEC schema file not found at: ${aecSchemaFile}`).toBe(true);
      const locAec = new SchemaXmlFileLocater();
      locAec.addSchemaSearchPath(aecSchemaFile)
      schemaContext.addLocater(locAec);
    });

    it("formats number as string", () => {
      expect(formatFieldValue(42, "quantity", undefined)).toBe("42");
      expect(formatFieldValue(-1, "quantity", undefined)).toBe("-1");
      expect(formatFieldValue(0, "quantity", undefined)).toBe("0");
    });

    it("returns undefined if not a number", () => {
      expect(formatFieldValue("notnum", "quantity", undefined)).toBeUndefined();
      expect(formatFieldValue(true, "quantity", undefined)).toBeUndefined();
      expect(formatFieldValue(undefined as any, "quantity", undefined)).toBeUndefined();
    });

    it("applies string formatting options", () => {
      expect(formatFieldValue(42, "quantity", { prefix: "[", suffix: "]" })).toBe("[42]");
      expect(formatFieldValue(42, "quantity", { case: "upper" })).toBe("42");
      expect(formatFieldValue(42, "quantity", { case: "lower" })).toBe("42");
    });

    it("should format m to km", async () => {

      // Set up the formatting components
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const fromUnit = await unitsProvider.findUnitByName("Units.M");

      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);

      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, fromUnit);

      const resolvedProps = format.toFullyResolvedJSON();

      // Create quantity field format options
      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: fromUnit,
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(5000, "quantity", fieldOptions);

      // The result should be formatted according to the AecUnits.LENGTH format
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("5.0"); // Should contain the numeric value
      expect(result).to.include("km"); // Should contain the unit label

      // More specific assertion based on expected format
      expect(result).to.equal("5.0 km");
    });

    it("should format length", async () => {

      // Set up the formatting components
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);

      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);

      const resolvedProps = format.toFullyResolvedJSON();

      // Create quantity field format options
      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      // Test formatting a length value (50 meters)
      const result = formatFieldValue(50, "quantity", fieldOptions);

      // The result should be formatted according to the AecUnits.LENGTH format
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("50"); // Should contain the numeric value
      expect(result).to.include("m"); // Should contain the unit label

      // More specific assertion based on expected format
      expect(result).to.equal("50.0 m");
    });

    it("should format length with custom precision", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      let formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      // Modify format to have 3 decimal places
      formatProps = {
        ...formatProps,
        precision: 3,
      };

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(50.12345, "quantity", fieldOptions);
      expect(result).to.equal("50.123 m");
    });

    it("should format imperial length", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "imperial");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      // Test formatting 50 meters to imperial units
      const result = formatFieldValue(50, "quantity", fieldOptions);
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("164"); // Should contain feet value
    });

    it("should format area units", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.SQ_M");
      const formatProps = await formatsProvider.getFormat("AecUnits.AREA");

      if (!formatProps)
        throw new Error("formatProps is undefined");
      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const koq = await schemaContext.getSchemaItem("AecUnits.AREA", KindOfQuantity);
      const quantityOptions: QuantityFieldFormatOptions = {
        koqName: koq?.fullName,
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(100, "quantity", fieldOptions);
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("100"); // Should contain the numeric value
      expect(result).to.include("m²"); // Should contain area unit
    });

    it("should format volume units", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.CUB_M");
      const formatProps = await formatsProvider.getFormat("AecUnits.VOLUME");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(25.5, "quantity", fieldOptions);
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("25.5"); // Should contain the numeric value
      expect(result).to.include("m³"); // Should contain volume unit
    });

    it("should format with prefix and suffix", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions,
        prefix: "Length: ",
        suffix: " total"
      };

      const result = formatFieldValue(75, "quantity", fieldOptions);
      expect(result).to.equal("Length: 75.0 m total");
    });

    it("should format zero values", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(0, "quantity", fieldOptions);
      expect(result).to.equal("0.0 m");
    });

    it("should format negative values", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      const formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(-25.5, "quantity", fieldOptions);
      expect(result).to.equal("-25.5 m");
    });

    it("should format very small values", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      let formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      // Set higher precision for small values
      formatProps = {
        ...formatProps,
        precision: 6,
      };

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(0.000123, "quantity", fieldOptions);
      expect(result).to.equal("0.000123 m");
    });

    it("should handle invalid quantity options gracefully", () => {
      const fieldOptions: FieldFormatOptions = {
        quantity: {} as any // Invalid/empty quantity options
      };

      const result = formatFieldValue(50, "quantity", fieldOptions);
      expect(result).to.equal("50"); // Should fall back to basic string conversion
    });

    it("should format scientific notation values", async () => {
      const unitsProvider = new SchemaUnitProvider(schemaContext);
      const formatsProvider = new SchemaFormatsProvider(schemaContext, "metric");

      const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
      let formatProps = await formatsProvider.getFormat("AecUnits.LENGTH");

      if (!formatProps)
        throw new Error("formatProps is undefined");

      formatProps = {
        ...formatProps,
        type: "scientific",
        precision: 2,
        scientificType: "normalized",
      };

      const format = await Format.createFromJSON("test format", unitsProvider, formatProps);
      const unitConversions = await FormatterSpec.getUnitConversions(format, unitsProvider, persistenceUnit);
      const resolvedProps = format.toFullyResolvedJSON();

      const quantityOptions: QuantityFieldFormatOptions = {
        formatProps: resolvedProps,
        unitConversions,
        sourceUnit: persistenceUnit
      };

      const fieldOptions: FieldFormatOptions = {
        quantity: quantityOptions
      };

      const result = formatFieldValue(1234567, "quantity", fieldOptions);
      expect(result).to.not.be.undefined;
      expect(result).to.be.a("string");
      expect(result).to.include("1.23e6"); // Scientific notation
    });
  });

  describe("coordinate", () => {
    const coord = { x: 1, y: 2, z: 3 };

    it("fails if property value is not coordinate", () => {
      expect(formatFieldValue("notcoord", "coordinate", undefined)).toBeUndefined();
      expect(formatFieldValue({ x: 1 } as any, "coordinate", undefined)).toBeUndefined();
      expect(formatFieldValue({ x: "1", y: "2", z: "3" } as any, "coordinate", undefined)).toBeUndefined();
      expect(formatFieldValue(undefined as any, "coordinate", undefined)).toBeUndefined();
    });

    it("converts coordinates to string", () => {
      expect(formatFieldValue(coord, "coordinate", undefined)).toBe("1,2,3");
      expect(formatFieldValue({ x: 1, y: 2, z: undefined }, "coordinate", undefined)).toBe("1,2");
    });

    it("formats specific components", () => {
      expect(formatFieldValue(coord, "coordinate", { coordinate: { components: "X" } })).toBe("1");
      expect(formatFieldValue(coord, "coordinate", { coordinate: { components: "Y" } })).toBe("2");
      expect(formatFieldValue(coord, "coordinate", { coordinate: { components: "XY" } })).toBe("1,2");
      expect(formatFieldValue(coord, "coordinate", { coordinate: { components: "XYZ" } })).toBe("1,2,3");
    });

    it("separates components with separator string", () => {
      expect(formatFieldValue(coord, "coordinate", { coordinate: { componentSeparator: "|" } })).toBe("1|2|3");
      expect(formatFieldValue(coord, "coordinate", { coordinate: { components: "XY", componentSeparator: ":" } })).toBe("1:2");
    });

    it("applies all string formatting options", () => {
      const base: FieldFormatOptions = { coordinate: {} };
      expect(formatFieldValue(coord, "coordinate", { ...base, prefix: "(", suffix: ")" })).toBe("(1,2,3)");
      expect(formatFieldValue(coord, "coordinate", { ...base, case: "upper" })).toBe("1,2,3");
      expect(formatFieldValue(coord, "coordinate", { ...base, case: "lower" })).toBe("1,2,3");
      expect(formatFieldValue(coord, "coordinate", { ...base, case: "as-is" })).toBe("1,2,3");
    });

    it("applies quantity formatting options (noop)", () => {
      const options: FieldFormatOptions = { coordinate: {}, quantity: {} };
      expect(formatFieldValue(coord, "coordinate", options)).toBe("1,2,3");
    });

    it("omits z if not present regardless of component selector", () => {
      const c = { x: 1, y: 2 };
      expect(formatFieldValue(c as any, "coordinate", { coordinate: { components: "XYZ" } })).toBe("1,2");
      expect(formatFieldValue(c as any, "coordinate", { coordinate: { components: "XY" } })).toBe("1,2");
      expect(formatFieldValue(c as any, "coordinate", { coordinate: { components: "X" } })).toBe("1");
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
      const opts: FieldFormatOptions = {
        dateTime: {
          formatOptions: {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
          },
        },
      };

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
});

