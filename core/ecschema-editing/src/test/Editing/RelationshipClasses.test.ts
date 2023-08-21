/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  RelationshipClass, RelationshipClassProps, RelationshipConstraintProps, Schema, SchemaContext, SchemaItemKey, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Relationship tests from an existing schema", () => {

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

describe("Relationship base class editing tests", () => {
  let testEditor: SchemaContextEditor;
  let testSchema: Schema;
  let context: SchemaContext;


  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
  });

  function createBaseRelationship(polymorphic: boolean, sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      BaseRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "referencing",
        strengthDirection: "forward",
        source: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          ...sourceConstraintClasses,
        },
        target: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          ...targetConstraintClasses,
        },
      },
    };
  }

  function createChildRelationship(polymorphic: boolean, sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      ChildRelationship: {
        baseClass: "TestSchema.BaseRelationship",
        schemaItemType: "RelationshipClass",
        strength: "referencing",
        strengthDirection: "forward",
        source: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          ...sourceConstraintClasses,
        },
        target: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          ...targetConstraintClasses,
        },
      },
    };
  }

  function createRelationship(polymorphic: boolean, sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      ChildRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "referencing",
        strengthDirection: "forward",
        source: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          ...sourceConstraintClasses,
        },
        target: {
          polymorphic,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          ...targetConstraintClasses,
        },
      },
    };
  }

  /** Create test constraint classes along with the provided relationships where:
   * S: Source, T: Target, B: Base, D: Derived, E: Entity, M: Mixin, R: Relationship, A: Abstract
   * Example: SBE1= Source Base Class #1
   */
  function createSchemaJson(baseRelationship: any, childRelationship: any) {
    return createSchemaJsonWithItems({
      ...baseRelationship,
      ...childRelationship,

      SBE1: { schemaItemType: "EntityClass" },
      SDE1: { schemaItemType: "EntityClass", baseClass: "TestSchema.SBE1" },
      SDE2: { schemaItemType: "EntityClass", baseClass: "TestSchema.SBE1" },
      TBE1: { schemaItemType: "EntityClass" },
      TDE1: { schemaItemType: "EntityClass", baseClass: "TestSchema.TBE1" },
      TDE2: { schemaItemType: "EntityClass", baseClass: "TestSchema.TBE1" },

      SM1: { schemaItemType: "Mixin", appliesTo: "TestSchema.SDE1" },
      TM1: { schemaItemType: "Mixin", appliesTo: "TestSchema.TDE1" },

      SBR1: { ...createNavPropRelationship({ constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.SBE1"] }) },
      SDR1: { baseClass: "TestSchema.SBR1", ...createNavPropRelationship({ constraintClasses: ["TestSchema.SDE1"] }, { constraintClasses: ["TestSchema.SDE1"] }) },
      TBR1: { ...createNavPropRelationship({ constraintClasses: ["TestSchema.TBE1"] }, { constraintClasses: ["TestSchema.TBE1"] }) },
      TDR1: { baseClass: "TestSchema.TBR1", ...createNavPropRelationship({ constraintClasses: ["TestSchema.TDE1"] }, { constraintClasses: ["TestSchema.TDE1"] }) },

      E1: { schemaItemType: "EntityClass" },
      E2: { schemaItemType: "EntityClass" },
      M1: { schemaItemType: "Mixin", appliesTo: "TestSchema.E1" },
      R1: { ...createNavPropRelationship({ constraintClasses: ["TestSchema.E1"] }, { constraintClasses: ["TestSchema.E1"] }) },
    });
  }

  function createNavPropRelationship(sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      schemaItemType: "RelationshipClass",
      strength: "Embedding",
      strengthDirection: "Forward",
      modifier: "Sealed",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        ...sourceConstraintClasses,
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        ...targetConstraintClasses,
      },
    };
  }

  it("should add base class to RelationshipClass with undefined base class", async () => {
    const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
    const childJson = createRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"] }, { constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"] });
    testSchema = await Schema.fromJson(createSchemaJson(baseJson, childJson), context);
    const relationship = testSchema.getItemSync("ChildRelationship") as RelationshipClass;
    const baseRelationship = testSchema.getItemSync("BaseRelationship") as RelationshipClass;

    await testEditor.relationships.setBaseClass(relationship.key, baseRelationship.key);
    expect(relationship.baseClass);
    expect((await relationship?.baseClass)?.key).to.eql(baseRelationship.key);
  });
});
