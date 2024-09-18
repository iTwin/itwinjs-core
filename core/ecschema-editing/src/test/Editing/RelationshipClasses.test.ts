/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import {
  ECClassModifier, ECVersion, EntityClass, NavigationProperty, NavigationPropertyProps, RelationshipClass, RelationshipClassProps, RelationshipConstraint,
  RelationshipConstraintProps, RelationshipEnd, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { AnyDiagnostic, Diagnostics } from "../../ecschema-editing";
import { ECEditingStatus } from "../../Editing/Exception";

function getRuleViolationMessage(ruleViolations: AnyDiagnostic[]) {
  let violations = "";
  for (const diagnostic of ruleViolations){
    violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
  }
  return violations;
}

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
    const relClass = await testEditor.schemaContext.getSchemaItem(result) as RelationshipClass;
    const baseSourceClassKey = testSchema.getSchemaItemKey("TestSchema.SourceBaseEntity");
    expect(await relClass.source.abstractConstraint).toEqual(await testEditor.schemaContext.getSchemaItem(baseSourceClassKey));
  });

  it("should create a relationship class via the create method", async () => {
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(result) as RelationshipClass;
    expect(relClass.name).toEqual("TestRelationship");
    expect(relClass.modifier).toEqual(ECClassModifier.None);
    expect(relClass.strength).toEqual(StrengthType.Holding);
    expect(relClass.strengthDirection).toEqual(StrengthDirection.Forward);
  });

  it("should create a new relationship class with a base class", async () => {
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
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result);
    expect(await testRelationship?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
  });

  it("should create a new relationship class with a base class from different schema", async () => {
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
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result);
    expect(await testRelationship?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
  });

  it("should remove a base class from relationship class", async () => {
    const baseClassRes = await testEditor.relationships.create(testKey, "testBaseClass", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward,baseClassRes);

    const testRel = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(relRes);
    expect(await testRel?.baseClass).toEqual(await testEditor.schemaContext.getSchemaItem<RelationshipClass>(baseClassRes));

    await testEditor.relationships.setBaseClass(relRes, undefined);
    expect(await testRel?.baseClass).toEqual(undefined);
  });

  it("should add a base class to relationship class, that constraints supported by base class constraints", async () => {
    const baseClassProps: RelationshipClassProps = {
      name: "BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.TestSourceEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TestTargetEntity",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const baseClassRes = await testEditor.relationships.createFromProps(testKey, baseClassProps);
    const relRes = await testEditor.relationships.createFromProps(testKey, relClassProps);

    const baseClass = await testEditor.schemaContext.getSchemaItem(baseClassRes) as RelationshipClass;
    const relClass = await testEditor.schemaContext.getSchemaItem(relRes) as RelationshipClass;
    expect(relClass.baseClass).toBeUndefined();

    await testEditor.relationships.setBaseClass(relRes, baseClassRes);
    expect(await relClass.baseClass).toEqual(baseClass);
  });

  it("should change a relationship base class to one from base class superset", async () => {
    const newBaseClassProps: RelationshipClassProps = {
      name: "NewRelationship",
      baseClass: "TestSchema.BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const baseClassProps: RelationshipClassProps = {
      name: "BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      baseClass: "TestSchema.BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.TestSourceEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TestTargetEntity",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const baseClassRes = await testEditor.relationships.createFromProps(testKey, baseClassProps);
    const newBaseClassRes = await testEditor.relationships.createFromProps(testKey, newBaseClassProps);
    const relRes = await testEditor.relationships.createFromProps(testKey, relClassProps);

    const baseClass = await testEditor.schemaContext.getSchemaItem(baseClassRes) as RelationshipClass;
    const newBaseClass = await testEditor.schemaContext.getSchemaItem(newBaseClassRes) as RelationshipClass;
    const relClass = await testEditor.schemaContext.getSchemaItem(relRes) as RelationshipClass;
    expect(await relClass.baseClass).toEqual(baseClass);

    await testEditor.relationships.setBaseClass(relRes, newBaseClassRes);
    expect(await relClass.baseClass).toEqual(newBaseClass);
  });

  it("should set source and target constraints to the relationship", async () => {
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const sourceConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, sourceConstraint);
    const targetConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Target, "target label", true);
    await testEditor.relationships.setTargetConstraint(relClass.key, targetConstraint);
    expect(relClass.source).toEqual(sourceConstraint);
    expect(relClass.target).toEqual(targetConstraint);
  });

  it("should create a navigation property", async () => {
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    await testEditor.relationships.createNavigationProperty(relClass.key, "TestProperty", "TestSchema.TestRelationship", "Forward");
    const navProperty = await relClass.getProperty("TestProperty") as NavigationProperty;
    expect(await navProperty.relationshipClass).toEqual(relClass);
    expect(navProperty.direction).toEqual(StrengthDirection.Forward);
  });

  it("should create a navigation property from props", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const navProps: NavigationPropertyProps = {
      name: "TestProperty",
      type: "NavigationProperty",
      relationshipName: "TestSchema.TestRelationship",
      direction: "Forward",
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    await testEditor.relationships.createNavigationPropertyFromProps(relClass.key, navProps);
    const navProperty = await relClass.getProperty(navProps.name) as NavigationProperty;
    expect(await navProperty.relationshipClass).toEqual(relClass);
    expect(navProperty.direction).toEqual(StrengthDirection.Forward);
  });

  it("should add a constraint class", async () => {
    const relResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relResult) as RelationshipClass;
    const constraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, constraint);
    const entityResult = await testEditor.entities.create(testKey, "TestEntity", ECClassModifier.None);
    const entityClass = await testEditor.schemaContext.getSchemaItem(entityResult) as EntityClass;
    await testEditor.relationships.addConstraintClass(constraint, entityClass);

    expect(await relClass.source.abstractConstraint).toEqual(entityClass);
    expect(await relClass.source.constraintClasses![0]).toEqual(entityClass);
  });

  it("should add an additional constraint class derived from an abstract constraint", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("TestSourceEntity", testKey)) as EntityClass;
    await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);

    expect(relClass.source.constraintClasses?.length).toEqual(2);
    expect(await relClass.source.constraintClasses![1]).toEqual(constraintClass);
  });

  it("should add an abstract constraint", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;
    await testEditor.relationships.setAbstractConstraint(relClass.source, constraintClass);
    expect(await relClass.source.abstractConstraint).toEqual(constraintClass);
  });

  it("should remove a constraint class", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;
    await testEditor.relationships.removeConstraintClass(relClass.source, constraintClass);

    expect(relClass.source.constraintClasses?.length).toEqual(1);
    expect((await relClass.source.constraintClasses![0]).fullName).toEqual("TestSchema.TestSourceEntity");
  });

  it("try assigning a constraint class that doesn't derive from the abstract constraint, returns error", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClassResult = await testEditor.relationships.create(testKey, "MyRelationship", ECClassModifier.Sealed,  StrengthType.Holding, StrengthDirection.Forward);
    const constraintClass = await testEditor.schemaContext.getSchemaItem(constraintClassResult) as RelationshipClass;

    try {
      await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);
    } catch(e: any) {
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from RelationshipClass ${relClassResult.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
      const violations = e.innerError.ruleViolations as AnyDiagnostic[];
      expect(violations[0]).toEqual(new Diagnostics.ConstraintClassesDeriveFromAbstractConstraint(relClass, [constraintClass.fullName, "Source", relClass.fullName, (await relClass.source.abstractConstraint)!.fullName]));
      expect(relClass.source.constraintClasses?.length).toEqual(1);
      expect((await relClass.source.constraintClasses![0]).fullName).toEqual("TestSchema.TestSourceEntity");
    }
  });

  it("try assigning a constraint class that isn't supported by base class constraint, returns error", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const baseRelClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseRelClassResult) as RelationshipClass;
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.Sealed, StrengthType.Embedding, StrengthDirection.Forward, baseRelClass.key);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, constraint);

    const entityClassResult = await testEditor.entities.create(testKey, "TestEntity", ECClassModifier.None);
    const entityClass = await testEditor.schemaContext.getSchemaItem(entityClassResult) as EntityClass;

    try {
      await testEditor.relationships.addConstraintClass(relClass.source, entityClass);
    } catch(e: any) {
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from RelationshipClass ${relClassResult.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
      const violations = e.innerError.ruleViolations as AnyDiagnostic[];
      expect(violations[0]).toEqual(new Diagnostics.AbstractConstraintMustNarrowBaseConstraints(relClass, [entityClass.fullName, "Source", relClass.fullName, baseRelClass.fullName]));
      expect(violations[1]).toEqual(new Diagnostics.DerivedConstraintsMustNarrowBaseConstraints(relClass, [entityClass.fullName, "Source", relClass.fullName, baseRelClass.fullName]));
    }
  });

  it("try assigning multiple constraint classes without abstract constraint, returns error", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;

    try {
      await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);
    } catch(e: any) {
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from Source constraint of RelationshipClass ${relClassResult.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
      const violations = e.innerError.ruleViolations as AnyDiagnostic[];
      expect(violations[0]).toEqual(new Diagnostics.AbstractConstraintMustExistWithMultipleConstraints(relClass.source, ["Source", relClass.fullName]));
      expect(relClass.source.constraintClasses?.length).toEqual(1);
      expect((await relClass.source.constraintClasses![0]).fullName).toEqual("TestSchema.TestSourceEntity");
    }
  });

  it("try removing a target constraint class, returns error", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("TestTargetEntity", testKey)) as EntityClass;

    try {
      await testEditor.relationships.removeConstraintClass(relClass.target, constraintClass);
    } catch(e: any) {
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.RemoveConstraintClass);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from Target constraint of RelationshipClass ${relClassResult.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
      const violations = e.innerError.ruleViolations as AnyDiagnostic[];
      expect(violations[0]).toEqual(new Diagnostics.AtLeastOneConstraintClassDefined(relClass.target, ["Target", relClass.fullName]));
      expect(relClass.target.constraintClasses?.length).toEqual(1);
      expect((await relClass.target.constraintClasses![0]).fullName).toEqual("TestSchema.TestTargetEntity");
    }
  });

  it("try removing an abstract constraint, returns error", async () => {
    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult) as RelationshipClass;

    try {
      await testEditor.relationships.setAbstractConstraint(relClass.source, undefined);
    } catch(e: any) {
      expect((await relClass.source.constraintClasses![0]).fullName).toEqual("TestSchema.TestSourceEntity");
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.SetAbstractConstraint);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from Source constraint of RelationshipClass ${relClassResult.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
      const violations = e.innerError.ruleViolations as AnyDiagnostic[];
      expect(violations[0]).toEqual(new Diagnostics.AbstractConstraintMustExistWithMultipleConstraints(relClass.source, ["Source", relClass.fullName]));
      expect((await relClass.source.constraintClasses![0]).fullName).toEqual("TestSchema.TestSourceEntity");
    }
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
    const relClass = await testEditor.schemaContext.getSchemaItem(result) as RelationshipClass;
    const baseSourceClassKey = testSchema.getSchemaItemKey("TestSchema.SourceBaseEntity");
    expect(await relClass.source.abstractConstraint).toEqual(await testEditor.schemaContext.getSchemaItem(baseSourceClassKey));

    let relationship = await testSchema.getItem("TestRelationship");
    expect(relationship).toEqual(relClass);

    const key = relationship?.key as SchemaItemKey;
    await testEditor.relationships.delete(key);

    relationship = await testSchema.getItem("TestRelationship");
    expect(relationship).toBeUndefined();
  });

  it("should not be able to delete a relationship class if it is not in schema", async () => {
    const className = "TestRelationship";
    const classKey = new SchemaItemKey(className, testKey);
    const relationship = await testSchema.getItem(className);
    expect(relationship).toBeUndefined();

    await testEditor.relationships.delete(classKey);
    expect(testEditor.schemaContext.getSchemaItemSync(classKey)).toBeUndefined();
  });

  it("try adding base class to relationship class with different SchemaItemType, returns error", async () => {
    const baseClassRes = await testEditor.entities.create(testKey, "testBaseClass", ECClassModifier.None);
    const relRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    await expect(testEditor.relationships.setBaseClass(relRes, baseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Expected ${baseClassRes.fullName} to be of type RelationshipClass.`,
        errorNumber: ECEditingStatus.InvalidSchemaItemType,
      },
    });
  });

  it("try adding base class to a relationship class where the base class cannot be located, returns error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    const relRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Referencing, StrengthDirection.Forward);

    await expect(testEditor.relationships.setBaseClass(relRes, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `RelationshipClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("try adding base class to non-existing relationship class, returns error", async () => {
    const baseClassRes = await testEditor.relationships.create(testKey, "testBaseClass", ECClassModifier.None, StrengthType.Referencing, StrengthDirection.Forward);
    const relationshipKey = new SchemaItemKey("testRelationship", testKey);

    await expect(testEditor.relationships.setBaseClass(relationshipKey, baseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `RelationshipClass ${relationshipKey.fullName} could not be found in the schema context.`,
        errorNumber: ECEditingStatus.SchemaItemNotFoundInContext,
      },
    });
  });

  it("try adding base class with unknown schema to relationship class, returns error", async () => {
    const schemaKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", schemaKey);
    const relRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Referencing, StrengthDirection.Forward);

    await expect(testEditor.relationships.setBaseClass(relRes, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Schema Key ${schemaKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try changing the relationship base class to one that doesn't derive from, returns error", async () => {
    const baseClassRes = await testEditor.relationships.create(testKey, "testBaseClass", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relRes = await testEditor.relationships.create(testKey, "testRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseClassRes);
    const newBaseClassRes = await testEditor.relationships.create(testKey, "newBaseClass", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);

    const relClass = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(relRes);
    const baseClass = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(baseClassRes);
    expect(await relClass?.baseClass).toEqual(baseClass);

    await expect(testEditor.relationships.setBaseClass(relRes, newBaseClassRes)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.SetBaseClass,
      innerError: {
        message: `Base class ${newBaseClassRes.fullName} must derive from ${baseClassRes.fullName}.`,
        errorNumber: ECEditingStatus.InvalidBaseClass,
      },
    });
  });

  it("try adding base class to relationship class, that constraints not supported by base class constraints, throws error", async () => {
    const baseClassProps: RelationshipClassProps = {
      name: "BaseRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    const relClassProps: RelationshipClassProps = {
      name: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.SourceBaseEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TargetBaseEntity",
        ],
      },
    };

    const baseClassRes = await testEditor.relationships.createFromProps(testKey, baseClassProps);
    const relRes = await testEditor.relationships.createFromProps(testKey, relClassProps);

    await testEditor.schemaContext.getSchemaItem(baseClassRes) as RelationshipClass;
    const relClass = await testEditor.schemaContext.getSchemaItem(relRes) as RelationshipClass;
    expect(relClass.baseClass).toBeUndefined();

    try {
      await testEditor.relationships.setBaseClass(relRes, baseClassRes);
    } catch (e: any) {
      expect(relClass.baseClass).toBeUndefined();
      expect(e).toHaveProperty("errorNumber", ECEditingStatus.SetBaseClass);
      expect(e).toHaveProperty("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(e).toHaveProperty("innerError.message", `Rule violations occurred from RelationshipClass ${relRes.fullName}: ${getRuleViolationMessage(e.innerError.ruleViolations)}`);
    }
  });

  it("try creating Relationship class to unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.relationships.create(badKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `Schema Key ${badKey.toString(true)} could not be found in the context.`,
        errorNumber: ECEditingStatus.SchemaNotFound,
      },
    });
  });

  it("try creating Relationship class with unknown base class, throws error", async () => {
    const baseClassKey = new SchemaItemKey("testBaseClass", testKey);
    await expect(testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseClassKey)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `RelationshipClass ${baseClassKey.fullName} could not be found in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNotFound,
      },
    });
  });

  it("try creating Relationship with existing name, throws error", async () => {
    await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);

    await expect(testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward)).rejects.toMatchObject({
      errorNumber: ECEditingStatus.CreateSchemaItemFailed,
      innerError: {
        message: `RelationshipClass TestSchema.TestRelationship already exists in the schema ${testKey.name}.`,
        errorNumber: ECEditingStatus.SchemaItemNameAlreadyExists,
      },
    });
  });
});
