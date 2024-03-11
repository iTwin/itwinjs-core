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
  let sourceContext: SchemaContext;

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
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
    sourceContext = new SchemaContext();
  });

  describe("Relationship Class missing tests", () => {
    it("should merge missing relationship class", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
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
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceEntity = await sourceSchema.getItem<RelationshipClass>("BaseRelationship");
      const mergedEntity = await mergedSchema.getItem<RelationshipClass>("BaseRelationship");
      expect(mergedEntity!.toJSON()).deep.eq(sourceEntity!.toJSON());
    });
  });

  describe("Relationship Class delta tests", () => {
    it("should merge class and constraint attribute changes", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            description: "Changes of TestRelationship",
            modifier: "None",
            strength: "Referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "is base model for",
              polymorphic: true,
              abstractConstraint: "TestSchema.SourceBaseEntity",
              constraintClasses: [
                "TestSchema.SourceEntity",
              ],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "has base",
              polymorphic: true,
              abstractConstraint: "TestSchema.TargetBaseEntity",
              constraintClasses: [
                "TestSchema.TargetEntity",
              ],
            },
          },
        },
      }, sourceContext);

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

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceEntity = await sourceSchema.getItem<RelationshipClass>("TestRelationship");
      const mergedEntity = await mergedSchema.getItem<RelationshipClass>("TestRelationship");
      expect(mergedEntity!.toJSON()).deep.eq(sourceEntity!.toJSON());
    });

    it("should merge missing constraint class", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
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
                "TestSchema.SourceChildEntity",
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
      }, sourceContext);

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

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedEntity = await mergedSchema.getItem<RelationshipClass>("BaseRelationship");
      expect(mergedEntity!.toJSON().source.constraintClasses).deep.eq([
        "TestSchema.SourceEntity",
        "TestSchema.SourceChildEntity",
      ]);
      expect(mergedEntity!.toJSON().target.constraintClasses).deep.eq([
        "TestSchema.TargetChildEntity",
        "TestSchema.TargetEntity",
      ]);
    });

    it("should throw an error merging multiple constraint classes without abstract constraint defined", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          ... createBaseRelationship(
            { constraintClasses: ["TestSchema.SourceBaseEntity"] },
            { constraintClasses: ["TestSchema.TargetBaseEntity"] },
          ),
        },
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "ECObjects-1601: The Source-Constraint of 'TargetSchema.BaseRelationship' has multiple constraint classes which requires an abstract constraint to be defined.");
    });

    it("should throw an error merging constraint classes not supported by base class constraint", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          ... createBaseRelationship(
            { constraintClasses: ["TestSchema.TestEntity"] },
            {
              abstractConstraint: "TestSchema.TargetBaseEntity",
              constraintClasses: [
                "TestSchema.TargetEntity",
              ],
            },
          ),
        },
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, "ECObjects-1502: The constraint class 'TestSchema.TestEntity' on the Source-Constraint of 'TargetSchema.BaseRelationship' is not derived from the abstract constraint class 'TestSchema.SourceBaseEntity'.");
    });

    it("should throw an error merging constraint classes not supported by base class constraint", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "TestSchema",
            version: "01.00.15",
          },
        ],
        items: {
          ... createChildRelationship(
            { constraintClasses: ["TestSchema.SourceEntity"] },
            { constraintClasses: ["TestSchema.TargetBaseEntity"] },
          ),
        },
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, `ECObjects-1501: The constraint class 'TestSchema.TargetBaseEntity' on the Source-Constraint of 'TargetSchema.ChildRelationship' is not supported by the base class constraint in 'TestSchema.BaseRelationship'.\r\nECObjects-1502: The constraint class 'TestSchema.TargetBaseEntity' on the Source-Constraint of 'TargetSchema.ChildRelationship' is not derived from the abstract constraint class 'TestSchema.SourceBaseEntity'.`);
    });

    it("should throw an error merging relationship class strengthDirection", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
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
            strengthDirection: "Backward",
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
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, `Changing the relationship 'BaseRelationship' strengthDirection is not supported.`);
    });

    it("should throw an error merging relationship class strength", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
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
            strength: "Embedding",
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
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, `Changing the relationship 'BaseRelationship' strength is not supported.`);
    });

    it("should throw an error merging relationship constraint multiplicity", async () => {
      await Schema.fromJson(testJson, sourceContext);
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
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
              multiplicity: "(1..1)",
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
      }, sourceContext);

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

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith(Error, `Changing the relationship constraint 'BaseRelationship:Source' multiplicity is not supported.`);
    });
  });
});
