/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SchemaContext } from "../../../Context";
import { RelationshipClass } from "../../../Metadata/RelationshipClass";
import { Schema } from "../../../Metadata/Schema";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";
import * as Rules from "../../../Validation/ECRules";
import { createSchemaJsonWithItems } from "../../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("RelationshipRule tests", () => {
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

  describe("AbstractConstraintMustNarrowBaseConstraints rule tests", () => {
    it("supported source and target constraint classes, rule passes", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"] }, { constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.abstractConstraintMustNarrowBaseConstraints(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("no base class, rule passes", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson: any = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"] }, { constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"] });
      delete childJson.ChildRelationship.baseClass;
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.abstractConstraintMustNarrowBaseConstraints(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("unsupported source constraint class, rule violated", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.E1"] }, { constraintClasses: ["TestSchema.TDE1"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.abstractConstraintMustNarrowBaseConstraints(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.E1", "Source", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.AbstractConstraintMustNarrowBaseConstraints);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("unsupported source and target constraint classes, rule violated twice", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.E1"] }, { constraintClasses: ["TestSchema.E2"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.abstractConstraintMustNarrowBaseConstraints(relationship);

      let count = 0;
      for await (const diagnostic of result) {
        count++;
        const expectedArgs = count === 1 ? ["TestSchema.E1", "Source", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"] :
          ["TestSchema.E2", "Target", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"];

        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(expectedArgs);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.AbstractConstraintMustNarrowBaseConstraints);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(count, "expected rule to return an AsyncIterable with entries.").to.equal(2);
    });
  });

  describe("DerivedConstraintsMustNarrowBaseConstraints rule tests", () => {
    it("supported source and target constraint classes, rule passes", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"] }, { constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.derivedConstraintsMustNarrowBaseConstraints(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("no base class, rule passes", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson: any = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.SDE2"] }, { constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"] });
      delete childJson.ChildRelationship.baseClass;
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.derivedConstraintsMustNarrowBaseConstraints(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("unsupported source constraint class, rule violated", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.E1"] }, { constraintClasses: ["TestSchema.TDE1"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.derivedConstraintsMustNarrowBaseConstraints(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.E1", "Source", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.DerivedConstraintsMustNarrowBaseConstraints);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("unsupported source and target constraint classes, rule violated twice", async () => {
      const baseJson = createBaseRelationship(true, { constraintClasses: ["TestSchema.SBE1"] }, { constraintClasses: ["TestSchema.TBE1"] });
      const childJson = createChildRelationship(true, { constraintClasses: ["TestSchema.SDE1", "TestSchema.E1"] }, { constraintClasses: ["TestSchema.E2"] });
      schema = await Schema.fromJson(createSchemaJson(baseJson, childJson), new SchemaContext());
      const relationship = schema.getItemSync("ChildRelationship") as RelationshipClass;

      const result = Rules.derivedConstraintsMustNarrowBaseConstraints(relationship);

      let count = 0;
      for await (const diagnostic of result) {
        count++;
        const expectedArgs = count === 1 ? ["TestSchema.E1", "Source", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"] :
          ["TestSchema.E2", "Target", "TestSchema.ChildRelationship", "TestSchema.BaseRelationship"];

        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(expectedArgs);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.DerivedConstraintsMustNarrowBaseConstraints);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(count, "expected rule to return an AsyncIterable with entries.").to.equal(2);
    });
  });

  describe("ConstraintClassesDeriveFromAbstractContraint rule tests", () => {

    it("supported source and target constraint Entity classes, rule passes", async () => {
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

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("source and target constraint same as abstract constraint, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SBE1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TBE1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("supported source and target constraint Mixin classes, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SM1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TM1"],
      };

      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("source and target constraint Mixin classes same as abstract, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SM1",
        constraintClasses: ["TestSchema.SM1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TM1",
        constraintClasses: ["TestSchema.TM1"],
      };

      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("supported source and target constraint Relationship classes, rule passes", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBR1",
        constraintClasses: ["TestSchema.SDR1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBR1",
        constraintClasses: ["TestSchema.TDR1"],
      };

      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("supported constraints, abstract constraint defined in base Relationship, rule passes", async () => {
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

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);
      for await (const _diagnostic of result) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("unsupported source constraint Entity class, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SDE1", "TestSchema.E1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TDE1", "TestSchema.TDE2"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.E1", "Source", "TestSchema.BaseRelationship", "TestSchema.SBE1"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.ConstraintClassesDeriveFromAbstractContraint);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("unsupported source constraint Mixin class, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.M1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TM1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.M1", "Source", "TestSchema.BaseRelationship", "TestSchema.SBE1"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.ConstraintClassesDeriveFromAbstractContraint);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("abstract constraint not an Entity class, constraint class is Mixin, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.R1",
        constraintClasses: ["TestSchema.SM1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TM1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.SM1", "Source", "TestSchema.BaseRelationship", "TestSchema.R1"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.ConstraintClassesDeriveFromAbstractContraint);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("unsupported source constraint Relationship class, rule violated", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBR1",
        constraintClasses: ["TestSchema.R1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBR1",
        constraintClasses: ["TestSchema.TDR1"],
      };
      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);

      let resultHasEntries = false;
      for await (const diagnostic of result) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(["TestSchema.R1", "Source", "TestSchema.BaseRelationship", "TestSchema.SBR1"]);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.ConstraintClassesDeriveFromAbstractContraint);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
        break;
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("unsupported source and target constraint Entity classes, rule violated twice", async () => {
      const sourceConstraints = {
        abstractConstraint: "TestSchema.SBE1",
        constraintClasses: ["TestSchema.SDE1", "TestSchema.E1"],
      };
      const targetConstraints = {
        abstractConstraint: "TestSchema.TBE1",
        constraintClasses: ["TestSchema.TDE1", "TestSchema.E2"],
      };

      const baseJson = createBaseRelationship(true, sourceConstraints, targetConstraints);
      schema = await Schema.fromJson(createSchemaJson(baseJson, undefined), new SchemaContext());
      const relationship = schema.getItemSync("BaseRelationship") as RelationshipClass;

      const result = Rules.constraintClassesDeriveFromAbstractContraint(relationship);

      let count = 0;
      for await (const diagnostic of result) {
        count++;
        const expectedArgs = count === 1 ? ["TestSchema.E1", "Source", "TestSchema.BaseRelationship", "TestSchema.SBE1"] :
          ["TestSchema.E2", "Target", "TestSchema.BaseRelationship", "TestSchema.TBE1"];

        expect(diagnostic.ecDefinition).to.equal(relationship);
        expect(diagnostic.messageArgs).to.eql(expectedArgs);
        expect(diagnostic.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic.code).to.equal(Rules.DiagnosticCodes.ConstraintClassesDeriveFromAbstractContraint);
        expect(diagnostic.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(count, "expected rule to return an AsyncIterable with entries.").to.equal(2);
    });
  });
});
