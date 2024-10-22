/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RelationshipClass, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { ECEditingStatus } from "../../Editing/Exception";
import { AnyDiagnostic } from "../../ecschema-editing";
import { BisTestHelper } from "../TestUtils/BisTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */

function getRuleViolationMessage(ruleViolations: AnyDiagnostic[]) {
  let violations = "";
  for (const diagnostic of ruleViolations) {
    violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
  }
  return violations;
}

describe("Relationship Class merger tests", () => {
  let targetContext: SchemaContext;
  const targetJson = {
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
  };

  const testJson = {
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
      ...createBaseRelationship(
        { constraintClasses: ["TestSchema.SourceBaseEntity"] },
        { constraintClasses: ["TestSchema.TargetBaseEntity"] },
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

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
  });

  it("should merge missing relationship class with added constraint classes", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson(targetJson, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "AbstractConstraintEntity",
          difference: {
            modifier: "Abstract",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "ConstraintEntity",
          difference: {
            baseClass: "SourceSchema.AbstractConstraintEntity",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "TestRelationship",
          difference: {
            description: "Description of TestRelationship",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              abstractConstraint: "SourceSchema.AbstractConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              abstractConstraint: "SourceSchema.AbstractConstraintEntity",
              constraintClasses: [
                "SourceSchema.ConstraintEntity",
              ],
            },
          },
        },
      ],
    });

    const mergedEntity = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
    expect(mergedEntity!.toJSON()).deep.equals({
      description: "Description of TestRelationship",
      modifier: "None",
      schemaItemType: "RelationshipClass",
      source: {
        abstractConstraint: "TargetSchema.AbstractConstraintEntity",
        constraintClasses: [
          "TargetSchema.ConstraintEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "refers to",
      },
      strength: "Referencing",
      strengthDirection: "Forward",
      target: {
        abstractConstraint: "TargetSchema.AbstractConstraintEntity",
        constraintClasses: [
          "TargetSchema.ConstraintEntity",
        ],
        multiplicity: "(0..*)",
        polymorphic: true,
        roleLabel: "is referenced by",
      },
    });
  });

  it("should merge missing relationship class with referenced constraint classes", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson(targetJson, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "TestSchema",
            version: "01.00.15",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.RelationshipClass,
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

  it("should merge relationship class baseclass to one that derives from", async () => {
    await Schema.fromJson(testJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createChildRelationship(
          {
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          {
            constraintClasses: [
              "TestSchema.TargetEntity",
            ],
          },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "TestRelationship",
          difference: {
            modifier: "None",
            baseClass: "TestSchema.BaseRelationship",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
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
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "ChildRelationship",
          difference: {
            baseClass: "SourceSchema.TestRelationship",
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem<RelationshipClass>("ChildRelationship");
    expect(mergedItem!.toJSON().baseClass).deep.eq("TargetSchema.TestRelationship");
  });

  it("should merge class and constraint attribute changes", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "TestRelationship",
          difference: {
            description: "Changes of TestRelationship",
            modifier: "None",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.RelationshipConstraint,
          itemName: "TestRelationship",
          path: "$source",
          difference: {
            roleLabel: "is base model for",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.RelationshipConstraint,
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

  it("should merge missing added constraint classes", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createBaseRelationship(
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
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "SourceEntity",
          difference: {
            baseClass: "TestSchema.SourceBaseEntity",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.EntityClass,
          itemName: "TargetEntity",
          difference: {
            baseClass: "TestSchema.TargetBaseEntity",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$source",
          difference: [
            "SourceSchema.SourceEntity",
          ],
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$target",
          difference: [
            "SourceSchema.TargetEntity",
          ],
        },
      ],
    });

    const mergedEntity = await mergedSchema.getItem<RelationshipClass>("BaseRelationship");
    expect(mergedEntity!.toJSON().source.constraintClasses).deep.equals([
      "TestSchema.SourceEntity",
      "TargetSchema.SourceEntity",
    ]);
    expect(mergedEntity!.toJSON().target.constraintClasses).deep.equals([
      "TestSchema.TargetChildEntity",
      "TargetSchema.TargetEntity",
    ]);
  });

  it("should merge missing referenced constraint class", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createBaseRelationship(
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
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$source",
          difference: [
            "TestSchema.SourceChildEntity",
          ],
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$target",
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
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createBaseRelationship(
          { constraintClasses: ["TestSchema.SourceEntity"] },
          { constraintClasses: ["TestSchema.TargetBaseEntity"] },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$source",
          difference: [
            "TestSchema.SourceBaseEntity",
          ],
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.RelationshipConstraint,
          itemName: "BaseRelationship",
          path: "$source",
          difference: {
          },
        },
      ],
    });

    // await expect(merge).to.be.rejectedWith(Error, "ECObjects-1601: The Source-Constraint of 'TargetSchema.BaseRelationship' has multiple constraint classes which requires an abstract constraint to be defined.");
    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(error).to.have.nested.property("innerError.message", `Rule violations occurred from Source constraint of RelationshipClass TargetSchema.BaseRelationship: ${getRuleViolationMessage(error.innerError.ruleViolations)}`);
    });
  });

  it("should throw an error merging constraint classes not supported by base class constraint", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createBaseRelationship(
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
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "BaseRelationship",
          path: "$source",
          difference: [
            "TestSchema.TestEntity",
          ],
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(error).to.have.nested.property("innerError.message", `Rule violations occurred from RelationshipClass TargetSchema.BaseRelationship: ${getRuleViolationMessage(error.innerError.ruleViolations)}`);
    });
  });

  it("should throw an error merging constraint classes not supported by base class constraint", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createChildRelationship(
          { constraintClasses: ["TestSchema.TargetBaseEntity"] },
          { constraintClasses: ["TestSchema.TargetChildEntity"] },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetSchema.context);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "ChildRelationship",
          path: "$source",
          difference: [
            "TestSchema.SourceEntity",
          ],
        },
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.RelationshipConstraintClass,
          itemName: "ChildRelationship",
          path: "$target",
          difference: [
            "TestSchema.TargetBaseEntity",
          ],
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddConstraintClass);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.RuleViolation);
      expect(error).to.have.nested.property("innerError.message", `Rule violations occurred from RelationshipClass TargetSchema.ChildRelationship: ${getRuleViolationMessage(error.innerError.ruleViolations)}`);
    });
  });

  it("should throw an error merging relationship class strengthDirection", async () => {
    await Schema.fromJson(testJson, targetContext);
    const targetSchema = await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
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
        ...targetJson.references,
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
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
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
        ...targetJson.references,
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
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.RelationshipConstraint,
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

  it("should throw an error when merging base class to one that doesn't derive from", async () => {
    await Schema.fromJson(testJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createChildRelationship(
          {
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          {
            constraintClasses: [
              "TestSchema.TargetEntity",
            ],
          },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "TestRelationship",
          difference: {
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "refers to",
              polymorphic: true,
              constraintClasses: [
                "TestSchema.SourceEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "TestSchema.TargetEntity",
              ],
            },
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "ChildRelationship",
          difference: {
            baseClass: "SourceSchema.TestRelationship",
          },
        },
      ],
    });

    await expect(merge).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.SetBaseClass);
      expect(error).to.have.nested.property("innerError.message", `Base class TargetSchema.TestRelationship must derive from TestSchema.BaseRelationship.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidBaseClass);
    });
  });

  it("should throw an error merging base class changed from undefined to existing one", async () => {
    await Schema.fromJson(testJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "TestSchema",
          version: "01.00.15",
        },
      ],
      items: {
        ...createBaseRelationship(
          {
            constraintClasses: [
              "TestSchema.SourceEntity",
            ],
          },
          {
            constraintClasses: [
              "TestSchema.TargetEntity",
            ],
          },
        ),
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.RelationshipClass,
          itemName: "BaseRelationship",
          difference: {
            baseClass: "TestSchema.BaseRelationship",
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the class 'BaseRelationship' baseClass is not supported.");
  });
});
