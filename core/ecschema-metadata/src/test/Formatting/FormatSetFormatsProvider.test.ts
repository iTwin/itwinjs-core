/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsProvider } from "@itwin/core-quantity";
import { FormatSetFormatsProvider } from "../../Formatting/FormatSetFormatsProvider";
import { FormatSet } from "../../Deserialization/JsonProps";

describe("FormatSetFormatsProvider", () => {
  let formatSet: FormatSet;
  let provider: FormatSetFormatsProvider;

  const sampleFormat: FormatDefinition = {
    composite: {
      includeZero: true,
      spacer: " ",
      units: [
        {
          label: "m",
          name: "Units.M",
        },
      ],
    },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    label: "Meters",
    precision: 4,
    type: "Decimal",
  };

  const anotherFormat: FormatDefinition = {
    composite: {
      includeZero: true,
      spacer: " ",
      units: [
        {
          label: "ft",
          name: "Units.FT",
        },
      ],
    },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    label: "Feet",
    precision: 2,
    type: "Decimal",
  };

  beforeEach(() => {
    formatSet = {
      name: "TestFormatSet",
      label: "Test Format Set",
      unitSystem: "metric",
      formats: {
        testFormat: sampleFormat,
      },
    };
    provider = new FormatSetFormatsProvider({ formatSet });
  });

  describe("constructor", () => {
    it("should create provider with format set", () => {
      expect(provider).to.be.instanceOf(FormatSetFormatsProvider);
    });

    it("should create provider with format set and fallback provider", () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async (name: string) => name === "FallbackFormat" ? sampleFormat : undefined,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });
      expect(providerWithFallback).to.be.instanceOf(FormatSetFormatsProvider);
    });

    it("should preserve unitSystem property from format set", () => {
      expect(formatSet.unitSystem).to.equal("metric");
    });

    it("should work with different unit system values", () => {
      const customFormatSet: FormatSet = {
        name: "CustomFormatSet",
        label: "Custom Format Set",
        unitSystem: "imperial",
        formats: {
          testFormat: sampleFormat,
        },
      };
      const customProvider = new FormatSetFormatsProvider({ formatSet: customFormatSet });
      expect(customProvider).to.be.instanceOf(FormatSetFormatsProvider);
      expect(customFormatSet.unitSystem).to.equal("imperial");
    });
  });

  describe("FormatSet properties", () => {
    it("should have required unitSystem property", () => {
      expect(formatSet).to.have.property("unitSystem");
      expect(formatSet.unitSystem).to.be.a("string");
      expect(formatSet.unitSystem).to.equal("metric");
    });

    it("should have all required FormatSet properties", () => {
      expect(formatSet).to.have.property("name");
      expect(formatSet).to.have.property("label");
      expect(formatSet).to.have.property("unitSystem");
      expect(formatSet).to.have.property("formats");

      expect(formatSet.name).to.be.a("string");
      expect(formatSet.label).to.be.a("string");
      expect(formatSet.unitSystem).to.be.a("string");
      expect(formatSet.formats).to.be.an("object");
    });

    it("should support different unit system values", () => {
      const unitSystems: ("metric" | "imperial" | "usCustomary" | "usSurvey")[] = ["metric", "imperial", "usCustomary", "usSurvey"];

      unitSystems.forEach(unitSystem => {
        const testFormatSet: FormatSet = {
          name: `Test_${unitSystem}`,
          label: `Test ${unitSystem}`,
          unitSystem,
          formats: {},
        };

        expect(testFormatSet.unitSystem).to.equal(unitSystem);
        expect(testFormatSet).to.have.property("unitSystem");
      });
    });

    it("should maintain unitSystem property after modifications", async () => {
      const originalUnitSystem = formatSet.unitSystem;

      // Add a format
      await provider.addFormat("TestFormat", anotherFormat);
      expect(formatSet.unitSystem).to.equal(originalUnitSystem);

      // Remove a format
      await provider.removeFormat("TestFormat");
      expect(formatSet.unitSystem).to.equal(originalUnitSystem);
    });

    it("should support optional description property", () => {
      // Test FormatSet without description
      const formatSetWithoutDescription: FormatSet = {
        name: "TestWithoutDescription",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {},
      };

      expect(formatSetWithoutDescription).to.not.have.property("description");

      // Test FormatSet with description
      const formatSetWithDescription: FormatSet = {
        name: "TestWithDescription",
        label: "Test Format Set",
        description: "A test format set for demonstration purposes",
        unitSystem: "metric",
        formats: {},
      };

      expect(formatSetWithDescription).to.have.property("description");
      expect(formatSetWithDescription.description).to.be.a("string");
      expect(formatSetWithDescription.description).to.equal("A test format set for demonstration purposes");
    });
  });

  describe("getFormat", () => {
    it("should return format from format set", async () => {
      const format = await provider.getFormat("testFormat");
      expect(format).to.deep.equal(sampleFormat);
    });

    it("should return undefined for non-existent format", async () => {
      const format = await provider.getFormat("NonExistentFormat");
      expect(format).to.be.undefined;
    });

    it("should resolve colon-separated format names to dot-separated names", async () => {
      // Add a format with dot-separated name to the format set
      formatSet.formats["Format.Format1"] = anotherFormat;

      // Request with colon-separated name should resolve to dot-separated
      const format = await provider.getFormat("Format:Format1");
      expect(format).to.deep.equal(anotherFormat);
    });

    it("should work with dot-separated format names directly", async () => {
      // Add a format with dot-separated name to the format set
      formatSet.formats["Schema.KindOfQuantity"] = anotherFormat;

      // Request with dot-separated name should work directly
      const format = await provider.getFormat("Schema.KindOfQuantity");
      expect(format).to.deep.equal(anotherFormat);
    });

    it("should normalize format names when checking fallback provider", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async (name: string) => name === "Schema.Format1" ? anotherFormat : undefined,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      // Request with colon-separated name should be normalized and found in fallback
      const format = await providerWithFallback.getFormat("Schema:Format1");
      expect(format).to.deep.equal(anotherFormat);
    });

    it("should return format from fallback provider when not found in format set", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async (name: string) => name === "FallbackFormat" ? anotherFormat : undefined,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      const format = await providerWithFallback.getFormat("FallbackFormat");
      expect(format).to.deep.equal(anotherFormat);
    });

    it("should prefer format set over fallback provider", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async () => anotherFormat,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      const format = await providerWithFallback.getFormat("testFormat");
      expect(format).to.deep.equal(sampleFormat);
    });

    it("should return undefined when format not found in either format set or fallback provider", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async () => undefined,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      const format = await providerWithFallback.getFormat("NonExistentFormat");
      expect(format).to.be.undefined;
    });

    it("should propagate error from fallback provider", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async () => {
          throw new Error("Fallback provider error");
        },
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      await expect(providerWithFallback.getFormat("TestFormat2")).to.be.rejectedWith("Fallback provider error");
    });
  });

  describe("addFormat", () => {
    it("should add format to format set", async () => {
      await provider.addFormat("NewFormat", anotherFormat);

      expect(formatSet.formats.NewFormat).to.deep.equal(anotherFormat);
      const retrievedFormat = await provider.getFormat("NewFormat");
      expect(retrievedFormat).to.deep.equal(anotherFormat);
    });

    it("should overwrite existing format", async () => {
      await provider.addFormat("testFormat", anotherFormat);

      expect(formatSet.formats.testFormat).to.deep.equal(anotherFormat);
      const retrievedFormat = await provider.getFormat("testFormat");
      expect(retrievedFormat).to.deep.equal(anotherFormat);
    });

    it("should raise onFormatsChanged event when adding format", async () => {
      let eventFired = false;
      let changedFormats: string[] | "all" = [];

      provider.onFormatsChanged.addListener((args) => {
        eventFired = true;
        changedFormats = args.formatsChanged;
      });

      await provider.addFormat("NewFormat", anotherFormat);

      expect(eventFired).to.be.true;
      expect(changedFormats).to.deep.equal(["NewFormat"]);
    });
  });

  describe("removeFormat", () => {
    it("should remove format from format set", async () => {
      await provider.removeFormat("testFormat");

      expect(formatSet.formats.testFormat).to.be.undefined;
      const retrievedFormat = await provider.getFormat("testFormat");
      expect(retrievedFormat).to.be.undefined;
    });

    it("should handle removing non-existent format gracefully", async () => {
      await provider.removeFormat("NonExistentFormat");

      // Should not throw error and other formats should remain
      const retrievedFormat = await provider.getFormat("testFormat");
      expect(retrievedFormat).to.deep.equal(sampleFormat);
    });

    it("should raise onFormatsChanged event when removing format", async () => {
      let eventFired = false;
      let changedFormats: string[] | "all" = [];

      provider.onFormatsChanged.addListener((args) => {
        eventFired = true;
        changedFormats = args.formatsChanged;
      });

      await provider.removeFormat("testFormat");

      expect(eventFired).to.be.true;
      expect(changedFormats).to.deep.equal(["testFormat"]);
    });
  });

  describe("clearFallbackProvider", () => {
    it("should clear fallback provider", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async () => anotherFormat,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const providerWithFallback = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      // Verify fallback works initially
      let format = await providerWithFallback.getFormat("FallbackFormat");
      expect(format).to.deep.equal(anotherFormat);

      // Clear fallback provider
      providerWithFallback.clearFallbackProvider();

      // Verify fallback no longer works
      format = await providerWithFallback.getFormat("FallbackFormat");
      expect(format).to.be.undefined;
    });

    it("should handle clearing fallback provider when none exists", () => {
      // Should not throw error
      expect(() => provider.clearFallbackProvider()).to.not.throw;
    });
  });

  describe("onFormatsChanged event", () => {
    it("should allow multiple listeners", async () => {
      let listener1Called = false;
      let listener2Called = false;

      provider.onFormatsChanged.addListener(() => {
        listener1Called = true;
      });

      provider.onFormatsChanged.addListener(() => {
        listener2Called = true;
      });

      await provider.addFormat("NewFormat", anotherFormat);

      expect(listener1Called).to.be.true;
      expect(listener2Called).to.be.true;
    });

    it("should provide correct format names in event args", async () => {
      const capturedArgs: (string[] | "all")[] = [];

      provider.onFormatsChanged.addListener((args) => {
        capturedArgs.push(args.formatsChanged);
      });

      await provider.addFormat("Format1", anotherFormat);
      await provider.removeFormat("Format1");
      await provider.addFormat("Format2", sampleFormat);

      expect(capturedArgs).to.deep.equal([
        ["Format1"],
        ["Format1"],
        ["Format2"],
      ]);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex workflow with multiple operations", async () => {
      const fallbackProvider: FormatsProvider = {
        getFormat: async (name: string) => name === "FallbackOnly" ? anotherFormat : undefined,
        onFormatsChanged: new BeEvent<(args: { formatsChanged: "all" | string[] }) => void>(),
      };
      const complexProvider = new FormatSetFormatsProvider({ formatSet, fallbackProvider });

      // Add a new format
      await complexProvider.addFormat("NewFormat", anotherFormat);

      // Verify it's accessible
      let format = await complexProvider.getFormat("NewFormat");
      expect(format).to.deep.equal(anotherFormat);

      // Verify fallback still works
      format = await complexProvider.getFormat("FallbackOnly");
      expect(format).to.deep.equal(anotherFormat);

      // Remove the added format
      await complexProvider.removeFormat("NewFormat");
      format = await complexProvider.getFormat("NewFormat");
      expect(format).to.be.undefined;

      // Clear fallback provider
      complexProvider.clearFallbackProvider();
      format = await complexProvider.getFormat("FallbackOnly");
      expect(format).to.be.undefined;

      // Original format should still be there
      format = await complexProvider.getFormat("testFormat");
      expect(format).to.deep.equal(sampleFormat);
    });
  });
});
