/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { Constant } from "../../Metadata/Constant";
import { Phenomenon } from "../../Metadata/Phenomenon";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Constant", () => {

  function createSchemaJson(constantJson: any): any {
    return createSchemaJsonWithItems({
      TestConstant: {
        schemaItemType: "Constant",
        ...constantJson,
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
      },
    });
  }

  it("should get fullName", async () => {
    const fullyDefinedConstant = createSchemaJson({
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    });

    const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
    expect(ecSchema).toBeDefined();
    const testConst = await ecSchema.getItem("TestConstant", Constant);
    expect(testConst).toBeDefined();
    expect(testConst!.fullName).eq("TestSchema.TestConstant");
  });

  describe("type safety checks", () => {
    const fullyDefinedConstant = createSchemaJson({
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    });

    let ecSchema: Schema;

    beforeEach(async () => {
      ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
    });

    it("typeguard and type assertion should work on Constant", async () => {
      const testConst = await ecSchema.getItem("TestConstant");
      expect(testConst).toBeDefined();
      expect(Constant.isConstant(testConst)).toBe(true);
      expect(() => Constant.assertIsConstant(testConst)).not.toThrow();
      //verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      expect(testPhenomenon).toBeDefined();
      expect(Constant.isConstant(testPhenomenon)).toBe(false);
      expect(() => Constant.assertIsConstant(testPhenomenon)).toThrow();
    });

    it("Constant type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestConstant", Constant)).toBeInstanceOf(Constant);
      expect(ecSchema.getItemSync("TestConstant", Constant)).toBeInstanceOf(Constant);
    });

    it("Constant type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", Constant)).toBeUndefined();
      expect(ecSchema.getItemSync("TestPhenomenon", Constant)).toBeUndefined();
    });
  });

  describe("deserialization", () => {
    // Fully defined constant
    const fullyDefinedConstant = createSchemaJson({
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    });

    it("async - should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();

      expect(testConst.schemaItemType).toEqual(SchemaItemType.Constant);

      expect(testConst.label).toEqual("Test Constant");
      expect(testConst.description).toEqual("testing a constant");

      expect(testConst.numerator).toEqual(5.5);
      expect(testConst.denominator).toEqual(5.1);

      expect(testConst.definition).toBe("PI");
      expect(testConst.phenomenon).toBeDefined();
      expect(await testConst.phenomenon).toEqual(await ecSchema.getItem(testConst.phenomenon!.name, Phenomenon));
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = ecSchema.getItemSync("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();

      expect(testConst.schemaItemType).toEqual(SchemaItemType.Constant);

      expect(testConst.label).toEqual("Test Constant");
      expect(testConst.description).toEqual("testing a constant");

      expect(testConst.numerator).toEqual(5.5);
      expect(testConst.denominator).toEqual(5.1);

      expect(testConst.definition).toEqual("PI");
      expect(testConst.phenomenon).toBeDefined();
      expect(testConst.phenomenon!.name).toEqual("TestPhenomenon");
      expect(ecSchema.getItemSync(testConst.phenomenon!.name)).toBeDefined();
    });

    // minimum required values
    const minimumRequired = createSchemaJson({
      definition: "testing",
      phenomenon: "TestSchema.TestPhenomenon",
    });

    it("async - should succeed with defaults with minimum required properties provided", async () => {
      const ecSchema = await Schema.fromJson(minimumRequired, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();

      expect(testItem!.numerator).toEqual(1);
      expect(testItem!.denominator).toEqual(1);
    });

    it("sync - should succeed with defaults with minimum required properties provided", () => {
      const ecSchema = Schema.fromJsonSync(minimumRequired, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = ecSchema.getItemSync("TestConstant", Constant);
      expect(testItem).toBeDefined();

      expect(testItem!.numerator).toEqual(1);
      expect(testItem!.denominator).toEqual(1);
    });

    // Missing phenomenon
    const missingPhenomenon = {
      definition: "testing",
    };
    it("async - should throw for missing phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingPhenomenon), new SchemaContext())).rejects.toThrow(`The Constant TestSchema.TestConstant does not have the required 'phenomenon' attribute.`);
    });
    it("sync - should throw for missing phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenon), new SchemaContext()), ECSchemaError, `The Constant TestSchema.TestConstant does not have the required 'phenomenon' attribute.`);
    });

    // Invalid phenomenon
    const invalidPhenomenon = {
      definition: "testing",
      phenomenon: 5,
    };
    it("async - should throw for invalid phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidPhenomenon), new SchemaContext())).rejects.toThrow(`The Constant TestSchema.TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenon), new SchemaContext()), ECSchemaError, `The Constant TestSchema.TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });

    // Not found phenomenon
    const nonexistentPhenomenon = {
      definition: "testing",
      phenomenon: "TestSchema.BadPhenomenonName",
    };
    it("async - should throw for phenomenon not found", async () => {
      await expect(Schema.fromJson(createSchemaJson(nonexistentPhenomenon), new SchemaContext())).rejects.toThrow(`Unable to locate SchemaItem TestSchema.BadPhenomenonName.`);
    });
    it("sync - should throw for phenomenon not found", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(nonexistentPhenomenon), new SchemaContext()), ECSchemaError, `Unable to locate SchemaItem TestSchema.BadPhenomenonName.`);
    });

    // Missing definition
    const missingDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
    };
    it("async - should throw for missing definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingDefinition), new SchemaContext())).rejects.toThrow(`The Constant TestSchema.TestConstant does not have the required 'definition' attribute.`);
    });
    it("sync - should throw for missing definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingDefinition), new SchemaContext()), ECSchemaError, `The Constant TestSchema.TestConstant does not have the required 'definition' attribute.`);
    });

    // Invalid definition
    const invalidDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
      definition: 5,
    };
    it("async - should throw for invalid definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDefinition), new SchemaContext())).rejects.toThrow(`The Constant TestSchema.TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDefinition), new SchemaContext()), ECSchemaError, `The Constant TestSchema.TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
  });

  describe("toJSON", () => {
    // Fully defined constant
    const fullyDefinedConstant = createSchemaJson({
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    });

    it("async - should succeed with fully defined with standalone", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.$schema).toEqual(ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      expect(constantSerialization.name).toEqual("TestConstant");
      expect(constantSerialization.schemaVersion).toEqual("01.02.03");
      expect(constantSerialization.schema).toEqual("TestSchema");

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined with standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = ecSchema.getItemSync("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.$schema).toEqual(ECSchemaNamespaceUris.SCHEMAITEMURL3_2);
      expect(constantSerialization.name).toEqual("TestConstant");
      expect(constantSerialization.schemaVersion).toEqual("01.02.03");
      expect(constantSerialization.schema).toEqual("TestSchema");

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("async - should succeed with fully defined without standalone", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(false, true);

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("async - JSON stringify, should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const json = JSON.stringify(testConst);
      const constantSerialization = JSON.parse(json);

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined without standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = ecSchema.getItemSync("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(false, false);

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("sync - JSON stringify, should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = ecSchema.getItemSync("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const json = JSON.stringify(testConst);
      const constantSerialization = JSON.parse(json);

      expect(constantSerialization.label).toEqual("Test Constant");
      expect(constantSerialization.description).toEqual("testing a constant");

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toEqual(5.1);

      expect(constantSerialization.definition).toBe("PI");
      expect(constantSerialization.phenomenon).toBe("TestSchema.TestPhenomenon");
    });

    it("Numerator is explicitly set, default values of numerator and denominator should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Test Constant",
        description: "testing a constant",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "PI",
        numerator: 5.5,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.numerator).toEqual(5.5);
      expect(constantSerialization.denominator).toBeUndefined();
    });

    it("Denominator is explicitly set, default values of numerator and denominator should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Test Constant",
        description: "testing a constant",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "PI",
        denominator: 5.1,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testItem = await ecSchema.getItem("TestConstant", Constant);
      expect(testItem).toBeDefined();
      expect(testItem?.schemaItemType === SchemaItemType.Constant).toBe(true);
      const testConst: Constant = testItem as Constant;
      expect(testConst).toBeDefined();
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.numerator).toBeUndefined();
      expect(constantSerialization.denominator).toEqual(5.1);
    });
  });

  describe("toXml", () => {
    const fullyDefinedConstant = createSchemaJson({
      label: "Test Constant",
      description: "testing a constant",
      phenomenon: "TestSchema.TestPhenomenon",
      definition: "PI",
      numerator: 5.5,
      denominator: 5.1,
    });
    const newDom = createEmptyXmlDocument();

    it("should properly serialize with all defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testConstant = await ecSchema.getItem("TestConstant", Constant);
      expect(testConstant).toBeDefined();
      const serialized = await testConstant!.toXml(newDom);
      expect(serialized.nodeName).toEqual("Constant");
      expect(serialized.getAttribute("definition")).toEqual("PI");
      expect(serialized.getAttribute("denominator")).toEqual("5.1");
      expect(serialized.getAttribute("numerator")).toEqual("5.5");
      expect(serialized.getAttribute("phenomenon")).toEqual("TestPhenomenon");
    });

    it("Numerator is explicitly set, default values of numerator and denominator should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Test Constant",
        description: "testing a constant",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "PI",
        numerator: 5.5,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testConstant = await ecSchema.getItem("TestConstant", Constant);
      expect(testConstant).toBeDefined();
      const serialized = await testConstant!.toXml(newDom);

      expect(serialized.getAttribute("denominator")).toEqual("");
      expect(serialized.getAttribute("numerator")).toEqual("5.5");
    });

    it("Denominator is explicitly set, default values of numerator and denominator should not be serialized", async () => {
      const schemaJson = createSchemaJson({
        label: "Test Constant",
        description: "testing a constant",
        phenomenon: "TestSchema.TestPhenomenon",
        definition: "PI",
        denominator: 5.1,
      });

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
      const testConstant = await ecSchema.getItem("TestConstant", Constant);
      expect(testConstant).toBeDefined();
      const serialized = await testConstant!.toXml(newDom);

      expect(serialized.getAttribute("denominator")).toEqual("5.1");
      expect(serialized.getAttribute("numerator")).toEqual("");
    });
  });
});
