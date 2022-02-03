/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import type { Constant } from "../../Metadata/Constant";
import type { Phenomenon } from "../../Metadata/Phenomenon";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

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
    assert.isDefined(ecSchema);
    const testConst = await ecSchema.getItem<Constant>("TestConstant");
    assert.isDefined(testConst);
    expect(testConst!.fullName).eq("TestSchema.TestConstant");
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
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);

      expect(testConst.schemaItemType).eql(SchemaItemType.Constant);

      expect(testConst.label).eql("Test Constant");
      expect(testConst.description).eql("testing a constant");

      expect(testConst.numerator).eql(5.5);
      expect(testConst.denominator).eql(5.1);

      assert.strictEqual(testConst.definition, "PI");
      assert.isDefined(testConst.phenomenon);
      expect(await testConst.phenomenon).eql(await ecSchema.getItem<Phenomenon>(testConst.phenomenon!.name));
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);

      expect(testConst.schemaItemType).eql(SchemaItemType.Constant);

      expect(testConst.label).eql("Test Constant");
      expect(testConst.description).eql("testing a constant");

      expect(testConst.numerator).eql(5.5);
      expect(testConst.denominator).eql(5.1);

      expect(testConst.definition).eql("PI");
      assert.isDefined(testConst.phenomenon);
      expect(testConst.phenomenon!.name).eql("TestPhenomenon");
      assert.isDefined(ecSchema.getItemSync(testConst.phenomenon!.name));
    });

    // minimum required values
    const minimumRequired = createSchemaJson({
      definition: "testing",
      phenomenon: "TestSchema.TestPhenomenon",
    });
    it("async - should succeed with defaults with minimum required properties provided", async () => {
      const ecSchema = await Schema.fromJson(minimumRequired, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);

      expect(testItem!.numerator).eql(1);
      expect(testItem!.denominator).eql(1);
    });

    it("sync - should succeed with defaults with minimum required properties provided", () => {
      const ecSchema = Schema.fromJsonSync(minimumRequired, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);

      expect(testItem!.numerator).eql(1);
      expect(testItem!.denominator).eql(1);
    });

    // Missing phenomenon
    const missingPhenomenon = {
      definition: "testing",
    };
    it("async - should throw for missing phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingPhenomenon), new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Constant TestSchema.TestConstant does not have the required 'phenomenon' attribute.`);
    });
    it("sync - should throw for missing phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenon), new SchemaContext()), ECObjectsError, `The Constant TestSchema.TestConstant does not have the required 'phenomenon' attribute.`);
    });

    // Invalid phenomenon
    const invalidPhenomenon = {
      definition: "testing",
      phenomenon: 5,
    };
    it("async - should throw for invalid phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidPhenomenon), new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Constant TestSchema.TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenon), new SchemaContext()), ECObjectsError, `The Constant TestSchema.TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });

    // Not found phenomenon
    const nonexistentPhenomenon = {
      definition: "testing",
      phenomenon: "TestSchema.BadPhenomenonName",
    };
    it("async - should throw for phenomenon not found", async () => {
      await expect(Schema.fromJson(createSchemaJson(nonexistentPhenomenon), new SchemaContext())).to.be.rejectedWith(ECObjectsError, `Unable to locate SchemaItem TestSchema.BadPhenomenonName.`);
    });
    it("sync - should throw for phenomenon not found", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(nonexistentPhenomenon), new SchemaContext()), ECObjectsError, `Unable to locate SchemaItem TestSchema.BadPhenomenonName.`);
    });

    // Missing definition
    const missingDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
    };
    it("async - should throw for missing definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingDefinition), new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Constant TestSchema.TestConstant does not have the required 'definition' attribute.`);
    });
    it("sync - should throw for missing definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingDefinition), new SchemaContext()), ECObjectsError, `The Constant TestSchema.TestConstant does not have the required 'definition' attribute.`);
    });

    // Invalid definition
    const invalidDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
      definition: 5,
    };
    it("async - should throw for invalid definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDefinition), new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Constant TestSchema.TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDefinition), new SchemaContext()), ECObjectsError, `The Constant TestSchema.TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
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
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.$schema).eql("https://dev.bentley.com/json_schemas/ec/32/schemaitem");
      expect(constantSerialization.name).eql("TestConstant");
      expect(constantSerialization.schemaVersion).eql("01.02.03");
      expect(constantSerialization.schema).eql("TestSchema");

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined with standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJSON(true, true);

      expect(constantSerialization.$schema).eql("https://dev.bentley.com/json_schemas/ec/32/schemaitem");
      expect(constantSerialization.name).eql("TestConstant");
      expect(constantSerialization.schemaVersion).eql("01.02.03");
      expect(constantSerialization.schema).eql("TestSchema");

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("async - should succeed with fully defined without standalone", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJSON(false, true);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("async - JSON stringify, should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const json = JSON.stringify(testConst);
      const constantSerialization = JSON.parse(json);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined without standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJSON(false, false);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("sync - JSON stringify, should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const json = JSON.stringify(testConst);
      const constantSerialization = JSON.parse(json);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert.strictEqual(constantSerialization.definition, "PI");
      assert.strictEqual(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
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

    it("should properly serialize", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant, new SchemaContext());
      assert.isDefined(ecSchema);
      const testConstant = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testConstant);
      const serialized = await testConstant!.toXml(newDom);
      expect(serialized.nodeName).to.eql("Constant");
      expect(serialized.getAttribute("definition")).to.eql("PI");
      expect(serialized.getAttribute("denominator")).to.eql("5.1");
      expect(serialized.getAttribute("numerator")).to.eql("5.5");
      expect(serialized.getAttribute("phenomenon")).to.eql("TestPhenomenon");
    });
  });
});
