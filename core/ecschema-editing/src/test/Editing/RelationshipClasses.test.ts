/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier,
  ECObjectsError,
  ECVersion,
  RelationshipClass, RelationshipClassProps, RelationshipConstraintProps, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType,
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
  const refSchemaJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "RefSchema",
    version: "1.2.3",
    items: {
      RefSourceBaseEntity: {
        schemaItemType: "EntityClass",
      },
      RefTargetBaseEntity: {
        schemaItemType: "EntityClass",
      },
      RefSourceEntity: {
        schemaItemType: "EntityClass",
        baseClass: "RefSchema.RefSourceBaseEntity",
      },
      RefTargetEntity: {
        schemaItemType: "EntityClass",
        baseClass: "RefSchema.RefTargetBaseEntity",
      },
    },
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let refSchema: Schema;
  let testKey: SchemaKey;
  let refKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testSchema = await Schema.fromJson(schemaJson, context);
    refSchema = await Schema.fromJson(refSchemaJson, context);
    testEditor = new SchemaContextEditor(context);
    testKey = testSchema.schemaKey;
    refKey = refSchema.schemaKey;
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

  it.only("should create a relationship class via the create method", async () => {
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as RelationshipClass;
    expect(relClass.name).to.equal("TestRelationship");
    expect(relClass.modifier).to.equal(ECClassModifier.None);
    expect(relClass.strength).to.equal(StrengthType.Holding);
    expect(relClass.strengthDirection).to.equal(StrengthDirection.Forward);
  });

  it.only("should create a new relationship class with a base class", async () => {
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
      name: "BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: sourceJson,
      target: targetJson,
    };

    const baseResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result.itemKey!);
    expect(await testRelationship?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
  });

  it.only("should create a new relationship class with a base class from different schema", async () => {
    const sourceJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Source RoleLabel",
      abstractConstraint: "RefSchema.RefSourceBaseEntity",
      constraintClasses: [
        "RefSchema.RefSourceEntity",
      ],
    };
    const targetJson: RelationshipConstraintProps = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Target RoleLabel",
      abstractConstraint: "RefSchema.RefTargetBaseEntity",
      constraintClasses: [
        "RefSchema.RefTargetEntity",
      ],
    };

    const relClassProps: RelationshipClassProps = {
      name: "RefRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: sourceJson,
      target: targetJson,
    };

    const baseResult = await testEditor.relationships.createFromProps(refKey, relClassProps);
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result.itemKey!);
    expect(await testRelationship?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
  });

  it.only("try creating a new relationship class with base class from unknown schema, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    await expect(testEditor.relationships.create(testKey, "testEntity", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseClassKey)).to.be.rejectedWith(ECObjectsError, `Schema Key ${badSchemaKey.toString(true)} not found in context`);
  });

  it.only("try creating a new relationship class with a base class that cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const result = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseClassKey);
    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Unable to locate base class ${baseClassKey.fullName} in schema ${testKey.name}.`);
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
