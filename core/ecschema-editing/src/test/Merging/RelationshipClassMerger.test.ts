/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClassModifier, EntityClass, RelationshipClass, RelationshipConstraint, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference.js";
import { ECEditingStatus } from "../../Editing/Exception.js";
import { SchemaMerger } from "../../Merging/SchemaMerger.js";
import { AnyDiagnostic, AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing.js";
import { BisTestHelper } from "../TestUtils/BisTestHelper.js";

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

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.0.0",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

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

    const mergedEntity = await mergedSchema.getItem("TestRelationship", RelationshipClass);
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

    const mergedEntity = await mergedSchema.getItem("BaseRelationship", RelationshipClass);
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
    const mergedItem = await mergedSchema.getItem("ChildRelationship", RelationshipClass);
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

    const mergedEntity = await mergedSchema.getItem("TestRelationship", RelationshipClass);
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

    const mergedEntity = await mergedSchema.getItem("BaseRelationship", RelationshipClass);
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

    const mergedEntity = await mergedSchema.getItem("BaseRelationship", RelationshipClass);
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

  describe("iterative tests", () => {
    it("should add a re-mapped relationship class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "RelationshipClass");
        expect(conflict).to.have.a.property("target", "CustomAttributeClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as RelationshipClass;
      schemaEdits.items.rename(testItem, "mergedRelationship");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.CustomAttributeClass);
      });
      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.RelationshipClass);
      });
    });

    it("should add a re-mapped relationship class with re-mapped constraint classes", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "StructClass",
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as RelationshipClass;
      schemaEdits.items.rename(testItem, "mergedRelationship");
      const testEntity = await sourceSchema.getItem("testEntity") as EntityClass;
      schemaEdits.items.rename(testEntity, "mergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).has.property("schemaItemType").equals(SchemaItemType.EntityClass);
      });
      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.property("source").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("mergedEntity");
            expect(source).to.have.a.nested.property("abstractConstraint.name").to.equal("mergedEntity");
            return true;
          });
          expect(ecClass).to.have.a.property("target").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("mergedEntity");
            expect(source).to.have.a.nested.property("abstractConstraint.name").to.equal("mergedEntity");
            return true;
          });
      });
    });

    it("should merge changes to re-mapped relationship class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "RelationshipClass",
            modifier: "None",
            label: "Changed Link",
            description: "Changed Link Relationship",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: false,
              roleLabel: "entity has entity",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "entity has entity (reversed)",
              polymorphic: false,
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
          },
          mergedRelationship: {
            schemaItemType: "RelationshipClass",
            modifier: "Sealed",
            label: "Link",
            description: "Link Relationship",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              constraintClasses: [
                "TargetSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              constraintClasses: [
                "TargetSchema.testEntity",
              ],
            },
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as RelationshipClass;
      schemaEdits.items.rename(testItem, "mergedRelationship");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.property("modifier").to.equal(ECClassModifier.None);
          expect(ecClass).to.have.a.property("label").to.equal("Changed Link");
          expect(ecClass).to.have.a.property("description").to.equal("Changed Link Relationship");
          expect(ecClass).to.have.a.property("source").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.property("polymorphic").to.equal(false);
            expect(source).to.have.a.property("roleLabel").to.equal("entity has entity");
            return true;
          });
          expect(ecClass).to.have.a.property("target").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.property("polymorphic").to.equal(false);
            expect(source).to.have.a.property("roleLabel").to.equal("entity has entity (reversed)");
            return true;
          });
        });
    });

    it("should add constraint classes to re-mapped relationship class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseEntity",
          },
          baseEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: false,
              roleLabel: "entity has entity",
              abstractConstraint: "SourceSchema.baseEntity",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "entity has entity (reversed)",
              polymorphic: false,
              abstractConstraint: "SourceSchema.baseEntity",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          baseEntity: {
            schemaItemType: "EntityClass",
          },
          mergedRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              abstractConstraint: "TargetSchema.baseEntity",
              constraintClasses: [
                "TargetSchema.baseEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              abstractConstraint: "TargetSchema.baseEntity",
              constraintClasses: [
                "TargetSchema.baseEntity",
              ],
            },
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as RelationshipClass;
      schemaEdits.items.rename(testItem, "mergedRelationship");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.property("source").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("baseEntity");
            expect(source).to.have.a.nested.property("constraintClasses[1].name").to.equal("testEntity");
            return true;
          });
          expect(ecClass).to.have.a.property("target").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("baseEntity");
            expect(source).to.have.a.nested.property("constraintClasses[1].name").to.equal("testEntity");
            return true;
          });
      });
    });

    it("should add re-mapped constraint classes to re-mapped relationship class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            baseClass: "SourceSchema.baseEntity",
          },
          baseEntity: {
            schemaItemType: "EntityClass",
          },
          testItem: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: false,
              roleLabel: "entity has entity",
              abstractConstraint: "SourceSchema.baseEntity",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "entity has entity (reversed)",
              polymorphic: false,
              abstractConstraint: "SourceSchema.baseEntity",
              constraintClasses: [
                "SourceSchema.testEntity",
              ],
            },
          },
        },
      }, await BisTestHelper.getNewContext());

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testEntity: {
            schemaItemType: "StructClass",
          },
          baseEntity: {
            schemaItemType: "EntityClass",
          },
          mergedRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "refers to",
              abstractConstraint: "TargetSchema.baseEntity",
              constraintClasses: [
                "TargetSchema.baseEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "is referenced by",
              polymorphic: true,
              abstractConstraint: "TargetSchema.baseEntity",
              constraintClasses: [
                "TargetSchema.baseEntity",
              ],
            },
          },
          testItem: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "any",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const testItem = await sourceSchema.getItem("testItem") as RelationshipClass;
      schemaEdits.items.rename(testItem, "mergedRelationship");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const testEntity = await sourceSchema.getItem("testEntity") as EntityClass;
      schemaEdits.items.rename(testEntity, "mergedEntity");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedRelationship")).to.be.eventually.not.undefined
        .then((ecClass: RelationshipClass) => {
          expect(ecClass).to.have.a.property("source").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("baseEntity");
            expect(source).to.have.a.nested.property("constraintClasses[1].name").to.equal("mergedEntity");
            return true;
          });
          expect(ecClass).to.have.a.property("target").to.satisfy((source: RelationshipConstraint) => {
            expect(source).to.have.a.nested.property("constraintClasses[0].name").to.equal("baseEntity");
            expect(source).to.have.a.nested.property("constraintClasses[1].name").to.equal("mergedEntity");
            return true;
          });
      });
    });
  });
});
