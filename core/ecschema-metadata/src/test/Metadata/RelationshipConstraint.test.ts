/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { RelationshipEnd } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { RelationshipClass, RelationshipConstraint } from "../../Metadata/RelationshipClass";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildren, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

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
    TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "Any", properties: [
      {
        name: "ShowClasses",
        type: "PrimitiveProperty",
        typeName: "boolean",
      }]},
    TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "Any", properties: [
      {
        name: "ShowClasses",
        type: "PrimitiveProperty",
        typeName: "boolean",
      }]},
    TestCAClassC: { schemaItemType: "CustomAttributeClass", appliesTo: "Any", properties: [
      {
        name: "ShowClasses",
        type: "PrimitiveProperty",
        typeName: "boolean",
      }] },
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
      await expect(testConstraint.fromJSON(unloadedConstraintClassesJson)).rejects.toThrow(ECSchemaError);
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
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses).toBe(true);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(oneCustomAttributeJson, targetStubJson), new SchemaContext());
      testConstraint = schema.getItemSync("TestRelationship", RelationshipClass)!.source;
      expect(testConstraint).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses).toBe(true);
    });
    const twoCustomAttributesJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
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
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      expect(testConstraint!.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testConstraint!.customAttributes!.get("TestSchema.TestCAClassB")).toBeDefined();
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      const schema = Schema.fromJsonSync(createSchemaJson(twoCustomAttributesJson, targetStubJson), new SchemaContext());
      testConstraint = schema.getItemSync("TestRelationship", RelationshipClass)!.source;
      expect(testConstraint).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassB")).toBeDefined();
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
      testConstraint = schema.getItemSync("TestRelationship", RelationshipClass)!.source;
      expect(testConstraint).toBeDefined();
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassA")!.ShowClasses).toBe(false);
      expect(testConstraint.customAttributes!.get("TestSchema.TestCAClassB")!.ShowClasses).toBe(true);
    });
  });

  describe("toJson", () => {
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
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

    it("Serialize One Custom Attribute", async () => {
      const schema = await Schema.fromJson(createSchemaJson(oneCustomAttributeJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      const constraintProps = testConstraint.toJSON();
      expect(constraintProps.customAttributes![0].ShowClasses);
    });

    const twoCustomAttributesJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
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

    it("Serialize Two Custom Attributes", async () => {
      const schema = await Schema.fromJson(createSchemaJson(twoCustomAttributesJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      const constraintProps = testConstraint.toJSON();
      expect(constraintProps.customAttributes![0].className).toEqual("TestSchema.TestCAClassA");
      expect(constraintProps.customAttributes![1].className).toEqual("TestSchema.TestCAClassB");
    });

    it("Serialize Two Custom Attributes with additional properties", () => {
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
      testConstraint = schema.getItemSync("TestRelationship", RelationshipClass)!.source;
      expect(testConstraint).toBeDefined();
      const constraintProps = testConstraint.toJSON();
      expect(constraintProps.customAttributes![0].ShowClasses).toBe(false);
      expect(constraintProps.customAttributes![1].ShowClasses).toBe(true);
    });
  });

  describe("toXML", () => {
    const newDom = createEmptyXmlDocument();
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
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

    it("Serialize One Custom Attribute", async () => {
      const schema = await Schema.fromJson(createSchemaJson(oneCustomAttributeJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      const serialized = await testConstraint.toXml(newDom);
      expect(serialized.nodeName).toEqual("Source");
      expect(serialized.getAttribute("polymorphic")).toEqual("true");
      expect(serialized.getAttribute("multiplicity")).toEqual("(0..1)");
      expect(serialized.getAttribute("roleLabel")).toEqual("Test Source roleLabel");
      const children = getElementChildren(serialized);
      expect(children.length).toBe(2);

      const customAttributes = getElementChildrenByTagName(serialized, "ECCustomAttributes");
      expect(customAttributes.length).toBe(1);
      const customAttribute = getElementChildrenByTagName(customAttributes[0], "TestCAClassA");
      expect(customAttribute.length).toBe(1);
      const attribute = getElementChildrenByTagName(customAttribute[0], "ShowClasses");
      expect(attribute.length).toBe(1);
      expect(attribute[0].textContent).toEqual("True");
    });

    const twoCustomAttributesJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
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
          ShowClasses: true,
        },
        {
          className: "TestSchema.TestCAClassB",
          ShowClasses: true,
        },
      ],
    };

    it("Serialize Two Custom Attributes", async () => {
      const schema = await Schema.fromJson(createSchemaJson(twoCustomAttributesJson, targetStubJson), new SchemaContext());
      testConstraint = (await schema.getItem("TestRelationship", RelationshipClass))!.source;
      expect(testConstraint).toBeDefined();
      const serialized = await testConstraint.toXml(newDom);

      expect(serialized.nodeName).toEqual("Source");
      expect(serialized.getAttribute("polymorphic")).toEqual("true");
      expect(serialized.getAttribute("multiplicity")).toEqual("(0..1)");
      expect(serialized.getAttribute("roleLabel")).toEqual("Test Source roleLabel");
      const children = getElementChildren(serialized);
      expect(children.length).toBe(2);

      const customAttributes = getElementChildrenByTagName(serialized, "ECCustomAttributes");
      expect(customAttributes.length).toBe(1);
      const customAttribute1 = getElementChildrenByTagName(customAttributes[0], "TestCAClassA");
      expect(customAttribute1.length).toBe(1);
      const attribute1 = getElementChildrenByTagName(customAttribute1[0], "ShowClasses");
      expect(attribute1.length).toBe(1);
      expect(attribute1[0].textContent).toEqual("True");

      const customAttribute2 = getElementChildrenByTagName(customAttributes[0], "TestCAClassB");
      expect(customAttribute2.length).toBe(1);
      const attribute2 = getElementChildrenByTagName(customAttribute2[0], "ShowClasses");
      expect(attribute2.length).toBe(1);
      expect(attribute2[0].textContent).toEqual("True");
    });
  });
});
