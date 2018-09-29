/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../src/Metadata/Schema";
import Constant from "../../src/Metadata/Constant";
import { ECObjectsError } from "../../src/Exception";
import * as sinon from "sinon";
import Phenomenon from "../../src/Metadata/Phenomenon";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { SchemaItemType } from "../../src";

describe("Constant", () => {
  before(() => {
    Schema.ec32 = true;
  });

  after(() => {
    Schema.ec32 = false;
  });

  describe("accept", () => {
    let testConstant: Constant;
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testConstant = new Constant(schema, "TestEnumeration");
    });

    it("should call visitConstant on a SchemaItemVisitor object", async () => {
      expect(testConstant).to.exist;
      const mockVisitor = { visitConstant: sinon.spy() };
      await testConstant.accept(mockVisitor);
      expect(mockVisitor.visitConstant.calledOnce).to.be.true;
      expect(mockVisitor.visitConstant.calledWithExactly(testConstant)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitConstant defined", async () => {
      expect(testConstant).to.exist;
      await testConstant.accept({});
    });
  });

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
    }, true);
  }

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
      const ecSchema = await Schema.fromJson(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);

      expect(testConst.schemaItemType).eql(SchemaItemType.Constant);

      expect(testConst.label).eql("Test Constant");
      expect(testConst.description).eql("testing a constant");

      expect(testConst.numerator).eql(5.5);
      expect(testConst.denominator).eql(5.1);

      assert(testConst.definition, "PI");
      assert.isDefined(testConst.phenomenon);
      expect(await testConst.phenomenon).eql(await ecSchema.getItem<Phenomenon>(testConst.phenomenon!.name));
    });

    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
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
      const ecSchema = await Schema.fromJson(minimumRequired);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);

      expect(testItem!.numerator).eql(1);
      expect(testItem!.denominator).eql(1);
    });

    it("sync - should succeed with defaults with minimum required properties provided", () => {
      const ecSchema = Schema.fromJsonSync(minimumRequired);
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
      await expect(Schema.fromJson(createSchemaJson(missingPhenomenon))).to.be.rejectedWith(ECObjectsError, `The Constant TestConstant does not have the required 'phenomenon' attribute.`);
    });
    it("sync - should throw for missing phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingPhenomenon)), ECObjectsError, `The Constant TestConstant does not have the required 'phenomenon' attribute.`);
    });

    // Invalid phenomenon
    const invalidPhenomenon = {
      definition: "testing",
      phenomenon: 5,
    };
    it("async - should throw for invalid phenomenon", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidPhenomenon))).to.be.rejectedWith(ECObjectsError, `The Constant TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid phenomenon", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidPhenomenon)), ECObjectsError, `The Constant TestConstant has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    });

    // Not found phenomenon
    const nonexistentPhenomenon = {
      definition: "testing",
      phenomenon: "TestSchema.BadPhenomenonName",
    };
    it("async - should throw for phenomenon not found", async () => {
      await expect(Schema.fromJson(createSchemaJson(nonexistentPhenomenon))).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadPhenomenonName does not exist.`);
    });
    it("sync - should throw for phenomenon not found", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(nonexistentPhenomenon)), ECObjectsError, `The SchemaItem BadPhenomenonName does not exist.`);
    });

    // Missing definition
    const missingDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
    };
    it("async - should throw for missing definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(missingDefinition))).to.be.rejectedWith(ECObjectsError, `The Constant TestConstant does not have the required 'definition' attribute.`);
    });
    it("sync - should throw for missing definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(missingDefinition)), ECObjectsError, `The Constant TestConstant does not have the required 'definition' attribute.`);
    });

    // Invalid definition
    const invalidDefinition = {
      phenomenon: "TestSchema.TestPhenomenon",
      definition: 5,
    };
    it("async - should throw for invalid definition", async () => {
      await expect(Schema.fromJson(createSchemaJson(invalidDefinition))).to.be.rejectedWith(ECObjectsError, `The Constant TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for invalid definition", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidDefinition)), ECObjectsError, `The Constant TestConstant has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
  });
  describe("toJson", () => {
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
      const ecSchema = await Schema.fromJson(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJson(true, true);

      expect(constantSerialization.$schema).eql("https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem");
      expect(constantSerialization.name).eql("TestConstant");
      expect(constantSerialization.schemaVersion).eql("1.2.3");
      expect(constantSerialization.schema).eql("TestSchema");

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert(constantSerialization.definition, "PI");
      assert(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined with standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJson(true, true);

      expect(constantSerialization.$schema).eql("https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem");
      expect(constantSerialization.name).eql("TestConstant");
      expect(constantSerialization.schemaVersion).eql("1.2.3");
      expect(constantSerialization.schema).eql("TestSchema");

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert(constantSerialization.definition, "PI");
      assert(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });
    it("async - should succeed with fully defined without standalone", async () => {
      const ecSchema = await Schema.fromJson(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJson(false, true);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert(constantSerialization.definition, "PI");
      assert(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });

    it("sync - should succeed with fully defined without standalone", () => {
      const ecSchema = Schema.fromJsonSync(fullyDefinedConstant);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync<Constant>("TestConstant");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      const constantSerialization = testConst.toJson(false, false);

      expect(constantSerialization.label).eql("Test Constant");
      expect(constantSerialization.description).eql("testing a constant");

      expect(constantSerialization.numerator).eql(5.5);
      expect(constantSerialization.denominator).eql(5.1);

      assert(constantSerialization.definition, "PI");
      assert(constantSerialization.phenomenon, "TestSchema.TestPhenomenon");
    });
  });
});
