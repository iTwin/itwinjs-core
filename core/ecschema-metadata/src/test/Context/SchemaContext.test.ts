/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SchemaCache, SchemaContext } from "../../Context";
import { SchemaMatchType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { Schema } from "../../Metadata/Schema";
import { SchemaItemKey, SchemaKey } from "../../SchemaKey";
import { EntityClass } from "../../Metadata/EntityClass";
import { SchemaItem } from "../../Metadata/SchemaItem";
import { CustomAttributeClass, ECSchemaNamespaceUris, Enumeration, Format, KindOfQuantity, Mixin, Phenomenon, RelationshipClass, StructClass, Unit, UnitSystem } from "../../ecschema-metadata";

const assert = chai.assert;
const expect = chai.expect;

chai.use(chaiAsPromised);

describe("Schema Context", () => {
  it("should succeed locating added schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isDefined(foundSchema);
    assert.strictEqual(foundSchema, schema);
  });

  it("returns undefined when schema does not exist", async () => {
    const context = new SchemaContext();

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const foundSchema = await context.getSchema(testKey);

    assert.isUndefined(foundSchema);
  });

  it("does not allow duplicate schemas", async () => {
    const context = new SchemaContext();

    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    const schema2 = new Schema(context, "TestSchema", "ts", 1, 0, 5);

    await context.addSchema(schema);
    await expect(context.addSchema(schema2)).to.be.rejectedWith(ECObjectsError);
  });

  it("schema added, getCachedSchema returns the schema", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).to.equal(schema);
  });

  it("schema not added, getCachedSchema returns undefined", async () => {
    const context = new SchemaContext();
    const testKey = new SchemaKey("TestSchema", 1, 5, 9);
    const loadedSchema = await context.getCachedSchema(testKey);

    assert.isUndefined(loadedSchema);
  });

  it("schema added, getCachedSchema called with different schema version and incompatible match type, returns undefined", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey, SchemaMatchType.Exact);

    assert.isUndefined(loadedSchema);
  });

  it("schema added, getCachedSchema called with different schema version with compatible match type, returns true", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey, SchemaMatchType.LatestReadCompatible);

    expect(loadedSchema).to.equal(schema);
  });

  it("schema added, getCachedSchema called with different schema version with compatible match type (default), returns true", async () => {
    const context = new SchemaContext();
    const schema = new Schema(context, "TestSchema", "ts", 1, 5, 9);

    await context.addSchema(schema);

    const testKey = new SchemaKey("TestSchema", 1, 5, 8);
    const loadedSchema = await context.getCachedSchema(testKey);

    expect(loadedSchema).to.equal(schema);
  });

  it("successfully finds schema from added locater", async () => {
    const context = new SchemaContext();

    const cache = new SchemaCache();
    const schema = new Schema(context, "TestSchema", "ts", 1, 0, 5);
    await cache.addSchema(schema);

    context.addLocater(cache);
    expect(await context.getSchema(schema.schemaKey)).to.equal(schema);
    expect(await context.getSchema(schema.schemaKey, SchemaMatchType.Exact)).to.equal(schema);

    // Check if the schema is found if it is added to the cache after the cache is added as a locater
    const cache2 = new SchemaCache();
    context.addLocater(cache2);
    const schema2 = new Schema(context, "TestSchema", "ts", 1, 0, 10);
    await cache2.addSchema(schema2);
    expect(await context.getSchema(schema2.schemaKey, SchemaMatchType.Exact)).to.equal(schema2);

    // We should still get TestSchema 1.0.5 for SchemaMatchType.Latest, since cache was added _before_ cache2
    expect(await context.getSchema(schema2.schemaKey)).to.equal(schema);
  });

  it("getKnownSchemas should return all schemas from schema cache", async () => {
    const context = new SchemaContext();

    const schema1 = new Schema(context, new SchemaKey("TestSchema"), "ts");
    await context.addSchema(schema1);

    const schema2 = new Schema(context, new SchemaKey("TestSchema2"), "ts");
    await context.addSchema(schema2);

    const schemas = Array.from(context.getKnownSchemas());
    expect(schemas.length).to.equal(2);
    expect(schemas[0].schemaKey.matches(schema1.schemaKey)).to.be.true;
    expect(schemas[1].schemaKey.matches(schema2.schemaKey)).to.be.true;
  });

  describe("getSchemaItem (sync and async)", () => {
    const context = new SchemaContext();
    type TestCase<T extends typeof SchemaItem> = [number, string, T, boolean];

    const testCases: TestCase<typeof SchemaItem>[] = [
      [1, "TestEntityClass", EntityClass, true],
      [2, "TestMixin", Mixin, true],
      [3, "TestCustomAttributeClass", CustomAttributeClass, true],
      [4, "TestStructClass", StructClass, true],
      [5, "TestRelationshipClass", RelationshipClass, true],
      [6, "TestUnitSystem", UnitSystem, true],
      [7, "TestPhenomenon", Phenomenon, true],
      [8, "TestUnit", Unit, true],
      [9, "TestKoQ", KindOfQuantity, true],
      [10,"TestFormat", Format, true],
      [11,"TestEnum", Enumeration, true],

      [12, "TestEntityClass", Mixin, false],
      [13, "TestMixin", EntityClass, false],
      [14, "TestCustomAttributeClass", StructClass, false],
      [15, "TestStructClass", EntityClass, false],
      [16, "TestRelationshipClass", EntityClass, false],
      [17, "TestUnitSystem", Unit, false],
      [18, "TestPhenomenon", UnitSystem, false],
      [19, "TestUnit", Phenomenon, false],
      [20, "TestKoQ", Unit, false],
      [21, "TestFormat", KindOfQuantity, false],
      [22, "TestEnum", EntityClass, false],
    ];

    before(async () => {
      const schemaJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.0.0",
        alias: "ts",
        items: {
          testEntityClass: { schemaItemType: "EntityClass", label: "TestEntityClass", description: "An example entity class.", },
          testMixin: { schemaItemType: "Mixin", appliesTo: "TestSchema.TestEntityClass", },
          testCustomAttributeClass: { schemaItemType: "CustomAttributeClass", label: "TestCustomAttributeClass", appliesTo: "Any", },
          testStructClass: { schemaItemType: "StructClass", name: "TestStructClass", modifier: "sealed", },
          testRelationshipClass: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: { multiplicity: "(0..*)", roleLabel: "refers to", polymorphic: true, constraintClasses: ["TestSchema.TestEntityClass",], },
            target: { multiplicity: "(0..*)", roleLabel: "is referenced by", polymorphic: true, constraintClasses: ["TestSchema.TestEntityClass",],},
          },

          testUnitSystem: { schemaItemType: "UnitSystem", },
          testPhenomenon: { schemaItemType: "Phenomenon", definition: "TestPhenomenon", },
          testUnit: { schemaItemType: "Unit", unitSystem: "TestSchema.TestUnitSystem", phenomenon: "TestSchema.TestPhenomenon", definition: "TestUnit",},
          testKoQ: { schemaItemType: "KindOfQuantity", description: "Description of koq", persistenceUnit: "TestSchema.TestUnit", relativeError: 1.23, },

          testFormat: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 8,
            formatTraits: ["KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel",],
            decimalSeparator: ",",
            thousandSeparator: ".",
            uomSeparator: "",
            composite: { spacer: "", units: [{ name: "TestSchema.TestUnit", label: "'",},],},
          },
          testEnum: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [ { name: "ZeroValue", value: 0, label: "None", }, { name: "OneValue", value: 1, label: "One", },],
          },
        },
      };
      const schema = await Schema.fromJson(schemaJson, context);
      assert.isDefined(schema);
    })

    it("getSchemaItem with different schema item constructors", async () => {
      for (const [testCaseNumber, schemaItemName, schemaItemType, shouldSucceed] of testCases) {
        const schemaItem = await context.getSchemaItem(`TestSchema.${schemaItemName}`, schemaItemType);

        if (shouldSucceed) {
          assert.isDefined(schemaItem, `Failed to get schema item ${schemaItemName} for test case number ${testCaseNumber}`);
          assert.isTrue(schemaItem instanceof schemaItemType, `Expected schema item to be of type ${schemaItemType.name} for test case number ${testCaseNumber}`);
        } else {
          assert.isUndefined(schemaItem, `Unexpectedly found schema item ${schemaItemName} for test case number ${testCaseNumber}. Should have returned undefined`);
        }
      }
    });

    function testSchemaItem(testCaseNumber: number, schemaItem: SchemaItem | undefined, expectedSchemaItemType: typeof SchemaItem) {
      assert.isDefined(schemaItem, `Failed to get schema item for test case number ${testCaseNumber}`);
      assert.isTrue(schemaItem instanceof expectedSchemaItemType, `Expected schema item to be of type ${expectedSchemaItemType.name} for test case number ${testCaseNumber}`);
    }

    it("getSchemaItem with different function arguments", async () => {
      for (const [testCaseNumber, schemaItemName, schemaItemType, shouldSucceed] of testCases) {
        if (!shouldSucceed)
          continue;

        const getSchemaItemArgs = [
          new SchemaItemKey(schemaItemName, new SchemaKey("TestSchema")),
          ["TestSchema", schemaItemName],
          `TestSchema.${schemaItemName}`,
          `TestSchema:${schemaItemName}`,
        ];

        for (const argument of getSchemaItemArgs) {
          let schemaItem: any
          if (Array.isArray(argument)) {
            schemaItem = await context.getSchemaItem(argument[0], argument[1]);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
            schemaItem = await context.getSchemaItem(argument[0], argument[1], schemaItemType);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
          } else {
            schemaItem = await context.getSchemaItem(argument);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
            schemaItem = await context.getSchemaItem(argument, schemaItemType);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
          }
        }
      }
    });

    it("getSchemaItemSync with different schema item constructors", () => {
      for (const [testCaseNumber, schemaItemName, schemaItemType, shouldSucceed] of testCases) {
        const schemaItem = context.getSchemaItemSync(`TestSchema.${schemaItemName}`, schemaItemType);

        if (shouldSucceed) {
          assert.isDefined(schemaItem, `Failed to get schema item ${schemaItemName} for test case number ${testCaseNumber}`);
          assert.isTrue(schemaItem instanceof schemaItemType, `Expected schema item to be of type ${schemaItemType.name} for test case number ${testCaseNumber}`);
        } else {
          assert.isUndefined(schemaItem, `Unexpectedly found schema item ${schemaItemName} for test case number ${testCaseNumber}. Should have returned undefined`);
        }
      }
    });

    it("getSchemaItemSync with different function arguments", () => {
      for (const [testCaseNumber, schemaItemName, schemaItemType, shouldSucceed] of testCases) {
        if (!shouldSucceed)
          continue;

        const getSchemaItemArgs = [
          new SchemaItemKey(schemaItemName, new SchemaKey("TestSchema")),
          ["TestSchema", schemaItemName],
          `TestSchema.${schemaItemName}`,
          `TestSchema:${schemaItemName}`,
        ];

        for (const argument of getSchemaItemArgs) {
          let schemaItem: any
          if (Array.isArray(argument)) {
            schemaItem = context.getSchemaItemSync(argument[0], argument[1]);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
            schemaItem = context.getSchemaItemSync(argument[0], argument[1], schemaItemType);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
          } else {
            schemaItem = context.getSchemaItemSync(argument);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
            schemaItem = context.getSchemaItemSync(argument, schemaItemType);
            testSchemaItem(testCaseNumber, schemaItem, schemaItemType);
          }
        }
      }
    });
  });
});
