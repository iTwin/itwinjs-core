/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it } from "vitest";
import { formatFieldValue } from "../../internal/annotations/FieldFormatter";
import type { FieldFormatOptions, FieldPropertyType } from "../../annotation/TextField";

describe("Field formatting", () => {
  describe("string", () => {
    it("adds prefix and/or suffix", () => {
      const options: FieldFormatOptions = { prefix: "[", suffix: "]" };
      expect(formatFieldValue("foo", "string", options)).toBe("[foo]");
    });

    it("applies case rules", () => {
      expect(formatFieldValue("foo", "string", { case: "upper" })).toBe("FOO");
      expect(formatFieldValue("FOO", "string", { case: "lower" })).toBe("foo");
    });

    it("does not apply case rules to prefix and suffix", () => {
      const options: FieldFormatOptions = { prefix: "[", suffix: "]", case: "upper" };
      expect(formatFieldValue("foo", "string", options)).toBe("[FOO]");
    });

    it("converts property value to default string representation", () => {
      expect(formatFieldValue(123, "string", undefined)).toBe("123");
      expect(formatFieldValue(true, "string", undefined)).toBe("true");
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
    });

    it("converts boolean to display label", () => {
      const options: FieldFormatOptions = { boolean: { trueString: "Yes", falseString: "No" } };
      expect(formatFieldValue(true, "boolean", options)).toBe("Yes");
      expect(formatFieldValue(false, "boolean", options)).toBe("No");
    });

    it("fails if display label is not specified", () => {
      expect(formatFieldValue(true, "boolean", undefined)).toBeUndefined();
      expect(formatFieldValue(false, "boolean", {})).toBeUndefined();
    });

    it("applies string formatting options", () => {
      const options: FieldFormatOptions = { boolean: { trueString: "yes", falseString: "no" }, prefix: "[", suffix: "]", case: "upper" };
      expect(formatFieldValue(true, "boolean", options)).toBe("[YES]");
      expect(formatFieldValue(false, "boolean", options)).toBe("[NO]");
    });
  });

  describe("enum", () => {
    const enumOptions: FieldFormatOptions = {
      enum: { labels: [{ value: 1, label: "One" }, { value: 2, label: "Two" }] }
    };

    it("fails if property value is not integer", () => {
      expect(formatFieldValue("notint", "enum", enumOptions)).toBeUndefined();
      expect(formatFieldValue(1.5, "enum", enumOptions)).toBeUndefined();
    });

    it("converts integer to display label", () => {
      expect(formatFieldValue(1, "enum", enumOptions)).toBe("One");
      expect(formatFieldValue(2, "enum", enumOptions)).toBe("Two");
    });

    it("fails if display label is not specified", () => {
      expect(formatFieldValue(3, "enum", enumOptions)).toBeUndefined();
      expect(formatFieldValue(1, "enum", undefined)).toBeUndefined();
      expect(formatFieldValue(1, "enum", {})).toBeUndefined();
    });

    it("applies string formatting options", () => {
      const options: FieldFormatOptions = {
        enum: { labels: [{ value: 1, label: "one" }] },
        prefix: "<", suffix: ">", case: "upper"
      };
      expect(formatFieldValue(1, "enum", options)).toBe("<ONE>");
    });
  });

  describe("quantity", () => {
    it("formats number as string", () => {
      expect(formatFieldValue(42, "quantity", undefined)).toBe("42");
    });

    it("returns undefined if not a number", () => {
      expect(formatFieldValue("notnum", "quantity", undefined)).toBeUndefined();
    });

    // ###TODO
  });

  describe("coordinate", () => {
    const coord = { x: 1, y: 2, z: 3 };

    it("fails if property value is not coordinate", () => {
      expect(formatFieldValue("notcoord", "coordinate", undefined)).toBeUndefined();
      expect(formatFieldValue({ x: 1 } as any, "coordinate", undefined)).toBeUndefined();
      expect(formatFieldValue({ x: "1", y: "2", z: "3" } as any, "coordinate", undefined)).toBeUndefined();
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
    });

    it("applies string formatting options", () => {
      const options: FieldFormatOptions = { coordinate: {}, prefix: "(", suffix: ")", case: "upper" };
      expect(formatFieldValue(coord, "coordinate", options)).toBe("(1,2,3)");
    });

    it("applies quantity formatting options", () => {
      // Not implemented, but should still format as string
      const options: FieldFormatOptions = { coordinate: {}, quantity: {} };
      expect(formatFieldValue(coord, "coordinate", options)).toBe("1,2,3");
    });

    it("omits z if not present regardless of component selector", () => {
    });
  });

  describe("datetime", () => {
    it("formats date as string", () => {
      const date = new Date("2023-01-01T12:34:56Z");
      expect(formatFieldValue(date, "datetime", undefined)).toBe(date.toString());
    });

    // ###TODO
  });
});

