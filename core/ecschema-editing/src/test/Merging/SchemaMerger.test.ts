/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaConflictsError } from "../../Differencing/Errors";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { ConflictCode, SchemaDifferenceConflict } from "../../Differencing/SchemaConflicts";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import "chai-as-promised";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema merge tests", () => {
  it("should throw an error if the differences has conflicts.", async () => {
    const conflict: SchemaDifferenceConflict = {
      code: ConflictCode.ConflictingPropertyName,
      schemaType: SchemaItemType.EntityClass,
      itemName: "ConflictingPropertyEntity",
      path: "MyProperty",
      source: "boolean",
      target: "string",
      description: "Target class already contains a property with a different type.",
    };

    const merger = new SchemaMerger(new SchemaContext());
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      conflicts: [conflict],
      differences: [],
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

  it("should throw an error if the target schema cannot be located", async () => {
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
    const { schema } = await merger.merge({
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
    expect(schema).to.have.a.property("label", newLabel, "unexpected source label");
    expect(schema).to.have.a.property("description", newDescription, "unexpected source description");
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
    const { schema } = await merger.merge({
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

    expect(schema).to.have.a.property("customAttributes").is.not.undefined;
    expect(schema).to.have.a.property("customAttributes").satisfies((customAttributes: any) => {
      return customAttributes.has("TargetSchema.TestCustomAttribute");
    });
  });
});
