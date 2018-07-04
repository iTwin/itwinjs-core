/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import Constant from "../../source/Metadata/Constant";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";
import Phenomenon from "../../source/Metadata/Phenomenon";

describe("Constant tests", () => {
  let testConstant: Constant;
  describe("accept", () => {
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
  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema("ExampleSchema", 1, 0, 0);
      testConstant = new Constant(schema, "PI");
    });
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.definition, "PI");
      assert(testConst.phenomenon, "TestSchema.LENGTH_RATIO");
    });
    it("Label must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
              label: 4,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem PI has an invalid 'label' attribute. It should be of type 'string'.`);
    });
    it("Description must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
              description: 4,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem PI has an invalid 'description' attribute. It should be of type 'string'.`);
    });
    it("Phenomenon is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem",
        schemaItemType: "Constant",
        name: "PI",
        label: "Pi",
        definition: "ONE",
        numerator: 3.1415926535897932384626433832795,
      };
      await expect(testConstant.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI does not have the required 'phenomenon' attribute.`);
    });
    it("Definition is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Constant PI does not have the required 'definition' attribute.`);
    });
    it("Numerator, denominator default values are both 1.0", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              phenomenon: "TestSchema.LENGTH_RATIO",
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.numerator === 1.0);
      assert(testConst.denominator === 1.0);
    });
    it("Numerator, denominator are different than default", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              phenomenon: "TestSchema.LENGTH_RATIO",
              numerator: 3.1415926535897932384626433832795,
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.numerator === 3.1415926535897932384626433832795);
      assert(testConst.denominator === 6.0);
    });
    it("Resolve all dependencies on Phenomenon", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      expect(testConst.denominator).equal(6.0);
      const testPhenom = await ecSchema.getItem("TestSchema.LENGTH_RATIO");
      assert.isDefined(testPhenom);
      assert.isTrue(testPhenom instanceof Phenomenon);
      const phenom: Phenomenon = testPhenom as Phenomenon;
      assert.isDefined(phenom);
      const phenomFromConstant = await testConst!.phenomenon;
      assert(phenomFromConstant!.definition === phenom.definition);
    });
  });
  describe("Sync fromJson", () => {
    it("Basic test", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.definition, "PI");
      assert(testConst.phenomenon, "TestSchema.LENGTH_RATIO");
    });
    it("Label must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
              label: 4,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(json), ECObjectsError, "The SchemaItem PI has an invalid 'label' attribute. It should be of type 'string'.");
    });
    it("Description must be string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
              description: 4,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(json), ECObjectsError, "The SchemaItem PI has an invalid 'description' attribute. It should be of type 'string'.");
    });
    it("Cannot locate Phenomenon", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
              description: 4,
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(json), TypeError, "Cannot read property 'schemaItemType' of undefined");
    });
    it("Definition is required", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(json), ECObjectsError, "The Constant PI does not have the required 'definition' attribute.");
    });
    it("Numerator, denominator default values are both 1.0", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              phenomenon: "TestSchema.LENGTH_RATIO",
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.numerator === 1.0);
      assert(testConst.denominator === 1.0);
    });
    it("Numerator, denominator are different than default", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              phenomenon: "TestSchema.LENGTH_RATIO",
              numerator: 3.1415926535897932384626433832795,
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      assert(testConst.numerator === 3.1415926535897932384626433832795);
      assert(testConst.denominator === 6.0);
    });
    it("Resolve all dependencies on Phenomenon", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          PI: {
              schemaItemType: "Constant",
              numerator: 3.14,
              phenomenon: "TestSchema.LENGTH_RATIO",
              denominator: 6.0,
              definition: "PI",
          },
          LENGTH_RATIO: {
            schemaItemType: "Phenomenon",
            definition: "Units.LENGTH_RATIO",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("PI");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Constant);
      const testConst: Constant = testItem as Constant;
      assert.isDefined(testConst);
      expect(testConst.denominator).equal(6.0);
      const testPhenom = ecSchema.getItemSync("TestSchema.LENGTH_RATIO");
      assert.isDefined(testPhenom);
      assert.isTrue(testPhenom instanceof Phenomenon);
      const phenom: Phenomenon = testPhenom as Phenomenon;
      assert.isDefined(phenom);
      const phenomFromConstant = await testConst!.phenomenon;
      assert(phenomFromConstant!.definition, phenom.definition);
    });
  });
});
