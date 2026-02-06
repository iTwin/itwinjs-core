/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaConflictsError } from "../../Differencing/Errors";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { AnySchemaDifference, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { AnySchemaDifferenceConflict, ConflictCode } from "../../Differencing/SchemaConflicts";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import "chai-as-promised";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema merge tests", () => {
  it("should throw an error if the differences has conflicts.", async () => {
    const difference: AnySchemaDifference = {
      changeType: "modify",
      schemaType: SchemaOtherTypes.Property,
      itemName: "MyEntity",
      path: "MyProperty",
      difference: {
        schemaItemType: "boolean",
      } as any,
    };
    const conflict: AnySchemaDifferenceConflict = {
      code: ConflictCode.ConflictingPropertyName,
      difference,
      source: "boolean",
      target: "string",
      description: "Target class already contains a property with a different type.",
    };

    const merger = new SchemaMerger(new SchemaContext());
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      conflicts: [conflict],
      differences: [difference],
    });

    await expect(merge).to.be.rejectedWith(SchemaConflictsError, "Schema's can't be merged if there are unresolved conflicts.")
      .then((error: SchemaConflictsError) => {
        expect(error).to.have.a.nested.property("sourceSchema.name", "SourceSchema", "Unexpected source schema name");
        expect(error).to.have.a.nested.property("targetSchema.name", "TargetSchema", "Unexpected target schema name");
        expect(error.conflicts).includes(conflict);
      });
  });

  it("should throw an error if the target schema cannot be located", async () => {
    const merger = new SchemaMerger(new SchemaContext());
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      conflicts: [],
      differences: [],
    });

    await expect(merge).to.be.rejectedWith("The target schema 'TargetSchema' could not be found in the editing context.");
  });

  it("should throw an error if the target schema is not dynamic", async () => {
    const targetSchema = await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
    }, new SchemaContext());
    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      conflicts: [],
      differences: [],
    });

    await expect(merge).to.be.rejectedWith("The target schema 'TargetSchema' is not dynamic. Only dynamic schemas are supported for merging.");
  });

  it("should merge label and description from schema", async () => {
    const targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson({
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
    }, targetContext);

    const newDescription = "This is the new description";
    const newLabel = "This is the new Label";

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "modify",
        schemaType: SchemaOtherTypes.Schema,
        difference: {
          description: newDescription,
          label: newLabel,
        },
      }],
    });
    expect(mergedSchema).to.have.a.property("label", newLabel, "unexpected source label");
    expect(mergedSchema).to.have.a.property("description", newDescription, "unexpected source description");
  });

  it("should merge Schema Items case insensitive", async () => {
    const targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson({
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
      items: {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [{
        changeType: "add",
        schemaType: SchemaOtherTypes.CustomAttributeInstance,
        appliedTo: "Schema",
        difference: {
          className: "sOuRcEscHeMA.TESTCustomaTTriBute",
        },
      }],
    });

    expect(mergedSchema).to.have.a.property("customAttributes").is.not.undefined;
    expect(mergedSchema).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
      return customAttributes.has("TargetSchema.TestCustomAttribute");
    });
  });

  describe("SchemaMerger Reporting Tests", () => {
    it("Merging fails mid-merge", async () => {
      const targetContext = await BisTestHelper.getNewContext();
      await Schema.fromJson({
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
        items: {
          TestEntity: {
            schemaItemType: "EntityClass",
            appliesTo: "Schema",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger(targetContext);

      // Sanity Check
      expect(merger.getMergeReport()).to.be.undefined;

      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            // Should succeed
            changeType: "modify",
            schemaType: SchemaOtherTypes.Schema,
            difference: {
              label: "Modified Target Schema",
            },
          },
          {
            // Should succeed
            changeType: "modify",
            schemaType: "EntityClass" as any,
            itemName: "TestEntity",
            difference: {
              label: "Test Entity Label Updated",
            },
          },
          {
            // Should fail
            changeType: "modify",
            schemaType: "EntityClass" as any,
            itemName: "TestEntity",
            difference: {
              baseClass: "TargetSchema.NonExistentBase", // This will cause failure
              label: "Test Entity Base class Added",
            },
          },
        ],
      });

      // The merge should fail, but the first difference (schema label) was already applied
      await expect(merge).to.be.rejected;

      // Verify that the schema label was actually changed before the error
      const targetSchema = await targetContext.getCachedSchema(new SchemaKey("TargetSchema", 1, 0, 0));
      expect(targetSchema).to.not.be.undefined;
      expect(targetSchema).to.have.a.property("label", "Modified Target Schema",
        "First operation should have succeeded before failure");

      const mergeReport = merger.getMergeReport();
      expect(mergeReport).to.not.be.undefined;

      // Failed merge
      expect(mergeReport?.success).to.be.false;

      expect(mergeReport?.sourceSchemaKey).to.deep.equal(new SchemaKey("SourceSchema", 1, 2, 3));
      expect(mergeReport?.targetSchemaKey).to.deep.equal(new SchemaKey("TargetSchema", 1, 0, 0));

      expect(mergeReport?.successfulOperations.length).to.equal(2);
      const op1 = mergeReport!.successfulOperations[0];
      expect(op1.change).to.deep.equal({
        changeType: "modify",
        schemaType: "Schema",
        difference: { label: "Modified Target Schema" }
      });

      const op2 = mergeReport!.successfulOperations[1];
      expect(op2.change).to.deep.equal({
        changeType: "modify",
        schemaType: "EntityClass",
        itemName: "TestEntity",
        difference: { label: "Test Entity Label Updated" }
      });

      expect(mergeReport?.failedOperations.length).to.equal(1);
      expect(mergeReport!.failedOperations[0].change).to.deep.equal({
        changeType: "modify",
        schemaType: "EntityClass",
        itemName: "TestEntity",
        difference: {
          baseClass: "TargetSchema.NonExistentBase",
          label: "Test Entity Base class Added"
        }
      });
      expect(mergeReport!.failedOperations[0].error).to.equal("Changing the class 'TestEntity' baseClass is not supported.");
      expect(mergeReport?.mergeStatistics.total).to.equal(3);
      expect(mergeReport?.mergeStatistics.succeeded).to.equal(2);
      expect(mergeReport?.mergeStatistics.failed).to.equal(1);
    });

    it("should handle empty differences list", async () => {
      const targetContext = await BisTestHelper.getNewContext();
      await Schema.fromJson({
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
      }, targetContext);

      const merger = new SchemaMerger(targetContext);
      await merger.merge({
        sourceSchemaName: "SourceSchema.01.00.00",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [],
      });

      const report = merger.getMergeReport();
      expect(report).to.not.be.undefined;
      expect(report!.success).to.be.true;
      expect(report!.successfulOperations).to.have.lengthOf(0);
      expect(report!.failedOperations).to.have.lengthOf(0);
      expect(report!.mergeStatistics.total).to.equal(0);
    });

    it("should track multiple successful operations", async () => {
      const targetContext = await BisTestHelper.getNewContext();
      await Schema.fromJson({
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
        items: {
          TestEntityUpdate: {
            schemaItemType: "EntityClass",
            label: "Before Update",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        }
      }, targetContext);

      const merger = new SchemaMerger(targetContext);
      await merger.merge({
        sourceSchemaName: "SourceSchema.01.00.00",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaItemType.EntityClass,
            itemName: "TestEntity1",
            difference: {
              label: "Test Entity 1",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.EntityClass,
            itemName: "TestEntityUpdate",
            difference: {
              properties: [
                {
                  name: "TestProp2",
                  type: "PrimitiveProperty",
                  typeName: "int",
                },
              ],
            },
          },
          {
            changeType: "modify",
            schemaType: SchemaItemType.EntityClass,
            itemName: "TestEntityUpdate",
            difference: {
              label: "After update",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.StructClass,
            itemName: "TestStruct",
            difference: {
              label: "Test Struct",
            },
          },
        ],
      });

      const report = merger.getMergeReport();
      expect(report).to.not.be.undefined;
      expect(report!.success).to.be.true;
      expect(report!.successfulOperations).to.have.lengthOf(4);
      expect(report!.failedOperations).to.have.lengthOf(0);
      expect(report!.mergeStatistics.total).to.equal(4);
      expect(report!.mergeStatistics.succeeded).to.equal(4);

      // Verify successful operation details
      expect(report!.successfulOperations[0].change).to.deep.equal({
        changeType: "add",
        schemaType: "EntityClass",
        itemName: "TestEntityUpdate",
        difference: {
          properties: [
            { name: "TestProp2", type: "PrimitiveProperty", typeName: "int" }
          ]
        },
      });
      expect(report!.successfulOperations[1].change).to.deep.equal({
        changeType: "add",
        schemaType: "StructClass",
        itemName: "TestStruct",
        difference: {
          label: "Test Struct",
        },
      });
      expect(report!.successfulOperations[2].change).to.deep.equal({
        changeType: "add",
        schemaType: "EntityClass",
        itemName: "TestEntity1",
        difference: {
          label: "Test Entity 1",
        },
      });
      expect(report!.successfulOperations[3].change).to.deep.equal({
        changeType: "modify",
        schemaType: "EntityClass",
        itemName: "TestEntityUpdate",
        difference: {
          label: "After update",
        },
      });
    });

    it("should include error details in failed operations", async () => {
      const targetContext = await BisTestHelper.getNewContext();
      await Schema.fromJson({
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
      }, targetContext);

      const merger = new SchemaMerger(targetContext);

      const merge = merger.merge({
        sourceSchemaName: "SourceSchema.01.00.00",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaItemType.EntityClass,
            itemName: "TestEntity1",
            difference: {
              label: "Test Entity 1",
            },
          },
          {
            changeType: "add",
            schemaType: SchemaItemType.EntityClass,
            itemName: "InvalidEntity",
            difference: {
              baseClass: "TargetSchema.NonExistentBase",
            },
          },
        ],
      });

      await expect(merge).to.be.rejected;

      const report = merger.getMergeReport();
      expect(report).to.not.be.undefined;
      expect(report!.success).to.be.false;
      expect(report!.successfulOperations).to.have.lengthOf(1);
      expect(report!.failedOperations).to.have.lengthOf(1);

      // Verify error details
      expect(report!.failedOperations[0].change).to.deep.equal({
        changeType: "add",
        schemaType: "EntityClass",
        itemName: "InvalidEntity",
        difference: {
          baseClass: "TargetSchema.NonExistentBase",
        },
      });
      expect(report!.failedOperations[0].error).to.equal("Cannot locate referenced schema item TargetSchema.NonExistentBase");
    });

    it("Merge report should reflect the correct order", async () => {
      const targetContext = await BisTestHelper.getNewContext();
      const targetSchema = await Schema.fromJson({
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
        items: {
          TestEntityForPropertyTest: {
            schemaItemType: "EntityClass",
            label: "Test Entity For Property Test",
            properties: [
              {
                name: "OldProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
        },
      }, targetContext);

      const sourceContext = await BisTestHelper.getNewContext();
      const sourceSchema = await Schema.fromJson({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "SourceSchema",
        version: "1.0.0",
        alias: "source",
        label: "Modified Schema Label",
        references: [
          { name: "CoreCustomAttributes", version: "01.00.01" },
        ],
        items: {
          TestUnitSystem: {
            schemaItemType: "UnitSystem",
            label: "Unit System",
          },
          TestPropertyCategory: {
            schemaItemType: "PropertyCategory",
            priority: 1,
          },
          TestEnumeration: {
            schemaItemType: "Enumeration",
            type: "int",
            isStrict: false,
            enumerators: [
              { name: "Value1", value: 1 },
              { name: "Value2", value: 2 },
            ],
          },
          TestPhenomenon: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          TestUnit: {
            schemaItemType: "Unit",
            phenomenon: "SourceSchema.TestPhenomenon",
            unitSystem: "SourceSchema.TestUnitSystem",
            definition: "M",
          },
          TestFormat: {
            schemaItemType: "Format",
            type: "Decimal",
          },
          TestKOQ: {
            schemaItemType: "KindOfQuantity",
            persistenceUnit: "SourceSchema.TestUnit",
            relativeError: 0.01,
          },
          TestConstant: {
            schemaItemType: "Constant",
            phenomenon: "SourceSchema.TestPhenomenon",
            definition: "PI",
          },
          TestCustomAttribute: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "Schema",
          },
          TestStruct: {
            schemaItemType: "StructClass",
            label: "Test Struct",
          },
          TestEntity: {
            schemaItemType: "EntityClass",
            label: "Test Entity",
            properties: [
              {
                name: "TestProp",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          TestEntityForPropertyTest: {
            schemaItemType: "EntityClass",
            label: "Test Entity For Property Test",
            properties: [
              {
                name: "OldProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
              {
                name: "NewProperty",
                type: "PrimitiveProperty",
                typeName: "string",
              },
            ],
          },
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "Source",
              constraintClasses: ["SourceSchema.TestEntity"],
            },
            target: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "Target",
              constraintClasses: ["SourceSchema.TestEntity"],
            },
          },
        },
      }, sourceContext);

      const merger = new SchemaMerger(targetContext);
      await merger.mergeSchemas(targetSchema, sourceSchema);

      const report = merger.getMergeReport();
      expect(report).to.not.be.undefined;
      expect(report!.success).to.be.true;

      const actualOrder = report!.successfulOperations.map(op => op.change.schemaType);

      const expectedOrder = [
        // New additions
        SchemaItemType.UnitSystem,
        SchemaItemType.PropertyCategory,
        SchemaItemType.Enumeration,
        SchemaItemType.Phenomenon,
        SchemaItemType.Unit,
        SchemaItemType.Format,
        SchemaItemType.KindOfQuantity,
        SchemaItemType.Constant,
        SchemaItemType.CustomAttributeClass,
        SchemaItemType.StructClass,
        SchemaItemType.EntityClass,
        SchemaItemType.RelationshipClass,
        SchemaOtherTypes.Property,
        // modify difference: Schema label comes after the new additions
        SchemaOtherTypes.Schema,
      ];

      expect(actualOrder).to.deep.equal(expectedOrder);

      // Verify performance metrics are present
      expect(report?.performanceMetrics).to.not.be.undefined;
      expect(report!.performanceMetrics.totalDurationMs).to.be.greaterThan(0);
      expect(report!.performanceMetrics.schemaDifferenceDurationMs).to.be.greaterThan(0);
      expect(report!.performanceMetrics.mergeDurationMs).to.be.greaterThan(0);
      expect(report!.performanceMetrics.averageMergeOpDurationMs).to.be.greaterThan(0);
    });
  });
});
