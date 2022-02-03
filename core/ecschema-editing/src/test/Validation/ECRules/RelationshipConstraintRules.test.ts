/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import type { RelationshipClass} from "@itwin/ecschema-metadata";
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import * as Rules from "../../../Validation/ECRules";
import { createSchemaJsonWithItems } from "../../TestUtils/DeserializationHelpers";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable deprecation/deprecation */

describe("RelationshipConstraintRule tests", () => {
  let schema: Schema;

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

  /** Create test constraint classes along with the provided relationships where:
   * S: Source, T: Target, B: Base, D: Derived, E: Entity, M: Mixin, R: Relationship, A: Abstract
   * Example: SBE1= Source Base Class #1
   */
  function createSchemaJson(baseRelationship: any, childRelationship: any) {
    return createSchemaJsonWithItems({
      ...baseRelationship,
      ...childRelationship,

      SBE1: { schemaItemType: "EntityClass", modifier: "Abstract" },
      SDE1: { schemaItemType: "EntityClass", baseClass: "TestSchema.SBE1" },
      SDE2: { schemaItemType: "EntityClass", baseClass: "TestSchema.SBE1" },
      TBE1: { schemaItemType: "EntityClass", modifier: "Abstract" },
      TDE1: { schemaItemType: "EntityClass", baseClass: "TestSchema.TBE1" },
      TDE2: { schemaItemType: "EntityClass", baseClass: "TestSchema.TBE1" },
    });
  }

  describe("atLeastOneConstraintClassDefined rule tests", () => {
    it("constraints contains one concrete class, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SDE1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TDE1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const sourceResult = Rules.atLeastOneConstraintClassDefined(relationship.source);
      for await (const _diagnostic of sourceResult) {
        expect(false, "Rule should have passed").to.be.true;
      }

      const targetResult = Rules.atLeastOneConstraintClassDefined(relationship.target);
      for await (const _diagnostic of targetResult) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("source constraint contains no constraint class, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: [],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TDE1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const targetResult = Rules.atLeastOneConstraintClassDefined(relationship.target);
      for await (const _diagnostic of targetResult) {
        expect(false, "Rule should have passed").to.be.true;
      }

      const sourceResult = Rules.atLeastOneConstraintClassDefined(relationship.source);
      let resultHasEntries = false;
      for await (const diagnostic of sourceResult) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship.source);
        expect(diagnostic.messageArgs).to.eql(["Source", "TestSchema.BaseRelationship"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.AtLeastOneConstraintClassDefined);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.RelationshipConstraint);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("target constraint contains no concrete class, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SDE1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: [],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const sourceResult = Rules.atLeastOneConstraintClassDefined(relationship.source);
      for await (const _diagnostic of sourceResult) {
        expect(false, "Rule should have passed").to.be.true;
      }

      const targetResult = Rules.atLeastOneConstraintClassDefined(relationship.target);
      let resultHasEntries = false;
      for await (const diagnostic of targetResult) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship.target);
        expect(diagnostic.messageArgs).to.eql(["Target", "TestSchema.BaseRelationship"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.AtLeastOneConstraintClassDefined);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.RelationshipConstraint);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });
  });

  describe("abstractConstraintMustExistWithMultipleConstraints", () => {
    it("multiple constraints, abstract constraint exists, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const sourceResult = Rules.abstractConstraintMustExistWithMultipleConstraints(relationship.source);
      for await (const _diagnostic of sourceResult) {
        expect(false, "Rule should have passed").to.be.true;
      }

      const targetResult = Rules.abstractConstraintMustExistWithMultipleConstraints(relationship.target);
      for await (const _diagnostic of targetResult) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("multiple constraints, abstract constraint exists in base class, rule passes", async () => {
      const baseSourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SBE1"],
      };

      const baseTargetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TBE1"],
      };

      const childSourceConstraints = {
        constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"],
      };
      const childTargetConstraints = {
        constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"],
      };

      const baseJson = createBaseRelationship(true, baseSourceConstraints, baseTargetConstraints);
      const childJson = createChildRelationship(true, childSourceConstraints, childTargetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const sourceResult = Rules.abstractConstraintMustExistWithMultipleConstraints(relationship.source);
      for await (const _diagnostic of sourceResult) {
        expect(false, "Rule should have passed").to.be.true;
      }

      const targetResult = Rules.abstractConstraintMustExistWithMultipleConstraints(relationship.target);
      for await (const _diagnostic of targetResult) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
