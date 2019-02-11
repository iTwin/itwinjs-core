/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import sinon = require("sinon");
import { createSchemaJsonWithItems } from "../../TestUtils/DeserializationHelpers";
import { Schema } from "../../../src/Metadata/Schema";
import { SchemaContext } from "../../../src/Context";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { RelationshipClass } from "../../../src/Metadata/RelationshipClass";
import * as Rules from "../../../src/Validation/BisRules";
import { expect } from "chai";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";

describe("RelationshipClass Rule Tests", () => {
  async function getTestSchema(items: any, withBisReference: boolean = true): Promise<Schema> {
    let context: SchemaContext | undefined;
    if (!context) {
      context = withBisReference ? await BisTestHelper.getNewContext() : new SchemaContext();
    }
    return Schema.fromJson(createSchemaJson(items, withBisReference), context);
  }

  function createSchemaJson(items: any, withBisReference: boolean) {
    const refJson = !withBisReference ? {} : {
      references: [
        {
          name: "BisCore",
          version: "1.0.0",
        },
      ],
    };
    return createSchemaJsonWithItems(items, refJson);
  }

  beforeEach(async () => {
  });

  afterEach(() => {
    sinon.restore();

  });

  describe("RelationshipClassMustNotUseHoldingStrength tests", () => {
    it("RelationshipClass strength is holding, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipClassMustNotUseHoldingStrength(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.RelationshipClassMustNotUseHoldingStrength);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("RelationshipClass strength is not holding, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipClassMustNotUseHoldingStrength(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("RelationshipSourceMultiplicityUpperBoundRestriction tests", () => {
    it("RelationshipClass source upper bound greater than 1, embedding, forward, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..2)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipSourceMultiplicityUpperBoundRestriction(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.RelationshipSourceMultiplicityUpperBoundRestriction);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("RelationshipClass strength is not embedding, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..2)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipSourceMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass strength direction is backward, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..2)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipSourceMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass source multiplicity upper bound is 1, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipSourceMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("RelationshipTargetMultiplicityUpperBoundRestriction tests", () => {
    it("RelationshipClass target upper bound greater than 1, embedding, backward, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipTargetMultiplicityUpperBoundRestriction(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.RelationshipTargetMultiplicityUpperBoundRestriction);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("RelationshipClass strength is not embedding, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipTargetMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass strength direction is backward, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipTargetMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass target multiplicity upper bound is 1, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
          target: {
            multiplicity: "(0..1)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipTargetMultiplicityUpperBoundRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("RelationshipElementAspectContraintRestriction tests", () => {
    it("RelationshipClass has source ElementAspect constraint, forward direction, no base class, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName, "Target"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.RelationshipElementAspectContraintRestriction);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("RelationshipClass has source ElementAspect constraint, forward direction, ElementOwnsMultiAspects base class, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          baseClass: "BisCore.ElementOwnsMultiAspects",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass has source ElementAspect constraint, forward direction, ElementOwnsUniqueAspect base class, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          baseClass: "BisCore.ElementOwnsUniqueAspect",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass has no constraints, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
            ],
          },
        },
        TestSourceEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass has source ElementAspect constraint, backward direction, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("RelationshipClass has target ElementAspect constraint, backward direction, no base class, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "backward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName, "Source"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.RelationshipElementAspectContraintRestriction);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("RelationshipClass has target ElementAspect constraint, forward direction, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
        TestSourceEntity: {
          baseClass: "BisCore.ElementAspect",
          schemaItemType: "EntityClass",
        },
        TestTargetEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestRelationship")) as RelationshipClass;

      const result = await Rules.relationshipElementAspectContraintRestriction(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("EmbeddingRelationshipsMustNotHaveHasInName tests", () => {
    it("Embedding RelationshipClass with 'Has' in name, rule violated.", async () => {
      const schemaJson = {
        TestHasRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
            ],
          },
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestHasRelationship")) as RelationshipClass;

      const result = await Rules.embeddingRelationshipsMustNotHaveHasInName(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(relationship);
        expect(diagnostic!.messageArgs).to.eql([relationship.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EmbeddingRelationshipsMustNotHaveHasInName);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Holding RelationshipClass with 'Has' in name, rule passes.", async () => {
      const schemaJson = {
        TestHasRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "holding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
            ],
          },
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestHasRelationship")) as RelationshipClass;

      const result = await Rules.embeddingRelationshipsMustNotHaveHasInName(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Referencing RelationshipClass with 'Has' in name, rule passes.", async () => {
      const schemaJson = {
        TestHasRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
            ],
          },
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestHasRelationship")) as RelationshipClass;

      const result = await Rules.embeddingRelationshipsMustNotHaveHasInName(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Embedding RelationshipClass with 'has' (lowercase) in name, rule passes.", async () => {
      const schemaJson = {
        TestPhaseRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
            ],
          },
        },
      };
      const schema = await getTestSchema(schemaJson);
      const relationship = (await schema.getItem("TestPhaseRelationship")) as RelationshipClass;

      const result = await Rules.embeddingRelationshipsMustNotHaveHasInName(relationship);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
