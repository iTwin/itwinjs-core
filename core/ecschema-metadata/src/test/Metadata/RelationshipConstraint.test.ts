/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { RelationshipEnd } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { RelationshipClass, RelationshipConstraint } from "../../Metadata/RelationshipClass";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

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
    TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "Any" },
    TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "Any" },
    TestCAClassC: { schemaItemType: "CustomAttributeClass", appliesTo: "Any" },
  });
}

describe("RelationshipConstraint", () => {
  describe("fromJson", () => {
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
    });
    it("should throw for invalid constraintClasses", async () => {
      const json: any = {
        polymorphic: true,
        multiplicity: "(0..1)",
        roleLabel: "test roleLabel",
      };
      const unloadedConstraintClassesJson = { ...json, constraintClasses: ["ThisClassDoesNotExist"] };
      await expect(testConstraint.fromJSON(unloadedConstraintClassesJson)).to.be.rejectedWith(ECObjectsError);
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
          className: "TestSchema.TestCAClassA",
          ShowClasses: true,
        },
      ],
    };
    it("async - Deserialize One Custom Attribute", async () => {
      const schema = await Schema.fromJson(createSchemaJson(oneCustomAttributeJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem<RelationshipClass>("TestRelationship"))!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).to.exist;
      assert.isTrue(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(oneCustomAttributeJson, targetStubJson), new SchemaContext());
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).to.exist;
      assert.isTrue(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses);
    });
    const twoCustomAttributesJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ValidSchema",
      polymorphic: true,
      multiplicity: "(0..1)",
      roleLabel: "Test Source roleLabel",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
      customAttributes: [
        {
          className: "TestSchema.TestCAClassA",
        },
        {
          className: "TestSchema.TestCAClassB",
        },
      ],
    };
    it("async - Deserialize Two Custom Attributes", async () => {
      const schema = await Schema.fromJson(createSchemaJson(twoCustomAttributesJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem<RelationshipClass>("TestRelationship"))!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint!.customAttributes!.get("TestSchema.TestCAClassA")).to.exist;
      expect(testConstraint!.customAttributes!.get("TestSchema.TestCAClassB")).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(twoCustomAttributesJson, targetStubJson), new SchemaContext());
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).to.exist;
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassB")).to.exist;
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
            className: "TestSchema.TestCAClassA",
            ShowClasses: false,
          },
          {
            className: "TestSchema.TestCAClassB",
            ShowClasses: true,
          },
        ],
      };
      const schema = Schema.fromJsonSync(createSchemaJson(relConstraintJson, targetStubJson), new SchemaContext());
      testConstraint = schema.getItemSync<RelationshipClass>("TestRelationship")!.source;
      expect(testConstraint).to.exist;
      assert.isFalse(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses);
      assert.isTrue(testConstraint.customAttributes!.get("TestSchema.TestCAClassB")!.ShowClasses);
    });
  });
});
