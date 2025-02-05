/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, PropertyCategory, PropertyType, RelationshipClass, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { expect } from "chai";
import "chai-as-promised";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Rename change tests", () => {
  let targetContext: SchemaContext;
  let sourceContext: SchemaContext;

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
    references: [
      {
        name: "CoreCustomAttributes",
        version: "01.00.01",
      },
    ],
    customAttributes: [
      {
        className: "CoreCustomAttributes.DynamicSchema",
      },
    ],
  };

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.0",
    alias: "source",
    references: [
      {
        name: "CoreCustomAttributes",
        version: "01.00.01",
      },
    ],
    customAttributes: [
      {
        className: "CoreCustomAttributes.DynamicSchema",
      },
    ],
  };

  const referenceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ReferenceSchema",
    version: "1.2.0",
    alias: "reference",
    items: {
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "TestPhenomenon",
      },
      TestPhenomenonRate: {
        schemaItemType: "Phenomenon",
        definition: "TestPhenomenon * TestPhenomenon(-1)",
      },
      TU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenon",
        definition: "TU",
      },
      KILOTU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenon",
        definition: "1000*TU",
      },
      TU_PER_TU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenonRate",
        definition: "TU * TU(-1)",
      },
      TU_HORIZONTAL_PER_TU_VERTICAL: {
        schemaItemType: "InvertedUnit",
        invertsUnit: "ReferenceSchema.TU_PER_TU",
        unitSystem: "ReferenceSchema.TestUnitSystem",
      },
    },
  };

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
    sourceContext = await BisTestHelper.getNewContext();
  });

  describe("Rename schema item name tests", () => {
    it("should rename property category name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "DoubleProperty",
                type: "PrimitiveProperty",
                typeName: "double",
                category: "SourceSchema.TestItem",
              },
            ],
          },
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [
              {
                name: "IntProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
                category: "SourceSchema.TestItem",
              },
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
                category: "SourceSchema.TestItem",
              },
            ],
          },
          TestItem: {
            schemaItemType: "PropertyCategory",
            priority: 1000,
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          TestItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "PropertyCategory");
        expect(conflict).to.have.a.property("target", "EntityClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("TestItem") as PropertyCategory;
      schemaEdits.items.rename(testItem, "MergedCategory");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("MergedCategory")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.PropertyCategory);
      });
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("DoubleProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("category.name").equals("MergedCategory");
        });
      });
      await expect(mergedSchema.getItem("TestCA")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("IntProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("category.name").equals("MergedCategory");
        });
        await expect(ecClass.getProperty("StringProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("category.name").equals("MergedCategory");
        });
      });
    });

    it("should rename kind of quantity name", async () => {
      await Schema.fromJson(referenceJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
                kindOfQuantity: "SourceSchema.TestItem",
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "IntProperty",
                type: "PrimitiveProperty",
                typeName: "int",
                kindOfQuantity: "SourceSchema.TestItem",
              },
            ],
          },
          TestItem: {
            schemaItemType: "KindOfQuantity",
            label: "Some label",
            description: "Some description",
            relativeError: 0.00000122,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      await Schema.fromJson(referenceJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
          TestItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "KindOfQuantity");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedKoq");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("MergedKoq")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.KindOfQuantity);
      });
      await expect(mergedSchema.getItem("TestStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("StringProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("kindOfQuantity.name").equals("MergedKoq");
        });
      });
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("IntProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("kindOfQuantity.name").equals("MergedKoq");
        });
      });
    });

    it("should rename enumeration name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestStruct: {
            schemaItemType: "StructClass",
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "SourceSchema.TestItem",
              },
            ],
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "StringArrayProperty",
                type: "PrimitiveArrayProperty",
                typeName: "SourceSchema.TestItem",
                minOccurs: 1,
                maxOccurs: 5,
              },
            ],
          },
          TestItem: {
            schemaItemType: "Enumeration",
            type: "string",
            isStrict: true,
            enumerators: [
              {
                name: "EnumeratorOne",
                label: "Enumerator One",
                value: "1",
              },
              {
                name: "EnumeratorTwo",
                value: "2",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
          },
          TestItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Enumeration");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedEnum");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("MergedEnum")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Enumeration);
      });
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("StringArrayProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("enumeration.name").equals("MergedEnum");
        });
      });
      await expect(mergedSchema.getItem("TestStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("StringProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("enumeration.name").equals("MergedEnum");
        });
      });
    });

    it("should rename struct name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "StringProperty",
                type: "StructProperty",
                typeName: "SourceSchema.TestBase",
              },
              {
                name: "StringArrayProperty",
                type: "StructArrayProperty",
                typeName: "SourceSchema.TestItem",
              },
            ],
          },
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [
              {
                name: "IntProperty",
                type: "StructProperty",
                typeName: "SourceSchema.TestItem",
              },
            ],
          },
          TestBase: {
            schemaItemType: "StructClass",
            description: "Base Class",
          },
          TestItem: {
            schemaItemType: "StructClass",
            description: "Struct Class",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestBase: {
            schemaItemType: "EntityClass",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.TestBase",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      const testBase = await sourceSchema.getItem("TestBase");
      schemaEdits.items.rename(testBase!, "MergedBaseStruct");
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedStruct");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      await expect(mergedSchema.getItem("MergedBaseStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.StructClass);
      });
      await expect(mergedSchema.getItem("MergedStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.StructClass);
        expect(ecClass).has.a.nested.property("baseClass.name").equals("MergedBaseStruct");
      });

      await expect(mergedSchema.getItem("TestCA")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("IntProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("structClass.name").equals("MergedStruct");
        });
      });
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("StringProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("structClass.name").equals("MergedBaseStruct");
        });
        await expect(ecClass.getProperty("StringArrayProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("structClass.name").equals("MergedStruct");
        });
      });
    });

    it.skip("should rename custom attribute name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        customAttributes: [
          {
            className: "SourceSchema.TestBase",
            Id: 1975862,
          },
          {
            className: "SourceSchema.TestItem",
            Properties: [
              "ECSChema",
            ],
          },
        ],
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            customAttributes: [
              {
                className: "SourceSchema.TestItem",
                Properties: [
                  "ECClass",
                ],
              },
            ],
            properties: [
              {
                name: "DoubleProperty",
                type: "PrimitiveProperty",
                typeName: "double",
                customAttributes: [
                  {
                    className: "SourceSchema.TestBase",
                  },
                  {
                    className: "SourceSchema.TestItem",
                  },
                ],
              },
            ],
            source: {
              customAttributes: [
                {
                  className: "SourceSchema.TestItem",
                  Properties: [
                    "ECSourceConstraint",
                  ],
                },
              ],
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.TestEntity",
              constraintClasses: [
                "SourceSchema.TestEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.TestEntity",
              constraintClasses: [
                "SourceSchema.TestEntity",
              ],
            },
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "SourceSchema.TestBase",
              },
            ],
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
                customAttributes: [
                  {
                    className: "SourceSchema.TestItem",
                    Properties: [
                      "ECProperty",
                    ],
                  },
                ],
              },
              {
                name: "IntArrayProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
                customAttributes: [
                  {
                    className: "SourceSchema.TestItem",
                  },
                  {
                    className: "SourceSchema.TestBase",
                    Id: -1140362,
                  },
                ],
              },
            ],
          },
          TestBase: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            description: "Base Class",
            properties: [
              {
                name: "Id",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          },
          TestItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            baseClass: "SourceSchema.TestBase",
            properties: [
              {
                name: "Properties",
                type: "PrimitiveArrayProperty",
                typeName: "string",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          TestBase: {
            schemaItemType: "StructClass",
          },
          TestItem: {
            schemaItemType: "StructClass",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      const testBase = await sourceSchema.getItem("TestBase");
      schemaEdits.items.rename(testBase!, "MergedBaseCA");
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedCA");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);
      expect(mergedSchema.customAttributes?.get("SourceSchema.MergedBaseCA")).to.be.not.undefined;
      expect(mergedSchema.customAttributes?.get("SourceSchema.MergedCA")).to.be.not.undefined;

      const mergedBaseCA = await mergedSchema.getItem("MergedBaseCA", CustomAttributeClass);
      expect(mergedBaseCA).to.be.not.undefined;
      const mergedCA = await mergedSchema.getItem("MergedCA", CustomAttributeClass);
      expect(mergedCA).to.be.not.undefined;
      expect(await mergedCA?.baseClass).to.eq(mergedBaseCA);

      const mergedRelationship = await mergedSchema.getItem("TestRelationship", RelationshipClass);
      expect(mergedRelationship?.customAttributes?.get("SourceSchema.MergedCA")).to.be.not.undefined;
      expect((await mergedRelationship?.getProperty("DoubleProperty"))?.customAttributes?.get("SourceSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedRelationship?.getProperty("DoubleProperty"))?.customAttributes?.get("SourceSchema.MergedCA")).to.be.not.undefined;
      // expect(mergedRelationship?.source.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem("TestEntity", EntityClass);
      expect(mergedEntity?.customAttributes?.get("SourceSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("StringProperty"))?.customAttributes?.get("SourceSchema.MergedCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("IntArrayProperty"))?.customAttributes?.get("SourceSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("IntArrayProperty"))?.customAttributes?.get("SourceSchema.MergedCA")).to.be.not.undefined;
    });

    it("should rename mixin name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestItem",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestItem",
              ],
            },
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.TestBaseEntity",
            mixins: [
              "SourceSchema.TestBase",
              "SourceSchema.TestItem",
            ],
          },
          TestBaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestBase: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.TestBaseEntity",
            description: "Base Class",
          },
          TestItem: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.TestBaseEntity",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TargetSchema.TestBaseEntity",
          },
          TestBaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestBase: {
            schemaItemType: "StructClass",
          },
          TestItem: {
            schemaItemType: "StructClass",
            baseClass: "TargetSchema.TestBase",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      const testBase = await sourceSchema.getItem("TestBase");
      schemaEdits.items.rename(testBase!, "MergedBaseMixin");
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedMixin");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      await expect(mergedSchema.getItem("MergedBaseMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Mixin);
      });
      await expect(mergedSchema.getItem("MergedMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.Mixin);
        expect(ecClass).has.a.nested.property("baseClass.name").equals("MergedBaseMixin");
      });
      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("mixins[0].name").equals("MergedBaseMixin");
        expect(ecClass).has.a.nested.property("mixins[1].name").equals("MergedMixin");
      });
      await expect(mergedSchema.getItem("TestRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("source.abstractConstraint.name").equals("MergedBaseMixin");
        expect(ecClass).has.a.nested.property("target.constraintClasses[0].name").equals("MergedMixin");
      });
    });

    it("should rename entity name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          ConstraintEntity: {
            schemaItemType: "EntityClass",
          },
          ConstraintRelationShip: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
                "SourceSchema.TestBase",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
                "SourceSchema.TestItem",
              ],
            },
          },
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestItem",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestItem",
              ],
            },
          },
          TestMixin: {
            schemaItemType: "Mixin",
            appliesTo: "SourceSchema.TestBase",
          },
          TestBase: {
            schemaItemType: "EntityClass",
            description: "Base Class",
            baseClass: "SourceSchema.ConstraintEntity",
          },
          TestItem: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.TestBase",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          ConstraintEntity: {
            schemaItemType: "EntityClass",
          },
          ConstraintRelationShip: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "TargetSchema.ConstraintEntity",
              constraintClasses: [
                "TargetSchema.ConstraintEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "TargetSchema.ConstraintEntity",
              constraintClasses: [
                "TargetSchema.ConstraintEntity",
              ],
            },
          },
          TestBase: {
            schemaItemType: "StructClass",
          },
          TestItem: {
            schemaItemType: "StructClass",
            baseClass: "TargetSchema.TestBase",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      const testBase = await sourceSchema.getItem("TestBase");
      schemaEdits.items.rename(testBase!, "MergedBaseEntity");
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      await expect(mergedSchema.getItem("MergedBaseEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.EntityClass);
      });
      await expect(mergedSchema.getItem("MergedEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("baseClass.name").equals("MergedBaseEntity");
      });
      await expect(mergedSchema.getItem("TestMixin")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("appliesTo.name").equals("MergedBaseEntity");
      });
      await expect(mergedSchema.getItem("TestRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("target.abstractConstraint.name").equals("MergedBaseEntity");
        expect(ecClass).has.a.nested.property("source.constraintClasses[0].name").equals("MergedEntity");
      });
    });

    it("should rename relationship name", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          ConstraintEntity: {
            schemaItemType: "EntityClass",
          },
          TestBase: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestBase",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
          },
          TestItem: {
            schemaItemType: "RelationshipClass",
            baseClass: "SourceSchema.TestBase",
            description: "Description of TestItem",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.ConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
          },
          TestRelationShip: {
            schemaItemType: "RelationshipClass",
            description: "Description of TestRelationship",
            modifier: "Abstract",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestBase",
                "SourceSchema.TestItem",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: false,
              abstractConstraint: "SourceSchema.TestBase",
              constraintClasses: [
                "SourceSchema.TestItem",
              ],
            },
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "NavigationProperty",
                type: "NavigationProperty",
                typeName: "string",
                direction: "Backward",
                relationshipName: "SourceSchema.TestBase",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          ConstraintEntity: {
            schemaItemType: "EntityClass",
          },
          TestBase: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
          TestItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      const testBase = await sourceSchema.getItem("TestBase");
      schemaEdits.items.rename(testBase!, "MergedBaseRelationship");
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedRelationship");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      await expect(mergedSchema.getItem("MergedBaseRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.RelationshipClass);
      });
      await expect(mergedSchema.getItem("MergedRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.RelationshipClass);
        expect(ecClass).has.a.nested.property("baseClass.name").equals("MergedBaseRelationship");
      });

      await expect(mergedSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        await expect(ecClass.getProperty("NavigationProperty")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.property("propertyType").equals(PropertyType.Navigation);
          expect(property).has.a.nested.property("relationshipClass.name").equals("MergedBaseRelationship");
        });
      });
      await expect(mergedSchema.getItem("TestRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.a.nested.property("target.abstractConstraint.name").equals("MergedBaseRelationship");
        expect(ecClass).has.a.nested.property("target.constraintClasses[0].name").equals("MergedRelationship");
      });
    });

    it("should rename property category name by fix", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "DoubleProperty",
                type: "PrimitiveProperty",
                typeName: "double",
                category: "SourceSchema.TestItem",
              },
            ],
          },
          TestCA: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Any",
            properties: [
              {
                name: "IntProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
                category: "SourceSchema.TestItem",
              },
              {
                name: "StringProperty",
                type: "PrimitiveProperty",
                typeName: "string",
                category: "SourceSchema.TestItem",
              },
            ],
          },
          TestItem: {
            schemaItemType: "PropertyCategory",
            priority: 1000,
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).to.be.undefined;

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("TestItem");
      schemaEdits.items.rename(testItem!, "MergedCategory");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedCategory = await mergedSchema.getItem("MergedCategory", PropertyCategory);
      expect(mergedCategory).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem("TestEntity", EntityClass);
      expect(await (await mergedEntity?.getProperty("DoubleProperty"))?.category).to.eq(mergedCategory);

      const mergedCA = await mergedSchema.getItem("TestCA", CustomAttributeClass);
      expect(await (await mergedCA?.getProperty("IntProperty"))?.category).to.eq(mergedCategory);
      expect(await (await mergedCA?.getProperty("StringProperty"))?.category).to.eq(mergedCategory);
    });
  });

  describe("Rename property name tests", () => {
    it("should rename property name when typename changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count");

      const [conflict] = differences.conflicts!;
      expect(conflict.code).equals(ConflictCode.ConflictingPropertyName, "Unexpected conflict code");

      const schemaEdits = new SchemaEdits();
      const testEntity = await sourceSchema.getItem("TestEntity") as EntityClass;
      schemaEdits.properties.rename(testEntity, "TestProp", "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem("TestEntity", EntityClass);
      const mergedProperty = await mergedEntity?.getProperty("MergedProperty");
      expect(mergedProperty?.toJSON()).to.deep.eq({
        name: "MergedProperty",
        type: "PrimitiveProperty",
        typeName: "string",
      });
    });

    it("should rename property name when type changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProp",
                description: "Double Array Property",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveArrayProperty",
                typeName: "double",
              },
            ],
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count");

      const [conflict] = differences.conflicts!;
      expect(conflict.code).equals(ConflictCode.ConflictingPropertyName, "Unexpected conflict code");

      const schemaEdits = new SchemaEdits();
      const testEntity = await sourceSchema.getItem("TestEntity") as EntityClass;
      schemaEdits.properties.rename(testEntity, "TestProp", "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem("TestEntity", EntityClass);
      const mergedProperty = await mergedEntity?.getProperty("MergedProperty");
      expect(mergedProperty?.toJSON()).to.deep.eq({
        name: "MergedProperty",
        description: "Double Array Property",
        type: "PrimitiveProperty",
        typeName: "double",
      });
    });

    it("should rename property name by fix", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "StringProperty",
                description: "Primitive String Property",
                type: "PrimitiveArrayProperty",
                typeName: "string",
              },
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "DoubleProperty",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).to.be.undefined;

      const schemaEdits = new SchemaEdits();
      const testEntity = await sourceSchema.getItem("TestEntity") as EntityClass;
      schemaEdits.properties.rename(testEntity, "StringProperty", "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem("TestEntity", EntityClass);
      const mergedProperty = await mergedEntity?.getProperty("MergedProperty");
      expect(mergedProperty?.toJSON()).to.deep.eq({
        name: "MergedProperty",
        description: "Primitive String Property",
        type: "PrimitiveArrayProperty",
        typeName: "string",
        maxOccurs: 2147483647,
        minOccurs: 0,
      });
    });
  });
});
