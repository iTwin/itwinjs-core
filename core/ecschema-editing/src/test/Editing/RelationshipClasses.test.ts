/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type {
  RelationshipClass, RelationshipClassProps, RelationshipConstraintProps, SchemaKey} from "@itwin/ecschema-metadata";
import { Schema, SchemaContext, SchemaItemKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Relationship tests from an existing schema", () => {
  /* eslint-disable @typescript-eslint/naming-convention */
  const schemaJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TestSchema",
    version: "1.2.3",
    items: {
      SourceBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TargetBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TestSourceEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.SourceBaseEntity",
      },
      TestTargetEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.TargetBaseEntity",
      },
    },
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testSchema = await Schema.fromJson(schemaJson, context);
    testEditor = new SchemaContextEditor(context);
    testKey = testSchema.schemaKey;
  });

  it("should create a relationship class given a valid RelationshipClassProps", async () => {
    const sourceJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Source RoleLabel",
      abstractConstraint: "TestSchema.SourceBaseEntity",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
    };
    const targetJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Target RoleLabel",
      abstractConstraint: "TestSchema.TargetBaseEntity",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: sourceJson,
      target: targetJson,
    };

    const result = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as RelationshipClass;
    const baseSourceClassKey = testSchema.getSchemaItemKey("TestSchema.SourceBaseEntity");
    expect(await relClass.source.abstractConstraint).to.eql(await testEditor.schemaContext.getSchemaItem(baseSourceClassKey));
  });

  it("should delete a relationship class", async () => {
    const sourceJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Source RoleLabel",
      abstractConstraint: "TestSchema.SourceBaseEntity",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
    };
    const targetJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Target RoleLabel",
      abstractConstraint: "TestSchema.TargetBaseEntity",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: sourceJson,
      target: targetJson,
    };

    const result = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as RelationshipClass;
    const baseSourceClassKey = testSchema.getSchemaItemKey("TestSchema.SourceBaseEntity");
    expect(await relClass.source.abstractConstraint).to.eql(await testEditor.schemaContext.getSchemaItem(baseSourceClassKey));

    let relationship = await testSchema.getItem("TestRelationship");
    expect(relationship).to.eql(relClass);

    const key = relationship?.key as SchemaItemKey;
    const delRes = await testEditor.relationships.delete(key);
    expect(delRes.itemKey).to.eql(result.itemKey);

    relationship = await testSchema.getItem("TestRelationship");
    expect(relationship).to.be.undefined;
  });

  it("should not be able to delete a relationship class if it is not in schema", async () => {
    const className = "TestRelationship";
    const classKey = new SchemaItemKey(className, testKey);
    const relationship = await testSchema.getItem(className);
    expect(relationship).to.be.undefined;

    const delRes = await testEditor.relationships.delete(classKey);
    expect(delRes).to.eql({});
  });
});
