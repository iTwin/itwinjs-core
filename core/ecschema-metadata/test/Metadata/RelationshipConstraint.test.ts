/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { Schema } from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";
import { RelationshipClass, RelationshipConstraint } from "../../src/Metadata/RelationshipClass";
import { RelationshipEnd } from "../../src/ECObjects";
import { JsonParser } from "../../src/Deserialization/JsonParser";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

function createSchemaJson(sourceConst: any, targetConst: any) {
  return createSchemaJsonWithItems({
    TestRelationship: {
      schemaItemType: "RelationshipClass",
      strength: "referencing",
      strengthDirection: "forward",
      source: {
        ...sourceConst,
      },
      target: {
        ...targetConst,
      },
    },
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
  });
}

describe("RelationshipConstraint", () => {
  let parser = new JsonParser();
  describe("fromJson", () => {
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
    });

    it("should throw for invalid roleLabel", async () => {
      const json: any = {
        polymorphic: true,
        multiplicity: "(1..1)",
        roleLabel: 0,
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, json), ECObjectsError, `The RelationshipConstraint TestRelationship has an invalid 'roleLabel' attribute. It should be of type 'string'.`);
    });
    it("should throw for invalid polymorphic", async () => {
      const json: any = {
        polymorphic: "0",
        multiplicity: "(0..1)",
        roleLabel: "test roleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, json), ECObjectsError, `The RelationshipConstraint TestRelationship has an invalid 'polymorhpic' attribute. It should be of type 'boolean'.`);
    });

    it("should throw for invalid multiplicity", async () => {
      const badMultiplicityJson = {
        polymorphic: true,
        multiplicity: 0,
        roleLabel: "test roleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, badMultiplicityJson), ECObjectsError, `The RelationshipConstraint TestRelationship has an invalid 'multiplicity' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid abstractConstraint", async () => {
      const unloadedAbstractConstraintJson = {
        polymorphic: true,
        multiplicity: 0,
        roleLabel: "test roleLabel",
        abstractConstraint: 0,
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, unloadedAbstractConstraintJson), ECObjectsError);
    });
    it("should throw for invalid constraintClasses", async () => {
      const json: any = {
        polymorphic: true,
        multiplicity: "(0..1)",
        roleLabel: "test roleLabel",
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, { ...json, constraintClass: 0 }), ECObjectsError);
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, { ...json, constraintClass: [0] }), ECObjectsError);
      const unloadedConstraintClassesJson = { ...json, constraintClasses: ["ThisClassDoesNotExist"] };
      await expect(testConstraint.deserialize(parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, unloadedConstraintClassesJson))).to.be.rejectedWith(ECObjectsError);
    });
    it("should throw for invalid customAttributes", async () => {
      const json: any = {
        polymorphic: true,
        multiplicity: "(0..1)",
        roleLabel: "test roleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
        customAttributes: "array",
      };
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, json), ECObjectsError, `The RelationshipConstraint TestRelationship has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });

    const targetStubJson = {
      polymorphic: false,
      multiplicity: "(0..*)",
      roleLabel: "Test Target roleLabel",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    };

    const oneCustomAttributeJson = {
      polymorphic: true,
      multiplicity: "(0..1)",
      roleLabel: "Test Source roleLabel",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
      customAttributes: [
        {
          className: "CoreCustomAttributes.HiddenSchema",
          ShowClasses: true,
        },
      ],
    };
    it("async - Deserialize One Custom Attribute", async () => {
      const schema = await Schema.fromJson(createSchemaJson(oneCustomAttributeJson, targetStubJson));
      testConstraint = (await schema.getItem<RelationshipClass>("TestRelationship"))!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(oneCustomAttributeJson, targetStubJson));
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    const twoCustomAttributesJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
      name: "ValidSchema",
      polymorphic: true,
      multiplicity: "(0..1)",
      roleLabel: "Test Source roleLabel",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
      customAttributes: [
        {
          className: "CoreCustomAttributes.HiddenSchema",
        },
        {
          className: "ExampleCustomAttributes.ExampleSchema",
        },
      ],
    };
    it("async - Deserialize Two Custom Attributes", async () => {
      const schema = await Schema.fromJson(createSchemaJson(twoCustomAttributesJson, targetStubJson));
      testConstraint = (await schema.getItem<RelationshipClass>("TestRelationship"))!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint!.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testConstraint!.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(twoCustomAttributesJson, targetStubJson));
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testConstraint.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes with additional properties", () => {
      const relConstraintJson = {
        polymorphic: true,
        multiplicity: "(0..1)",
        roleLabel: "test roleLabel",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
        customAttributes: [
          {
            className: "CoreCustomAttributes.HiddenSchema",
            ShowClasses: false,
          },
          {
            className: "ExampleCustomAttributes.ExampleSchema",
            ShowClasses: true,
          },
        ],
      };
      const schema = Schema.fromJsonSync(createSchemaJson(relConstraintJson, targetStubJson));
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === false);
      assert(testConstraint.customAttributes!["ExampleCustomAttributes.ExampleSchema"].ShowClasses === true);
    });
    const mustBeAnArrayJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
      name: "InvalidSchema",
      polymorphic: true,
      multiplicity: "(0..1)",
      roleLabel: "test roleLabel",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
      customAttributes: "CoreCustomAttributes.HiddenSchema",
    };
    it("Custom Attributes must be an array", () => {
      assert.throws(() => parser.parseRelationshipConstraintProps(testConstraint.relationshipClass.name, mustBeAnArrayJson, true), ECObjectsError, `The Source Constraint of TestRelationship has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
  });
});
