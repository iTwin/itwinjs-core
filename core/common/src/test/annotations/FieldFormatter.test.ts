/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { formatFieldValue } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions } from "../../annotation/TextField";

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
      const options: FieldFormatOptions = { boolean: { trueString: "Yes", falseString: "No" } };
      expect(formatFieldValue("notbool", "boolean", options)).toBeUndefined();
      expect(formatFieldValue(1, "boolean", options)).toBeUndefined();
      expect(formatFieldValue(undefined as any, "boolean", options)).toBeUndefined();
    });

    it("converts boolean to display label (all string options)", () => {
      const options: FieldFormatOptions = { boolean: { trueString: "Yes", falseString: "No" } };
      expect(formatFieldValue(true, "boolean", options)).toBe("Yes");
      expect(formatFieldValue(false, "boolean", options)).toBe("No");
      expect(formatFieldValue(true, "boolean", { boolean: { trueString: "T", falseString: "F" } })).toBe("T");
      expect(formatFieldValue(false, "boolean", { boolean: { trueString: "T", falseString: "F" } })).toBe("F");
    });

    it("fails if display label is not specified", () => {
      expect(formatFieldValue(true, "boolean", undefined)).toBeUndefined();
      expect(formatFieldValue(false, "boolean", {})).toBeUndefined();
      expect(formatFieldValue(true, "boolean", { boolean: {} })).toBeUndefined();
    });

    it("applies all string formatting options", () => {
      const base: FieldFormatOptions = { boolean: { trueString: "yes", falseString: "no" } };
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
      expect(formatFieldValue(date, "datetime", { prefix: "[" })).toBe("[" + date.toString());
      expect(formatFieldValue(date, "datetime", { suffix: "]" })).toBe(date.toString() + "]");
      expect(formatFieldValue(date, "datetime", { prefix: "[", suffix: "]" })).toBe("[" + date.toString() + "]");
      expect(formatFieldValue(date, "datetime", { case: "upper" })).toBe(date.toString().toUpperCase());
      expect(formatFieldValue(date, "datetime", { case: "lower" })).toBe(date.toString().toLowerCase());
      expect(formatFieldValue(date, "datetime", { case: "as-is" })).toBe(date.toString());
    });
  });
});

