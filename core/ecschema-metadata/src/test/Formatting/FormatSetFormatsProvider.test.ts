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

  describe("string references to other kindOfQuantity formats", () => {
    it("should resolve format from string reference to another kindOfQuantityId", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Get the referenced format - should resolve the string reference and return the FormatDefinition
      const distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");

      // Should return the resolved FormatDefinition, not the string reference
      expect(distanceFormat).to.deep.equal(sampleFormat);
    });

    it("should resolve chain of string references", async () => {
      const formatSetWithChain: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.DISTANCE",
        },
      };
      const providerWithChain = new FormatSetFormatsProvider({ formatSet: formatSetWithChain });

      // All references should resolve to the final FormatDefinition
      const heightFormat = await providerWithChain.getFormat("Schema.HEIGHT");
      expect(heightFormat).to.deep.equal(sampleFormat);

      const distanceFormat = await providerWithChain.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(sampleFormat);

      const lengthFormat = await providerWithChain.getFormat("Schema.LENGTH");
      expect(lengthFormat).to.deep.equal(sampleFormat);
    });

    it("should resolve string reference with colon-separated names", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "imperial",
        formats: {
          "Schema.FT": anotherFormat,
          "Schema.HEIGHT": "Schema.FT",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Request with colon-separated name should resolve to the FormatDefinition
      const heightFormat = await providerWithReference.getFormat("Schema:HEIGHT");
      expect(heightFormat).to.deep.equal(anotherFormat);
    });

    it("should resolve string reference when added via addFormat", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Add a string reference
      await providerWithReference.addFormat("Schema.DISTANCE", "Schema.LENGTH" as unknown as FormatDefinition);

      // Should resolve the string reference and return the FormatDefinition
      const distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(sampleFormat);

      // The underlying format set should still contain the string reference
      expect(formatSetWithReference.formats["Schema.DISTANCE"]).to.equal("Schema.LENGTH");
    });

    it("should return undefined for reference to non-existent format", async () => {
      const formatSetWithBadReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.DISTANCE": "Schema.NonExistent",
        },
      };
      const providerWithBadReference = new FormatSetFormatsProvider({ formatSet: formatSetWithBadReference });

      // Should return undefined when the referenced format doesn't exist
      const distanceFormat = await providerWithBadReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.be.undefined;
    });

    it("should resolve both FormatDefinitions and string references correctly", async () => {
      const formatSetMixed: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.WIDTH": anotherFormat,
          "Schema.HEIGHT": "Schema.LENGTH",
          "Schema.DEPTH": "Schema.WIDTH",
        },
      };
      const providerMixed = new FormatSetFormatsProvider({ formatSet: formatSetMixed });

      // Check direct FormatDefinitions
      const lengthFormat = await providerMixed.getFormat("Schema.LENGTH");
      expect(lengthFormat).to.deep.equal(sampleFormat);

      const widthFormat = await providerMixed.getFormat("Schema.WIDTH");
      expect(widthFormat).to.deep.equal(anotherFormat);

      // Check string references - should resolve to FormatDefinitions
      const heightFormat = await providerMixed.getFormat("Schema.HEIGHT");
      expect(heightFormat).to.deep.equal(sampleFormat);

      const depthFormat = await providerMixed.getFormat("Schema.DEPTH");
      expect(depthFormat).to.deep.equal(anotherFormat);
    });

    it("should resolve string references through fallback provider", async () => {
      const fallbackFormatSet: FormatSet = {
        name: "FallbackFormatSet",
        label: "Fallback Format Set",
        unitSystem: "metric",
        formats: {
          "Fallback.LENGTH": sampleFormat,
          "Fallback.DISTANCE": "Fallback.LENGTH",
        },
      };
      const fallbackProvider = new FormatSetFormatsProvider({ formatSet: fallbackFormatSet });

      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.HEIGHT": "Fallback.LENGTH",
        },
      };
      const providerWithFallback = new FormatSetFormatsProvider({
        formatSet: formatSetWithReference,
        fallbackProvider,
      });

      // Should resolve string reference by looking up the target in fallback provider
      const heightFormat = await providerWithFallback.getFormat("Schema.HEIGHT");
      expect(heightFormat).to.deep.equal(sampleFormat);

      // Should be able to resolve directly from fallback provider
      const fallbackLengthFormat = await providerWithFallback.getFormat("Fallback.LENGTH");
      expect(fallbackLengthFormat).to.deep.equal(sampleFormat);

      // Should resolve string reference in fallback provider
      const fallbackDistanceFormat = await providerWithFallback.getFormat("Fallback.DISTANCE");
      expect(fallbackDistanceFormat).to.deep.equal(sampleFormat);
    });

    it("should remove string reference format", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Verify reference resolves correctly
      let distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(sampleFormat);

      // Remove the reference
      await providerWithReference.removeFormat("Schema.DISTANCE");

      // Verify reference is gone
      distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.be.undefined;

      // Verify the target format still exists
      const lengthFormat = await providerWithReference.getFormat("Schema.LENGTH");
      expect(lengthFormat).to.deep.equal(sampleFormat);
    });

    it("should update string reference to point to different format", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.WIDTH": anotherFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Verify initial reference resolves to sampleFormat
      let distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(sampleFormat);

      // Update the reference to point to a different format
      await providerWithReference.addFormat("Schema.DISTANCE", "Schema.WIDTH" as unknown as FormatDefinition);

      // Verify updated reference resolves to anotherFormat
      distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(anotherFormat);
    });

    it("should update string reference to FormatDefinition", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      // Verify initial reference resolves to sampleFormat
      let distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(sampleFormat);

      // Update the reference to be a direct FormatDefinition
      await providerWithReference.addFormat("Schema.DISTANCE", anotherFormat);

      // Verify it now returns the new FormatDefinition directly (not a reference)
      distanceFormat = await providerWithReference.getFormat("Schema.DISTANCE");
      expect(distanceFormat).to.deep.equal(anotherFormat);

      // Verify the underlying format set now contains a FormatDefinition, not a string
      expect(formatSetWithReference.formats["Schema.DISTANCE"]).to.deep.equal(anotherFormat);
    });
  });

  describe("formatsChanged event with references", () => {
    it("should include referencing formats when adding a referenced format", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      let capturedFormats: string[] | "all" = [];
      providerWithReference.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Add the referenced format - should notify both the format and its references
      await providerWithReference.addFormat("Schema.LENGTH", sampleFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(2);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
    });

    it("should include referencing formats when removing a referenced format", async () => {
      const formatSetWithReference: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
        },
      };
      const providerWithReference = new FormatSetFormatsProvider({ formatSet: formatSetWithReference });

      let capturedFormats: string[] | "all" = [];
      providerWithReference.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Remove the referenced format - should notify both the format and its references
      await providerWithReference.removeFormat("Schema.LENGTH");

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(2);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
    });

    it("should include all referencing formats in a chain when updating a format", async () => {
      const formatSetWithChain: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.DISTANCE",
        },
      };
      const providerWithChain = new FormatSetFormatsProvider({ formatSet: formatSetWithChain });

      let capturedFormats: string[] | "all" = [];
      providerWithChain.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Update the base format - should notify all formats in the chain
      await providerWithChain.addFormat("Schema.LENGTH", anotherFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(3);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
      expect(capturedFormats).to.include("Schema.HEIGHT");
    });

    it("should include all referencing formats in a chain when removing a format", async () => {
      const formatSetWithChain: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.DISTANCE",
        },
      };
      const providerWithChain = new FormatSetFormatsProvider({ formatSet: formatSetWithChain });

      let capturedFormats: string[] | "all" = [];
      providerWithChain.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Remove the base format - should notify all formats in the chain
      await providerWithChain.removeFormat("Schema.LENGTH");

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(3);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
      expect(capturedFormats).to.include("Schema.HEIGHT");
    });

    it("should include multiple referencing formats when updating a format", async () => {
      const formatSetWithMultipleRefs: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.LENGTH",
          "Schema.DEPTH": "Schema.LENGTH",
        },
      };
      const providerWithMultipleRefs = new FormatSetFormatsProvider({ formatSet: formatSetWithMultipleRefs });

      let capturedFormats: string[] | "all" = [];
      providerWithMultipleRefs.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Update the referenced format - should notify the format and all its references
      await providerWithMultipleRefs.addFormat("Schema.LENGTH", anotherFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(4);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
      expect(capturedFormats).to.include("Schema.HEIGHT");
      expect(capturedFormats).to.include("Schema.DEPTH");
    });

    it("should only include the format itself when no references exist", async () => {
      const formatSetNoRefs: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.Different": anotherFormat,
        },
      };
      const providerNoRefs = new FormatSetFormatsProvider({ formatSet: formatSetNoRefs });

      let capturedFormats: string[] | "all" = [];
      providerNoRefs.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Update a format that has no references
      await providerNoRefs.addFormat("Schema.LENGTH", anotherFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.deep.equal(["Schema.LENGTH"]);
      expect(capturedFormats).to.have.lengthOf(1);
    });

    it("should include referencing formats when updating a middle format in a chain", async () => {
      const formatSetWithChain: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.DISTANCE",
        },
      };
      const providerWithChain = new FormatSetFormatsProvider({ formatSet: formatSetWithChain });

      let capturedFormats: string[] | "all" = [];
      providerWithChain.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Update the middle format - should notify it and HEIGHT (but not LENGTH)
      await providerWithChain.addFormat("Schema.DISTANCE", anotherFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(2);
      expect(capturedFormats).to.include("Schema.DISTANCE");
      expect(capturedFormats).to.include("Schema.HEIGHT");
      expect(capturedFormats).to.not.include("Schema.LENGTH");
    });

    it("should handle complex reference graph with multiple branches", async () => {
      const formatSetWithGraph: FormatSet = {
        name: "TestFormatSet",
        label: "Test Format Set",
        unitSystem: "metric",
        formats: {
          "Schema.LENGTH": sampleFormat,
          "Schema.DISTANCE": "Schema.LENGTH",
          "Schema.WIDTH": "Schema.LENGTH",
          "Schema.HEIGHT": "Schema.DISTANCE",
          "Schema.DEPTH": "Schema.DISTANCE",
        },
      };
      const providerWithGraph = new FormatSetFormatsProvider({ formatSet: formatSetWithGraph });

      let capturedFormats: string[] | "all" = [];
      providerWithGraph.onFormatsChanged.addListener((args) => {
        capturedFormats = args.formatsChanged;
      });

      // Update LENGTH - should notify all formats in the graph
      await providerWithGraph.addFormat("Schema.LENGTH", anotherFormat);

      expect(capturedFormats).to.be.an("array");
      expect(capturedFormats).to.have.lengthOf(5);
      expect(capturedFormats).to.include("Schema.LENGTH");
      expect(capturedFormats).to.include("Schema.DISTANCE");
      expect(capturedFormats).to.include("Schema.WIDTH");
      expect(capturedFormats).to.include("Schema.HEIGHT");
      expect(capturedFormats).to.include("Schema.DEPTH");
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
