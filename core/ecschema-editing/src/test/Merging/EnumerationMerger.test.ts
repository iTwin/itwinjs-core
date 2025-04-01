/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClass, Enumeration, Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference.js";
import { AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing.js";
import { SchemaMerger } from "../../Merging/SchemaMerger.js";
import { BisTestHelper } from "../TestUtils/BisTestHelper.js";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Enumeration merge tests", () => {
  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.0.0",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  it("should merge missing enumeration", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Enumeration,
          itemName: "TestEnumeration",
          difference: {
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
              {
                name: "SecondValue",
                value: 1,
                label: "second value",
              },
            ],
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEnumeration")).to.be.eventually.not.undefined
      .then((mergedEnumeration: Enumeration) => {
        expect(mergedEnumeration).to.have.a.property("schemaItemType", SchemaItemType.Enumeration);
        expect(mergedEnumeration).to.have.a.property("isInt", true);
        expect(mergedEnumeration).to.have.a.property("isStrict", false);
        expect(mergedEnumeration).to.have.a.property("enumerators").that.has.lengthOf(2);
        expect(mergedEnumeration.enumerators[0]).to.deep.equals({
          description: undefined,
          label: "first value",
          name: "FirstValue",
          value: 0,
        });
        expect(mergedEnumeration.enumerators[1]).to.deep.equals({
          description: undefined,
          label: "second value",
          name: "SecondValue",
          value: 1,
        });
      });
  });

  it("should merge missing enumerators of the same enumeration", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: true,
          enumerators: [{
            name: "AnotherValue",
            label: "totally different value",
            value: "T",
          }],
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "$enumerators",
          difference: {
            name: "FirstValue",
            value: "F",
            label: "first value",
            description: undefined,
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEnumeration")).to.be.eventually.not.undefined
      .then((mergedEnumeration: Enumeration) => {
        expect(mergedEnumeration).to.have.a.property("schemaItemType", SchemaItemType.Enumeration);
        expect(mergedEnumeration).to.have.a.property("isString", true);
        expect(mergedEnumeration).to.have.a.property("isStrict", true);
        expect(mergedEnumeration).to.have.a.property("enumerators").that.has.lengthOf(2);
        expect(mergedEnumeration.enumerators[0]).to.deep.equals({
          description: undefined,
          label: "totally different value",
          name: "AnotherValue",
          value: "T",
        });
        expect(mergedEnumeration.enumerators[1]).to.deep.equals({
          description: undefined,
          label: "first value",
          name: "FirstValue",
          value: "F",
        });
      });
  });

  it("should merge a super-set enumeration", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          isStrict: false,
          enumerators: [{
            name: "FirstValue",
            label: "first value",
            value: 0,
          },
          {
            name: "SecondValue",
            label: "second value",
            value: 1,
          }],
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "$enumerators",
          difference: {
            name: "ThirdValue",
            value: 2,
            label: "Third value",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEnumeration")).to.be.eventually.not.undefined
      .then((mergedEnumeration: Enumeration) => {
        expect(mergedEnumeration).to.have.a.property("schemaItemType", SchemaItemType.Enumeration);
        expect(mergedEnumeration).to.have.a.property("isInt", true);
        expect(mergedEnumeration).to.have.a.property("isStrict", false);
        expect(mergedEnumeration).to.have.a.property("enumerators").that.has.lengthOf(3);
        expect(mergedEnumeration.enumerators[0]).to.deep.equals({
          description: undefined,
          label: "first value",
          name: "FirstValue",
          value: 0,
        });
        expect(mergedEnumeration.enumerators[1]).to.deep.equals({
          description: undefined,
          label: "second value",
          name: "SecondValue",
          value: 1,
        });
        expect(mergedEnumeration.enumerators[2]).to.deep.equals({
          description: undefined,
          label: "Third value",
          name: "ThirdValue",
          value: 2,
        });
      });
  });

  it("should merge missing enumerator attributes", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          isStrict: true,
          enumerators: [
            {
              name: "EnumeratorOne",
              value: 100,
            },
          ],
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "EnumeratorOne",
          difference: {
            description: "This is for enumerator one",
            label: "Enumerator One",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("TestEnumeration")).to.be.eventually.not.undefined
      .then((mergedEnumeration: Enumeration) => {
        expect(mergedEnumeration).to.have.a.property("schemaItemType", SchemaItemType.Enumeration);
        expect(mergedEnumeration).to.have.a.property("isInt", true);
        expect(mergedEnumeration).to.have.a.property("isStrict", true);
        expect(mergedEnumeration).to.have.a.property("enumerators").that.has.lengthOf(1);
        expect(mergedEnumeration.enumerators[0]).to.deep.equals({
          description: "This is for enumerator one",
          label: "Enumerator One",
          name: "EnumeratorOne",
          value: 100,
        });
      });
  });

  it("should throw an error if source enumeration and target enumeration type mismatch", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          isStrict: true,
          enumerators: [{
            name: "valueOne",
            label: "string value one",
            value: "one",
          }],
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Enumeration,
          itemName: "TestEnumeration",
          difference: {
            type: "int",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, "The Enumeration TestEnumeration has an incompatible type. It must be \"string\", not \"int\".");
  });

  it("should throw an error if enumerator value attribute conflict exist", async () => {
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      items: {
        TestEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          isStrict: true,
          enumerators: [
            {
              name: "EnumeratorOne",
              label: "Enumerator One",
              value: 200,
            },
          ],
        },
      },
    }, await BisTestHelper.getNewContext());

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.Enumerator,
          itemName: "TestEnumeration",
          path: "EnumeratorOne",
          difference: {
            value: 100,
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Failed to merge enumerator attribute, Enumerator \"EnumeratorOne\" has different values.");
  });

  describe("iterative tests", () => {
    it("should add a re-mapped enumeration class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Enumeration");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedEnumeration")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Enumeration);
      });
    });

    it("should merge changes to re-mapped enumeration class", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            label: "Changed Strength",
            description: "Changed Strength Enumeration",
            type: "int",
            isStrict: true,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "changed first value",
              },
              {
                name: "SecondValue",
                value: 1,
                label: "second value",
              },
            ],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedEnumeration: {
            schemaItemType: "Enumeration",
            label: "Strength",
            description: "Strength Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedEnumeration")).to.be.eventually.not.undefined
        .then((enumeration: Enumeration) => {
          expect(enumeration).to.have.a.property("label").to.equal("Changed Strength");
          expect(enumeration).to.have.a.property("description").to.equal("Changed Strength Enumeration");
          expect(enumeration).to.have.a.property("isStrict").to.equal(true);

          expect(enumeration).to.have.a.property("enumerators").that.has.lengthOf(2);
          expect(enumeration).to.have.a.nested.property("enumerators[0].label").to.equal("changed first value");
          expect(enumeration.enumerators[1]).to.deep.equals({
            description: undefined,
            name: "SecondValue",
            value: 1,
            label: "second value",
          });
        });
    });

    it("should add re-mapped enumeration property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "boolProp",
              type: "PrimitiveProperty",
              typeName: "SourceSchema.testItem",
            }],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.not.undefined
        .then(async (ecClass: EntityClass) => {
          await expect(ecClass.getProperty("boolProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.nested.property("enumeration.name").equals("mergedEnumeration");
          });
        });
    });

    it("should add missing class with re-mapped enumeration property", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "boolProp",
              type: "PrimitiveProperty",
              typeName: "SourceSchema.testItem",
            }],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      const merger = new SchemaMerger(targetSchema.context);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.not.undefined
        .then(async (ecClass: EntityClass) => {
          await expect(ecClass.getProperty("boolProp")).to.be.eventually.fulfilled.then((property) => {
            expect(property).to.exist;
            expect(property).has.a.nested.property("enumeration.name").equals("mergedEnumeration");
          });
        });
    });

    it("should return a conflict for re-mapped enumeration with different primitive types", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: "0",
                label: "first value",
              },
            ],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 0,
                label: "first value",
              },
            ],
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      let result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Enumeration");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingEnumerationType);
        expect(conflict).to.have.a.property("source", "string");
        expect(conflict).to.have.a.property("target", "int");
        expect(conflict).to.have.a.property("description", "Enumeration has a different primitive type.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "Enumeration");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });

    it("should return a conflict for conflicting enumerator value", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 100,
                label: "first value",
              },
            ],
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              {
                name: "FirstValue",
                value: 1,
                label: "first value",
              },
            ],
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, await BisTestHelper.getNewContext());

      let result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Enumeration");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        expect(conflict).to.have.a.property("description", "Target schema already contains a schema item with the name but different type.");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Enumeration;
      schemaEdits.items.rename(sourceItem, "mergedEnumeration");

      result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingEnumeratorValue);
        expect(conflict).to.have.a.property("source", 100);
        expect(conflict).to.have.a.property("target", 1);
        expect(conflict).to.have.a.property("description", "Enumerators must have unique values.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "Enumerator");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        expect(conflict).to.have.a.nested.property("difference.path", "FirstValue");
        return true;
      });
    });
  });
});
