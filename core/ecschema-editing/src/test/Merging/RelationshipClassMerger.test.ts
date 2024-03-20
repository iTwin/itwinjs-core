/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RelationshipClass, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Relationship Class merger tests", () => {
  let targetContext: SchemaContext;
  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };
  const testJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TestSchema",
    version: "01.00.15",
    alias: "test",
    items: {
      SourceBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TargetBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TestEntity: {
        schemaItemType: "EntityClass",
      },
      SourceEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.SourceBaseEntity",
      },
      SourceChildEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.SourceEntity",
      },
      TargetEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.TargetBaseEntity",
      },
      TargetChildEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.TargetEntity",
      },
      ... createBaseRelationship(
        { constraintClasses: ["TestSchema.SourceBaseEntity"] },
        { constraintClasses: ["TestSchema.TargetEntity"] },
      ),
    },
  };

  function createBaseRelationship(sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      BaseRelationship: {
        schemaItemType: "RelationshipClass",
        description: "Description of TestRelationship",
        modifier: "None",
        strength: "Referencing",
        strengthDirection: "Forward",
        source: {
          multiplicity: "(0..*)",
          polymorphic: true,
          roleLabel: "refers to",
          ...sourceConstraintClasses,
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "is referenced by",
          polymorphic: true,
          ...targetConstraintClasses,
        },
      },
    };
  }

  function createChildRelationship(sourceConstraintClasses: any, targetConstraintClasses: any) {
    return {
      ChildRelationship: {
        schemaItemType: "RelationshipClass",
        description: "Description of TestRelationship",
        baseClass: "TestSchema.BaseRelationship",
        modifier: "None",
        strength: "Referencing",
        strengthDirection: "Forward",
        source: {
          multiplicity: "(0..*)",
          polymorphic: true,
          roleLabel: "refers to",
          ...sourceConstraintClasses,
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "is referenced by",
          polymorphic: true,
          ...targetConstraintClasses,
        },
      },
    };
  }

  beforeEach(() => {
    targetContext = new SchemaContext();
  });

  it("should merge missing relationship class", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson(targetJson, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "Schema",
          path: "$references",
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          difference: {
            description: "Description of TestRelationship",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "TestSchema.SourceBaseEntity",
              constraintClasses: [
                "TestSchema.SourceEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              abstractConstraint: "TestSchema.TargetBaseEntity",
              constraintClasses: [
                "TestSchema.TargetEntity",
              ],
            },
          },
        },
      ],
    });

    const mergedEntity = await mergedSchema.getItem<RelationshipClass>("BaseRelationship");
    expect(mergedEntity!.toJSON()).deep.equals({
      description: "Description of TestRelationship",
      modifier: "None",
      schemaItemType: "RelationshipClass",
      source: {
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.SourceEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "refers to",
      },
      strength: "Referencing",
      strengthDirection: "Forward",
      target: {
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TargetEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is referenced by",
      },
    });
  });

  it("should merge class and constraint attribute changes", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
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
            abstractConstraint: "TestSchema.SourceBaseEntity",
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "is referenced by",
            polymorphic: false,
            abstractConstraint: "TestSchema.TargetBaseEntity",
            constraintClasses: [
              "TestSchema.TargetEntity",
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "TestRelationship",
          difference: {
            description: "Changes of TestRelationship",
            modifier: "None",
          },
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "TestRelationship",
          path: "$source",
          difference: {
            roleLabel: "is base model for",
          },
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "TestRelationship",
          path: "$target",
          difference: {
            roleLabel: "has base",
            polymorphic: true,
          },
        },
      ],
    });

    const mergedEntity = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
    expect(mergedEntity!.toJSON()).deep.equals({
      description: "Changes of TestRelationship",
      modifier: "None",
      schemaItemType: "RelationshipClass",
      source: {
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.SourceEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is base model for",
      },
      strength: "Referencing",
      strengthDirection: "Forward",
      target: {
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TargetEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "has base",
      },
    });
  });

  it("should merge missing constraint class", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ... createBaseRelationship(
          {
            abstractConstraint: "TestSchema.SourceBaseEntity",
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          {
            abstractConstraint: "TestSchema.TargetBaseEntity",
            constraintClasses: [
              "TestSchema.TargetChildEntity",
            ],
          },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source.constraintClasses",
          difference: [
            "TestSchema.SourceChildEntity",
          ],
        },
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$target.constraintClasses",
          difference: [
            "TestSchema.TargetEntity",
          ],
        },
      ],
    });

    const mergedEntity = await mergedSchema.getItem<RelationshipClass>("BaseRelationship");
    expect(mergedEntity!.toJSON().source.constraintClasses).deep.equals([
      "TestSchema.SourceEntity",
      "TestSchema.SourceChildEntity",
    ]);
    expect(mergedEntity!.toJSON().target.constraintClasses).deep.equals([
      "TestSchema.TargetChildEntity",
      "TestSchema.TargetEntity",
    ]);
  });

  it("should throw an error merging multiple constraint classes without abstract constraint defined", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ... createBaseRelationship(
          { constraintClasses: ["TestSchema.SourceEntity"] },
          { constraintClasses: ["TestSchema.TargetBaseEntity"] },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source.constraintClasses",
          difference: [
            "TestSchema.SourceBaseEntity",
          ],
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source",
          difference: {
            abstractConstraint: "TestSchema.SourceBaseEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, "ECObjects-1601: The Source-Constraint of 'TargetSchema.BaseRelationship' has multiple constraint classes which requires an abstract constraint to be defined.");
  });

  it("should throw an error merging constraint classes not supported by base class constraint", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ... createBaseRelationship(
          {
            abstractConstraint: "TestSchema.SourceBaseEntity",
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          {
            abstractConstraint: "TestSchema.TargetBaseEntity",
            constraintClasses: [
              "TestSchema.TargetEntity",
            ],
          },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source.constraintClasses",
          difference: [
            "TestSchema.TestEntity",
          ],
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source",
          difference: {
            abstractConstraint: "TestSchema.TestEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, "ECObjects-1502: The constraint class 'TestSchema.TestEntity' on the Source-Constraint of 'TargetSchema.BaseRelationship' is not derived from the abstract constraint class 'TestSchema.SourceBaseEntity'.");
  });

  it("should throw an error merging constraint classes not supported by base class constraint", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ... createChildRelationship(
          { constraintClasses: ["TestSchema.TargetBaseEntity"] },
          { constraintClasses: ["TestSchema.TargetChildEntity"] },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "ChildRelationship",
          path: "$source.constraintClasses",
          difference: [
            "TestSchema.SourceEntity",
          ],
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "ChildRelationship",
          path: "$source",
          difference: {
            abstractConstraint: "TestSchema.SourceEntity",
          },
        },
        {
          changeType: "add",
          schemaType: "RelationshipClass",
          itemName: "ChildRelationship",
          path: "$target.constraintClasses",
          difference: [
            "TestSchema.TargetBaseEntity",
          ],
        },
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "ChildRelationship",
          path: "$target",
          difference: {
            abstractConstraint: "TestSchema.TargetBaseEntity",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, `ECObjects-1501: The constraint class 'TestSchema.TargetBaseEntity' on the Source-Constraint of 'TargetSchema.ChildRelationship' is not supported by the base class constraint in 'TestSchema.BaseRelationship'.\r\nECObjects-1502: The constraint class 'TestSchema.TargetBaseEntity' on the Source-Constraint of 'TargetSchema.ChildRelationship' is not derived from the abstract constraint class 'TestSchema.SourceBaseEntity'.`);
  });

  it("should throw an error merging relationship class strengthDirection", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        BaseRelationship: {
          schemaItemType: "RelationshipClass",
          description: "Description of TestRelationship",
          modifier: "None",
          strength: "Referencing",
          strengthDirection: "Forward",
          source: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "refers to",
            constraintClasses: [
              "TestSchema.SourceBaseEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "is referenced by",
            polymorphic: true,
            constraintClasses: [
              "TestSchema.TargetBaseEntity",
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          difference: {
            strengthDirection: "Backward",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, `Changing the relationship 'BaseRelationship' strengthDirection is not supported.`);
  });

  it("should throw an error merging relationship class strength", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        BaseRelationship: {
          schemaItemType: "RelationshipClass",
          description: "Description of TestRelationship",
          modifier: "None",
          strength: "Referencing",
          strengthDirection: "Forward",
          source: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "refers to",
            constraintClasses: [
              "TestSchema.SourceBaseEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "is referenced by",
            polymorphic: true,
            constraintClasses: [
              "TestSchema.TargetBaseEntity",
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          difference: {
            strength: "Embedding",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, `Changing the relationship 'BaseRelationship' strength is not supported.`);
  });

  it("should throw an error merging relationship constraint multiplicity", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        BaseRelationship: {
          schemaItemType: "RelationshipClass",
          description: "Description of TestRelationship",
          modifier: "None",
          strength: "Referencing",
          strengthDirection: "Forward",
          source: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "refers to",
            constraintClasses: [
              "TestSchema.SourceBaseEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            roleLabel: "is referenced by",
            polymorphic: true,
            constraintClasses: [
              "TestSchema.TargetBaseEntity",
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      changes: [
        {
          changeType: "modify",
          schemaType: "RelationshipClass",
          itemName: "BaseRelationship",
          path: "$source",
          difference: {
            multiplicity: "(1..1)",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith(Error, `Changing the relationship constraint 'BaseRelationship:Source' multiplicity is not supported.`);
  });
});
