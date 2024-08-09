/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, EntityClass, Enumeration, EnumerationArrayProperty, EnumerationProperty, KindOfQuantity, Mixin, NavigationProperty, PropertyCategory, RelationshipClass, Schema, SchemaContext, StructArrayProperty, StructClass, StructProperty } from "@itwin/ecschema-metadata";
import { ConflictCode, getSchemaDifferences, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";
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
  };

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.0",
    alias: "source",
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
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
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

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count");

      const [conflict] = differences.conflicts!;
      expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code");

      const schemaEdits = new SchemaEdits();
      schemaEdits.items.rename(conflict.itemName!, "MergedCategory");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedCategory = await mergedSchema.getItem<PropertyCategory>("MergedCategory");
      expect(mergedCategory).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(await (await mergedEntity?.getProperty("DoubleProperty"))?.category).to.eq(mergedCategory);

      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect(await (await mergedCA?.getProperty("IntProperty"))?.category).to.eq(mergedCategory);
      expect(await (await mergedCA?.getProperty("StringProperty"))?.category).to.eq(mergedCategory);
    });

    it("should rename kind of quantity name", async () => {
      await Schema.fromJson(referenceJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
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

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count.");

      const [conflict] = differences.conflicts!;
      expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code");

      const schemaEdits = new SchemaEdits();
      schemaEdits.items.rename(conflict.itemName!, "MergedKoq");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedKoq = await mergedSchema.getItem<KindOfQuantity>("MergedKoq");
      expect(mergedKoq).to.be.not.undefined;

      const mergedStruct = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(await (await mergedStruct?.getProperty("StringProperty"))?.kindOfQuantity).to.eq(mergedKoq);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(await (await mergedEntity?.getProperty("IntProperty"))?.kindOfQuantity).to.eq(mergedKoq);
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

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(1, "Unexpected conflict count");

      const [conflict] = differences.conflicts!;
      expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code");

      const schemaEdits = new SchemaEdits();
      schemaEdits.items.rename(conflict.itemName!, "MergedEnum");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEnumeration = await mergedSchema.getItem<Enumeration>("MergedEnum");
      expect(mergedEnumeration).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(await (await mergedEntity?.getProperty("StringArrayProperty") as EnumerationArrayProperty)?.enumeration).to.eq(mergedEnumeration);

      const mergedStruct = await mergedSchema.getItem<StructClass>("TestStruct");
      expect(await (await mergedStruct?.getProperty("StringProperty") as EnumerationProperty)?.enumeration).to.eq(mergedEnumeration);
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
      schemaEdits.items.rename(conflicts[0].itemName!, "MergedBaseStruct");
      schemaEdits.items.rename(conflicts[1].itemName!, "MergedStruct");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedBaseStruct = await mergedSchema.getItem<StructClass>("MergedBaseStruct");
      expect(mergedBaseStruct).to.be.not.undefined;
      const mergedStruct = await mergedSchema.getItem<StructClass>("MergedStruct");
      expect(mergedStruct).to.be.not.undefined;
      expect(await mergedStruct?.baseClass).to.eq(mergedBaseStruct);

      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
      expect((await mergedCA?.getProperty("IntProperty") as StructProperty).structClass).to.eq(mergedStruct);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect((await mergedEntity?.getProperty("StringProperty") as StructProperty).structClass).to.eq(mergedBaseStruct);
      expect((await mergedEntity?.getProperty("StringArrayProperty") as StructArrayProperty).structClass).to.eq(mergedStruct);
    });

    it("should rename custom attribute name", async () => {
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
            baseClass: "TargetSchema.TestBase",
          },
        },
      }, targetContext);

      const differences = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(differences.conflicts).has.lengthOf(2, "Unexpected conflict count");

      const conflicts = differences.conflicts!;
      conflicts.forEach((conflict) => expect(conflict.code).equals(ConflictCode.ConflictingItemName, "Unexpected conflict code"));

      const schemaEdits = new SchemaEdits();
      schemaEdits.items.rename(conflicts[0].itemName!, "MergedBaseCA");
      schemaEdits.items.rename(conflicts[1].itemName!, "MergedCA");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);
      expect(mergedSchema.customAttributes?.get("TargetSchema.MergedBaseCA")).to.be.not.undefined;
      expect(mergedSchema.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;

      const mergedBaseCA = await mergedSchema.getItem<CustomAttributeClass>("MergedBaseCA");
      expect(mergedBaseCA).to.be.not.undefined;
      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("MergedCA");
      expect(mergedCA).to.be.not.undefined;
      expect(await mergedCA?.baseClass).to.eq(mergedBaseCA);

      const mergedRelationship = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(mergedRelationship?.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;
      expect((await mergedRelationship?.getProperty("DoubleProperty"))?.customAttributes?.get("TargetSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedRelationship?.getProperty("DoubleProperty"))?.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;
      // expect(mergedRelationship?.source.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedEntity?.customAttributes?.get("TargetSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("StringProperty"))?.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("IntArrayProperty"))?.customAttributes?.get("TargetSchema.MergedBaseCA")).to.be.not.undefined;
      expect((await mergedEntity?.getProperty("IntArrayProperty"))?.customAttributes?.get("TargetSchema.MergedCA")).to.be.not.undefined;
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
      schemaEdits.items.rename(conflicts[0].itemName!, "MergedBaseMixin");
      schemaEdits.items.rename(conflicts[1].itemName!, "MergedMixin");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedBaseMixin = await mergedSchema.getItem<Mixin>("MergedBaseMixin");
      expect(mergedBaseMixin).to.be.not.undefined;
      const mergedMixin = await mergedSchema.getItem<Mixin>("MergedMixin");
      expect(mergedMixin).to.be.not.undefined;
      expect(await mergedMixin?.baseClass).to.eq(mergedBaseMixin);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(mergedEntity?.mixins.length).to.eq(2);
      expect(await mergedEntity?.mixins[0]).to.eq(mergedBaseMixin);
      expect(await mergedEntity?.mixins[1]).to.eq(mergedMixin);

      const mergedRelationship = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(await mergedRelationship?.source.abstractConstraint).to.eq(mergedBaseMixin);
      expect(await mergedRelationship?.target.constraintClasses?.[0]).to.eq(mergedMixin);
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
      schemaEdits.items.rename(conflicts[0].itemName!, "MergedBaseEntity");
      schemaEdits.items.rename(conflicts[1].itemName!, "MergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedBaseEntity = await mergedSchema.getItem<EntityClass>("MergedBaseEntity");
      expect(mergedBaseEntity).to.be.not.undefined;
      const mergedEntity = await mergedSchema.getItem<EntityClass>("MergedEntity");
      expect(mergedEntity).to.be.not.undefined;
      expect(await mergedEntity?.baseClass).to.eq(mergedBaseEntity);

      const mergedMixin = await mergedSchema.getItem<Mixin>("TestMixin");
      expect(await mergedMixin?.appliesTo).to.eq(mergedBaseEntity);

      const mergedRelationship = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(await mergedRelationship?.target.abstractConstraint).to.eq(mergedBaseEntity);
      expect(await mergedRelationship?.source.constraintClasses?.[0]).to.eq(mergedEntity);
    });

    it.skip("should rename relationship name", async () => {
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
      schemaEdits.items.rename(conflicts[0].itemName!, "MergedBaseRelationship");
      schemaEdits.items.rename(conflicts[1].itemName!, "MergedRelationship");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedBaseRelationship = await mergedSchema.getItem<RelationshipClass>("MergedBaseRelationship");
      expect(mergedBaseRelationship).to.be.not.undefined;
      const mergedRelationship = await mergedSchema.getItem<RelationshipClass>("MergedRelationship");
      expect(mergedRelationship).to.be.not.undefined;
      expect(await mergedRelationship?.baseClass).to.eq(mergedBaseRelationship);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(await (await mergedEntity?.getProperty("NavigationProperty") as NavigationProperty).relationshipClass).to.eq(mergedBaseRelationship);

      const testRelationship = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(await testRelationship?.target.abstractConstraint).to.eq(mergedBaseRelationship);
      expect(await testRelationship?.target.constraintClasses?.[0]).to.eq(mergedRelationship);
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
      schemaEdits.items.rename("TestItem", "MergedCategory");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedCategory = await mergedSchema.getItem<PropertyCategory>("MergedCategory");
      expect(mergedCategory).to.be.not.undefined;

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
      expect(await (await mergedEntity?.getProperty("DoubleProperty"))?.category).to.eq(mergedCategory);

      const mergedCA = await mergedSchema.getItem<CustomAttributeClass>("TestCA");
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
      schemaEdits.properties.rename(conflict.itemName!, conflict.path!, "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
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
      schemaEdits.properties.rename(conflict.itemName!, conflict.path!, "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
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
      schemaEdits.properties.rename("TestEntity", "StringProperty", "MergedProperty");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(differences, schemaEdits);

      const mergedEntity = await mergedSchema.getItem<EntityClass>("TestEntity");
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
