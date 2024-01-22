/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECClassModifier, ECVersion, EntityClass, NavigationProperty, NavigationPropertyProps, RelationshipClass, RelationshipClassProps, RelationshipConstraint,
  RelationshipConstraintProps, RelationshipEnd, Schema, SchemaContext, SchemaItemKey, SchemaKey, StrengthDirection, StrengthType,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { Diagnostics } from "../../ecschema-editing";

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

  it("should create a relationship class via the create method", async () => {
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as RelationshipClass;
    expect(relClass.name).to.equal("TestRelationship");
    expect(relClass.modifier).to.equal(ECClassModifier.None);
    expect(relClass.strength).to.equal(StrengthType.Holding);
    expect(relClass.strengthDirection).to.equal(StrengthDirection.Forward);
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
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result.itemKey!);
    expect(await testRelationship?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
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
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseRelClass.key);

    const testRelationship = await testEditor.schemaContext.getSchemaItem<RelationshipClass>(result.itemKey!);
    expect(await testRelationship?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(baseRelClass.key));
  });

  it("should set source and target constraints to the relationship", async () => {
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const sourceConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, sourceConstraint);
    const targetConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Target, "target label", true);
    await testEditor.relationships.setTargetConstraint(relClass.key, targetConstraint);
    expect(relClass.source).to.eql(sourceConstraint);
    expect(relClass.target).to.eql(targetConstraint);
  });

  it("should create a navigation property", async () => {
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Embedding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const propResult = await testEditor.relationships.createNavigationProperty(relClass.key, "TestProperty", "TestSchema.TestRelationship", "Forward");
    const navProperty = await relClass.getProperty(propResult.propertyName!) as NavigationProperty;
    expect(await navProperty.relationshipClass).to.eql(relClass);
    expect(navProperty.direction).to.eql(StrengthDirection.Forward);
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const propResult = await testEditor.relationships.createNavigationPropertyFromProps(relClass.key, navProps);
    const navProperty = await relClass.getProperty(propResult.propertyName!) as NavigationProperty;
    expect(await navProperty.relationshipClass).to.eql(relClass);
    expect(navProperty.direction).to.eql(StrengthDirection.Forward);
  });

  it("should add a constraint class", async () => {
    const relResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward);
    const relClass = await testEditor.schemaContext.getSchemaItem(relResult.itemKey!) as RelationshipClass;
    const constraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, constraint);
    const entityResult = await testEditor.entities.create(testKey, "TestEntity", ECClassModifier.None);
    const entityClass = await testEditor.schemaContext.getSchemaItem(entityResult.itemKey!) as EntityClass;
    const classResult = await testEditor.relationships.addConstraintClass(constraint, entityClass);

    expect(classResult.errorMessage).to.be.undefined;
    expect(await relClass.source.abstractConstraint).to.eq(entityClass);
    expect(await relClass.source.constraintClasses![0]).to.eq(entityClass);
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("TestSourceEntity", testKey)) as EntityClass;
    const result = await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);

    expect(result.errorMessage).to.be.undefined;
    expect(relClass.source.constraintClasses?.length).eq(2);
    expect(await relClass.source.constraintClasses![1]).eq(constraintClass);
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;
    const result = await testEditor.relationships.setAbstractConstraint(relClass.source, constraintClass);

    expect(result.errorMessage).to.be.undefined;
    expect(await relClass.source.abstractConstraint).eq(constraintClass);
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;
    const result = await testEditor.relationships.removeConstraintClass(relClass.source, constraintClass);

    expect(result.errorMessage).to.be.undefined;
    expect(relClass.source.constraintClasses?.length).eq(1);
    expect((await relClass.source.constraintClasses![0]).fullName).eq("TestSchema.TestSourceEntity");
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClassResult = await testEditor.relationships.create(testKey, "MyRelationship", ECClassModifier.Sealed,  StrengthType.Holding, StrengthDirection.Forward);
    const constraintClass = await testEditor.schemaContext.getSchemaItem(constraintClassResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);

    const error = new Diagnostics.ConstraintClassesDeriveFromAbstractConstraint(relClass, [constraintClass.fullName, "Source", relClass.fullName, (await relClass.source.abstractConstraint)!.fullName]);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.eq(`${error.code}: ${error.messageText}`);

    expect(relClass.source.constraintClasses?.length).to.eq(1);
    expect((await relClass.source.constraintClasses![0]).fullName).to.eq("TestSchema.TestSourceEntity");
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
    const baseRelClass = await testEditor.schemaContext.getSchemaItem(baseRelClassResult.itemKey!) as RelationshipClass;
    const relClassResult = await testEditor.relationships.create(testKey, "TestRelationship", ECClassModifier.Sealed, StrengthType.Embedding, StrengthDirection.Forward, baseRelClass.key);
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraint = new RelationshipConstraint(relClass, RelationshipEnd.Source, "source label", true);
    await testEditor.relationships.setSourceConstraint(relClass.key, constraint);

    const entityClassResult = await testEditor.entities.create(testKey, "TestEntity", ECClassModifier.None);
    const entityClass = await testEditor.schemaContext.getSchemaItem(entityClassResult.itemKey!) as EntityClass;
    const result = await testEditor.relationships.addConstraintClass(relClass.source, entityClass);

    const errorList = [
      new Diagnostics.AbstractConstraintMustNarrowBaseConstraints(relClass, [entityClass.fullName, "Source", relClass.fullName, baseRelClass.fullName]),
      new Diagnostics.DerivedConstraintsMustNarrowBaseConstraints(relClass, [entityClass.fullName, "Source", relClass.fullName, baseRelClass.fullName]),
    ];
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.eq(errorList.map((error) => `${error.code}: ${error.messageText}`).join("\r\n"));
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("SourceBaseEntity", testKey)) as EntityClass;
    const result = await testEditor.relationships.addConstraintClass(relClass.source, constraintClass);

    const error = new Diagnostics.AbstractConstraintMustExistWithMultipleConstraints(relClass.source, ["Source", relClass.fullName]);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.eq(`${error.code}: ${error.messageText}`);

    expect(relClass.source.constraintClasses?.length).to.eq(1);
    expect((await relClass.source.constraintClasses![0]).fullName).to.eq("TestSchema.TestSourceEntity");
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const constraintClass = await testEditor.schemaContext.getSchemaItem(new SchemaItemKey("TestTargetEntity", testKey)) as EntityClass;
    const result = await testEditor.relationships.removeConstraintClass(relClass.target, constraintClass);

    const error = new Diagnostics.AtLeastOneConstraintClassDefined(relClass.target, ["Target", relClass.fullName]);
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.eq(`${error.code}: ${error.messageText}`);

    expect(relClass.target.constraintClasses?.length).to.eq(1);
    expect((await relClass.target.constraintClasses![0]).fullName).to.eq("TestSchema.TestTargetEntity");
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
    const relClass = await testEditor.schemaContext.getSchemaItem(relClassResult.itemKey!) as RelationshipClass;
    const result = await testEditor.relationships.setAbstractConstraint(relClass.source, undefined);

    expect(result.errorMessage).to.not.be.undefined;
    const error = new Diagnostics.AbstractConstraintMustExistWithMultipleConstraints(relClass.source, ["Source", relClass.fullName]);
    expect(result.errorMessage).to.eq(`${error.code}: ${error.messageText}`);

    expect((await relClass.source.constraintClasses![0]).fullName).eq("TestSchema.TestSourceEntity");
  });

  it("try creating a new relationship class with base class from unknown schema, returns error", async () => {
    const badSchemaKey = new SchemaKey("badSchema", new ECVersion(1,0,0));
    const baseClassKey = new SchemaItemKey("testBaseClass", badSchemaKey);
    const result = await testEditor.relationships.create(testKey, "testEntity", ECClassModifier.None, StrengthType.Holding, StrengthDirection.Forward, baseClassKey);
    expect(result).to.not.be.undefined;
    expect(result.errorMessage).to.not.be.undefined;
    expect(result.errorMessage).to.equal(`Schema Key ${badSchemaKey.toString(true)} not found in context`);
  });

  it("try creating a new relationship class with a base class that cannot be located, returns error", async () => {
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
