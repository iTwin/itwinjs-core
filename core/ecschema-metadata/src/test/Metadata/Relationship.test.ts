/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { RelationshipEnd, StrengthDirection, StrengthType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { expectAsyncToThrow } from "../TestUtils/AssertionHelpers";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass";
import { EntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { MutableRelationshipConstraint, RelationshipClass, RelationshipConstraint, RelationshipMultiplicity } from "../../Metadata/RelationshipClass";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("RelationshipMultiplicity", () => {
  describe("fromString", () => {
    it("should return a static object for standard multiplicities", () => {
      // Note that since we're using .equal instead of .eql, this checks that standard multiplicities are truly static objects
      expect(RelationshipMultiplicity.fromString("(0..1)")).toEqual(RelationshipMultiplicity.zeroOne);
      expect(RelationshipMultiplicity.fromString("(0..*)")).toEqual(RelationshipMultiplicity.zeroMany);
      expect(RelationshipMultiplicity.fromString("(1..1)")).toEqual(RelationshipMultiplicity.oneOne);
      expect(RelationshipMultiplicity.fromString("(1..*)")).toEqual(RelationshipMultiplicity.oneMany);
    });

    it("should return a new object for unknown multiplicities", () => {
      const testMul = RelationshipMultiplicity.fromString("(1..5)");
      expect(testMul).toBeDefined();
      expect(testMul!.lowerLimit).toEqual(1);
      expect(testMul!.upperLimit).toEqual(5);
    });

    it("should return a undefined for an invalid multiplicity", () => {
      const testMul = RelationshipMultiplicity.fromString("invalid");
      expect(testMul).toBeUndefined();
    });
  });
  describe("toString", () => {
    it("should successfully return standard multiplicities", () => {
      expect(RelationshipMultiplicity.zeroOne.toString()).toEqual("(0..1)");
      expect(RelationshipMultiplicity.zeroMany.toString()).toEqual("(0..*)");
      expect(RelationshipMultiplicity.oneOne.toString()).toEqual("(1..1)");
      expect(RelationshipMultiplicity.oneMany.toString()).toEqual("(1..*)");
    });
    it("should successfully roundtrip", () => {
      const testMultiplicityString = "(1..5)";
      const testMul = RelationshipMultiplicity.fromString(testMultiplicityString);
      expect(testMul).toBeDefined();
      expect(testMul!.toString()).toEqual(testMultiplicityString);
    });
  });
});

describe("RelationshipClass", () => {
  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
      TestRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "Embedding",
        strengthDirection: "Backward",
        modifier: "Sealed",
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
        target: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
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

    const schema = await Schema.fromJson(schemaJson, new SchemaContext());
    expect(schema);
    const relClass = await schema.getItem("TestRelationship", RelationshipClass);
    expect(relClass);
    expect(relClass!.fullName).toEqual("TestSchema.TestRelationship");
  });

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestRelationshipClass: {
        schemaItemType: "RelationshipClass",
        label: "Test Relationship Class",
        description: "Used for testing",
        strength: "referencing",
        strengthDirection: "forward",
        source: {
          multiplicity: "(0..*)",
          roleLabel: "source role",
          polymorphic: true,
          constraintClasses: ["TestSchema.SourceEntityClass"],
        },
        target: {
          multiplicity: "(0..*)",
          roleLabel: "target role",
          polymorphic: true,
          constraintClasses: ["TestSchema.TargetEntityClass"],
        },
      },
      SourceEntityClass: {
        schemaItemType: "EntityClass",
        label: "Source Entity Class",
        description: "Used for testing",
        modifier: "Sealed",
      },
      TargetEntityClass: {
        schemaItemType: "EntityClass",
        label: "Target Entity Class",
        description: "Used for testing",
        modifier: "Sealed",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    beforeEach(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      expect(ecSchema).toBeDefined();
    });

    it("typeguard and type assertion should work on RelationshipClass", async () => {
      const testRelationshipClass = await ecSchema.getItem("TestRelationshipClass");
      expect(testRelationshipClass).toBeDefined();
      expect(RelationshipClass.isRelationshipClass(testRelationshipClass)).toBe(true);
      expect(() => RelationshipClass.assertIsRelationshipClass(testRelationshipClass)).not.toThrow();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      expect(testPhenomenon).toBeDefined();
      expect(RelationshipClass.isRelationshipClass(testPhenomenon)).toBe(false);
      expect(() => RelationshipClass.assertIsRelationshipClass(testPhenomenon)).toThrow();
    });

    it("RelationshipClass type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestRelationshipClass", RelationshipClass)).toBeInstanceOf(RelationshipClass);
      expect(ecSchema.getItemSync("TestRelationshipClass", RelationshipClass)).toBeInstanceOf(RelationshipClass);
    });

    it("RelationshipClass type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", RelationshipClass)).toBeUndefined();
      expect(ecSchema.getItemSync("TestPhenomenon", RelationshipClass)).toBeUndefined();
    });
  });

  describe("deserialization", () => {

    function createSchemaJson(relClassJson: any): any {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            ...relClassJson,
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
        },
      };
    }

    it("should succeed with fully defined relationship", async () => {
      const schemaJson = createSchemaJson({
        strength: "Embedding",
        strengthDirection: "Backward",
        modifier: "Sealed",
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
        target: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        },
      });

      const schema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(schema);

      const sourceBaseEntity = await schema.getItem("SourceBaseEntity", EntityClass);
      expect(sourceBaseEntity);
      const targetBaseEntity = await schema.getItem("TargetBaseEntity", EntityClass);
      expect(targetBaseEntity);
      const sourceEntity = await schema.getItem("TestSourceEntity", EntityClass);
      expect(sourceEntity);
      const targetEntity = await schema.getItem("TestTargetEntity", EntityClass);
      expect(targetEntity);

      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass);
      expect(relClass!.strength).equal(StrengthType.Embedding);
      expect(relClass!.strengthDirection).equal(StrengthDirection.Backward);

      expect(relClass!.source);
      expect(relClass!.source.polymorphic).equal(true);
      expect(relClass!.source.roleLabel).equal("Source RoleLabel");
      expect(relClass!.source.multiplicity.equals(RelationshipMultiplicity.zeroMany));
      expect(relClass!.source.constraintClasses);
      expect(relClass!.source.constraintClasses!.length).equal(1);
      expect(await relClass!.source.constraintClasses![0] === sourceEntity);
      expect(relClass!.source.abstractConstraint);
      expect(await relClass!.source.abstractConstraint === sourceBaseEntity);

      expect(relClass!.target);
      expect(relClass!.target.polymorphic).equal(true);
      expect(relClass!.target.roleLabel).equal("Target RoleLabel");
      expect(relClass!.target.multiplicity.equals(RelationshipMultiplicity.zeroMany));
      expect(relClass!.target.constraintClasses);
      expect(relClass!.target.constraintClasses!.length).equal(1);
      expect(await relClass!.target.constraintClasses![0] === targetEntity);
      expect(relClass!.target.abstractConstraint);
      expect(await relClass!.target.abstractConstraint === targetBaseEntity);
    });

    it("should succeed with navigation property", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "backward",
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
        target: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        },
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.TestRelationship",
            direction: "backward",
          },
        ],
      });
      const schema = await Schema.fromJson(json, new SchemaContext());
      expect(schema);

      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass);

      const navProp = await relClass!.getProperty("testNavProp");
      expect(navProp);
      expect(navProp!.isNavigation());
      if (navProp && navProp.isNavigation()) {
        expect(navProp.relationshipClass);
        expect(await navProp.relationshipClass === relClass);
      }
    });

    it("should succeed with navigation property synchronously", () => {
      const json = createSchemaJson({
        strength: "referencing",
        strengthDirection: "forward",
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
        target: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        },
        properties: [
          {
            type: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.TestRelationship",
            direction: "backward",
          },
        ],
      });
      const schema = Schema.fromJsonSync(json, new SchemaContext());
      expect(schema);

      const relClass = schema.getItemSync("TestRelationship", RelationshipClass);
      expect(relClass);

      const navProp = relClass!.getPropertySync("testNavProp");
      expect(navProp);
      expect(navProp!.isNavigation());
      if (navProp && navProp.isNavigation()) {
        expect(navProp.relationshipClass);
        expect(navProp.getRelationshipClassSync() === relClass);
      }
    });

    const validConstraint = {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "owns",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
    };

    it("should throw for missing source constraint", async () => {
      const json = createSchemaJson({
        strength: "holding",
        strengthDirection: "backward",
        target: validConstraint,
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The RelationshipClass TestSchema.TestRelationship is missing the required source constraint.`,
      );
    });

    it("should throw for missing target constraint", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "forward",
        source: validConstraint,
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The RelationshipClass TestSchema.TestRelationship is missing the required target constraint.`,
      );
    });

    it("should throw for invalid source constraint", async () => {
      const json = createSchemaJson({
        strength: "holding",
        strengthDirection: "forward",
        source: 0,
        target: validConstraint,
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The RelationshipClass TestSchema.TestRelationship has an invalid source constraint. It should be of type 'object'.`,
      );
    });

    it("should throw for invalid target constraint", async () => {
      const json = createSchemaJson({
        strength: "referencing",
        strengthDirection: "forward",
        source: validConstraint,
        target: 0,
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The RelationshipClass TestSchema.TestRelationship has an invalid target constraint. It should be of type 'object'.`,
      );
    });

    it("should throw for invalid abstractConstraint", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "forward",
        source: {
          polymorphic: true,
          multiplicity: "(0..1)",
          roleLabel: "Source roleLabel",
          abstractConstraint: 0,
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        },
        target: {},
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The Source Constraint of TestSchema.TestRelationship has an invalid 'abstractConstraint' attribute. It should be of type 'string'.`,
      );
    });

    it("should throw for invalid constraintClasses", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "forward",
        source: {
          polymorphic: true,
          multiplicity: "(0..1)",
          roleLabel: "Source roleLabel",
          constraintClasses: 0,
        },
        target: {},
      });
      await expectAsyncToThrow(
        async () => Schema.fromJson(json, new SchemaContext()),
        ECSchemaError,
        `The Source Constraint of TestSchema.TestRelationship has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`,
      );
    });
  });

  describe("fromJson", () => {
    it("TODO", async () => {
      // TODO: Implement test...
    });
  });

  describe("toJson", () => {
    function createSchemaJson(relClassJson: any): any {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            ...relClassJson,
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
        },
      };
    }

    const validRelationshipJson = {
      strength: "Embedding",
      strengthDirection: "Backward",
      modifier: "Sealed",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TestSchema.SourceBaseEntity",
        constraintClasses: [
          "TestSchema.TestSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TestSchema.TargetBaseEntity",
        constraintClasses: [
          "TestSchema.TestTargetEntity",
        ],
      },
    };

    it("async - Serialization of fully defined relationship", async () => {
      const schema = await Schema.fromJson(createSchemaJson(validRelationshipJson), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        name: "TestRelationship",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        schemaItemType: "RelationshipClass",
        ...validRelationshipJson,
      };
      expect(relClass).toBeDefined();
      expect(relClass!.toJSON(true, true)).toEqual(expectedJson);
    });

    it("async - JSON stringify serialization of fully defined relationship", async () => {
      const schema = await Schema.fromJson(createSchemaJson(validRelationshipJson), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      const expectedJson = {
        schemaItemType: "RelationshipClass",
        ...validRelationshipJson,
      };
      expect(relClass).toBeDefined();
      const json = JSON.stringify(relClass);
      const relSerialization = JSON.parse(json);
      expect(relSerialization).toEqual(expectedJson);
    });

    it("should include modifier if 'None'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "None" }), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      expect(relClass!.toJSON(true, true)).toMatchObject({ modifier: "None" });
    });

    it("should include modifier if 'Abstract'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "Abstract" }), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      expect(relClass!.toJSON(true, true)).toMatchObject({ modifier: "Abstract" });
    });

    it("should include modifier if 'Sealed'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "Sealed" }), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      expect(relClass!.toJSON(true, true)).toMatchObject({ modifier: "Sealed" });
    });

    it("should omit customAttributes if empty", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, customAttributes: [] }), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      expect(relClass!.toJSON(true, true)).not.toHaveProperty("customAttributes");
    });

    it("should omit constraint customAttributes if empty", async () => {
      const relClassJson = {
        ...validRelationshipJson,
        customAttributes: [],
        source: {
          ...validRelationshipJson.source,
          customAttributes: [],
        },
        target: {
          ...validRelationshipJson.target,
          customAttributes: [],
        },
      };
      const schema = await Schema.fromJson(createSchemaJson(relClassJson), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson).not.toHaveProperty("customAttributes");
      expect(actualJson.source).not.toHaveProperty("customAttributes");
      expect(actualJson.target).not.toHaveProperty("customAttributes");
    });

    it("should omit implicit abstractConstraint", async () => {
      const relClassJson = {
        ...validRelationshipJson,
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
      };
      const schema = await Schema.fromJson(createSchemaJson(relClassJson), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson.source).not.toHaveProperty("abstractConstraint");
    });

    it("should include explicit abstractConstraint", async () => {
      const relClassJson = {
        ...validRelationshipJson,
        source: {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.TestSourceEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        },
      };
      const schema = await Schema.fromJson(createSchemaJson(relClassJson), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson.source).toMatchObject({ abstractConstraint: "TestSchema.TestSourceEntity" });
    });

    it("sync - Serialization of fully defined relationship", async () => {
      const schemaJson = createSchemaJson(validRelationshipJson);

      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      expect(schema);
      const relClass = schema.getItemSync("TestRelationship", RelationshipClass);
      expect(relClass);
      const relClassJson = relClass!.toJSON(true, true);
      expect(relClassJson);
      expect(relClassJson.strength, "Embedding");
      expect(relClassJson.strengthDirection, "Backward");
      expect(relClassJson.modifier, "Sealed");
      expect(relClassJson.source.polymorphic);
      expect(relClassJson.source.multiplicity, "(0..*)");
      expect(relClassJson.source.roleLabel, "Source RoleLabel");
      expect(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      expect(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      expect(relClassJson.target.polymorphic);
      expect(relClassJson.target.multiplicity, "(0..*)");
      expect(relClassJson.target.roleLabel, "Target RoleLabel");
      expect(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      expect(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });

    it("sync - JSON stringify serialization of fully defined relationship", async () => {
      const schemaJson = createSchemaJson(validRelationshipJson);

      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      expect(schema);
      const relClass = schema.getItemSync("TestRelationship", RelationshipClass);
      expect(relClass);
      const json = JSON.stringify(relClass);
      const relClassJson = JSON.parse(json);
      expect(relClassJson);
      expect(relClassJson.strength, "Embedding");
      expect(relClassJson.strengthDirection, "Backward");
      expect(relClassJson.modifier, "Sealed");
      expect(relClassJson.source.polymorphic);
      expect(relClassJson.source.multiplicity, "(0..*)");
      expect(relClassJson.source.roleLabel, "Source RoleLabel");
      expect(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      expect(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      expect(relClassJson.target.polymorphic);
      expect(relClassJson.target.multiplicity, "(0..*)");
      expect(relClassJson.target.roleLabel, "Target RoleLabel");
      expect(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      expect(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });
  });

  describe("toXml", () => {
    function getCustomAttribute(containerElement: Element, name: string): Element {
      const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
      expect(caElements.length).toBe(1);
      const caElement = containerElement.getElementsByTagName(name);
      expect(caElement.length).toBe(1);
      return caElement[0];
    }

    function getCAPropertyValueElement(schema: Element, caName: string, propertyName: string): Element {
      const attribute = getCustomAttribute(schema, caName);
      const propArray = attribute.getElementsByTagName(propertyName);
      expect(propArray.length).toBe(1);
      return propArray[0];
    }

    function getSchemaJson(customAttributeJson?: any) {
      return {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          ...customAttributeJson,
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Backward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              abstractConstraint: "TestSchema.SourceBaseEntity",
              constraintClasses: [
                "TestSchema.TestSourceEntity",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              abstractConstraint: "TestSchema.TargetBaseEntity",
              constraintClasses: [
                "TestSchema.TestTargetEntity",
              ],
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
        },
      };
    }

    const newDom = createEmptyXmlDocument();

    it("should properly serialize", async () => {
      const schema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      const relClass = await schema.getItem("TestRelationship", RelationshipClass);
      expect(relClass).toBeDefined();
      const serialized = await relClass!.toXml(newDom);
      expect(serialized.nodeName).toEqual("ECRelationshipClass");
      expect(serialized.getAttribute("strength")).toEqual("Embedding");
      expect(serialized.getAttribute("strengthDirection")).toEqual("Backward");

      const sourceResult = getElementChildrenByTagName(serialized, "Source");
      expect(sourceResult.length).toBe(1);
      const targetResult = getElementChildrenByTagName(serialized, "Target");
      expect(targetResult.length).toBe(1);

      const source = sourceResult[0];
      expect(source.getAttribute("polymorphic")).toEqual("true");
      expect(source.getAttribute("multiplicity")).toEqual("(0..*)");
      expect(source.getAttribute("roleLabel")).toEqual("Source RoleLabel");
      expect(source.getAttribute("abstractConstraint")).toEqual("SourceBaseEntity");
      const sourceConstraintClasses = getElementChildrenByTagName(source, "Class");
      expect(sourceConstraintClasses.length).toBe(1);
      expect(sourceConstraintClasses[0].getAttribute("class")).toEqual("TestSourceEntity");

      const target = targetResult[0];
      expect(target.getAttribute("polymorphic")).toEqual("true");
      expect(target.getAttribute("multiplicity")).toEqual("(0..*)");
      expect(target.getAttribute("roleLabel")).toEqual("Target RoleLabel");
      expect(target.getAttribute("abstractConstraint")).toEqual("TargetBaseEntity");
      const targetConstraintClasses = getElementChildrenByTagName(target, "Class");
      expect(targetConstraintClasses.length).toBe(1);
      expect(targetConstraintClasses[0].getAttribute("class")).toEqual("TestTargetEntity");
    });

    it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      expect(refCAClass);
      await context.addSchema(refSchema);
      const testSchema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      await (testSchema as MutableSchema).addReference(refSchema);
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;
      constraint.addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
      const serialized = await constraint.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).toEqual("RefSchema.01.00.05");
    });

    it("Serialization with one custom attribute defined in same schema, only class name", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
        },
      };
      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;
      constraint.addCustomAttribute({ className: "TestCustomAttribute" });
      const serialized = await constraint.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).to.be.empty;
    });

    it("Serialization with one custom attribute, with Primitive property values", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "boolean",
              name: "TrueBoolean",
            },
            {
              type: "PrimitiveProperty",
              typeName: "boolean",
              name: "FalseBoolean",
            },
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "long",
              name: "Long",
            },
            {
              type: "PrimitiveProperty",
              typeName: "double",
              name: "Double",
            },
            {
              type: "PrimitiveProperty",
              typeName: "dateTime",
              name: "DateTime",
            },
            {
              type: "PrimitiveProperty",
              typeName: "point2d",
              name: "Point2D",
            },
            {
              type: "PrimitiveProperty",
              typeName: "point3d",
              name: "Point3D",
            },
            {
              type: "PrimitiveProperty",
              typeName: "Bentley.Geometry.Common.IGeometry",
              name: "IGeometry",
            },
            {
              type: "PrimitiveProperty",
              typeName: "binary",
              name: "Binary",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;

      const nowTicks = Date.now();
      const ca = {
        className: "TestCustomAttribute",
        TrueBoolean: true,
        FalseBoolean: false,
        Integer: 1,
        Long: 100,
        Double: 200,
        DateTime: new Date(nowTicks),
        Point2D: { x: 100, y: 200 },
        Point3D: { x: 100, y: 200, z: 300 },
        IGeometry: "geometry",
        Binary: "binary",
      };

      constraint.addCustomAttribute(ca);
      const serialized = await constraint.toXml(newDom);

      let element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "TrueBoolean");
      expect(element.textContent).toEqual("True");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
      expect(element.textContent).toEqual("False");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
      expect(element.textContent).toEqual("1");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
      expect(element.textContent).toEqual("100");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
      expect(element.textContent).toEqual("200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
      expect(element.textContent).toEqual(nowTicks.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
      expect(element.textContent).toEqual("100,200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
      expect(element.textContent).toEqual("100,200,300");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
      expect(element.textContent).toEqual("geometry");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
      expect(element.textContent).toEqual("binary");
    });

    it("Serialization with one custom attribute, with PrimitiveArray property values", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "PrimitiveArrayProperty",
              typeName: "boolean",
              name: "BooleanArray",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;

      const ca = {
        className: "TestCustomAttribute",
        BooleanArray: [true, false, true],
      };

      constraint.addCustomAttribute(ca);
      const serialized = await constraint.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "BooleanArray");
      const children = element.childNodes;
      expect(children.length).toEqual(3);
      expect(children[0].textContent).toEqual("True");
      expect(children[1].textContent).toEqual("False");
      expect(children[2].textContent).toEqual("True");
    });

    it("Serialization with one custom attribute, with Struct property value", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "StructProperty",
              typeName: "TestSchema.TestStruct",
              name: "Struct",
            },
          ],
        },
        TestStruct: {
          schemaItemType: "StructClass",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "String",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;

      const ca = {
        className: "TestCustomAttribute",
        Struct: {
          Integer: 1,
          String: "test",
        },
      };

      constraint.addCustomAttribute(ca);
      const serialized = await constraint.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Struct");
      const children = element.childNodes;
      expect(children.length).toEqual(2);
      expect(children[0].textContent).toEqual("1");
      expect(children[1].textContent).toEqual("test");
    });

    it("Serialization with one custom attribute, with StructArray property value", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
          properties: [
            {
              type: "StructArrayProperty",
              typeName: "TestSchema.TestStruct",
              name: "StructArray",
            },
          ],
        },
        TestStruct: {
          schemaItemType: "StructClass",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "int",
              name: "Integer",
            },
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "String",
            },
          ],
        },
      };

      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem("TestRelationship", RelationshipClass) as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;

      const ca = {
        className: "TestCustomAttribute",
        StructArray: [
          {
            Integer: 1,
            String: "test1",
          },
          {
            Integer: 2,
            String: "test2",
          },
        ],
      };

      constraint.addCustomAttribute(ca);
      const serialized = await constraint.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "StructArray");
      const structs = element.getElementsByTagName("TestStruct");
      expect(structs.length).toEqual(2);

      let prop1 = structs[0].getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("1");

      let prop2 = structs[0].getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test1");

      prop1 = structs[1].getElementsByTagName("Integer");
      expect(prop1.length).toEqual(1);
      expect(prop1[0].textContent).toEqual("2");

      prop2 = structs[1].getElementsByTagName("String");
      expect(prop2.length).toEqual(1);
      expect(prop2[0].textContent).toEqual("test2");
    });
  });

  describe("validation", () => {
    let schema: Schema;

    describe("supportsClass method tests", () => {
      let vehicleOwner: RelationshipClass;
      let childVehicleOwner: RelationshipClass;
      let grandChildVehicleOwner: RelationshipClass;
      let americanVehicleOwner: RelationshipClass;
      let iAmericanVehicleOwner: RelationshipClass;
      let vehicle: EntityClass;
      let chevy: EntityClass;
      let ford: EntityClass;
      let f150: EntityClass;
      let honda: EntityClass;
      let iFord: Mixin;

      function createSchemaJson() {
        return createSchemaJsonWithItems({
          VehicleOwner: {
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [
                "TestSchema.Vehicle",
                "TestSchema.IVehicle",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [
                "TestSchema.Owner",
              ],
            },
          },
          IVehicleOwner: {
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [
                "TestSchema.IVehicle",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [
                "TestSchema.Owner",
              ],
            },
          },
          AmericanVehicleOwner: {
            baseClass: "TestSchema.VehicleOwner",
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: false,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [
                "TestSchema.Ford",
                "TestSchema.Chevy",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [
                "TestSchema.Owner",
              ],
            },
          },
          IAmericanVehicleOwner: {
            baseClass: "TestSchema.IVehicleOwner",
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [
                "TestSchema.IFord",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [
                "TestSchema.Owner",
              ],
            },
          },
          ChildVehicleOwner: {
            baseClass: "TestSchema.VehicleOwner",
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: false,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [],
            },
          },
          GrandChildVehicleOwner: {
            baseClass: "TestSchema.ChildVehicleOwner",
            schemaItemType: "RelationshipClass",
            strength: "referencing",
            strengthDirection: "forward",
            source: {
              polymorphic: false,
              multiplicity: "(0..*)",
              roleLabel: "Vehicle belongs to owner",
              constraintClasses: [],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Owner owns vehicle",
              constraintClasses: [],
            },
          },
          Vehicle: {
            schemaItemType: "EntityClass",
          },
          IVehicle: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.Vehicle",
          },
          IChildVehicle: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.Vehicle",
          },
          Honda: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Vehicle",
          },
          Ford: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Vehicle",
          },
          IFord: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.Vehicle",
            baseClass: "TestSchema.IVehicle",
          },
          Chevy: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Vehicle",
          },
          F150: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Ford",
          },
          Owner: {
            schemaItemType: "EntityClass",
          },
          IOwner: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.Owner",
          },
        });
      }

      beforeEach(async () => {
        schema = await Schema.fromJson(createSchemaJson(), new SchemaContext());
        expect(schema).toBeDefined();
        vehicleOwner = schema.getItemSync("VehicleOwner") as RelationshipClass;
        iAmericanVehicleOwner = schema.getItemSync("IVehicleOwner") as RelationshipClass;
        childVehicleOwner = schema.getItemSync("ChildVehicleOwner") as RelationshipClass;
        grandChildVehicleOwner = schema.getItemSync("GrandChildVehicleOwner") as RelationshipClass;
        americanVehicleOwner = schema.getItemSync("AmericanVehicleOwner") as RelationshipClass;
        vehicle = schema.getItemSync("Vehicle") as EntityClass;
        chevy = schema.getItemSync("Chevy") as EntityClass;
        ford = schema.getItemSync("Ford") as EntityClass;
        f150 = schema.getItemSync("F150") as EntityClass;
        honda = schema.getItemSync("Honda") as EntityClass;
        iFord = schema.getItemSync("IFord") as Mixin;
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("unsupported constraint class type, returns false", async () => {
        const classCompatibleWithConstraint = vi.spyOn(RelationshipConstraint, "classCompatibleWithConstraint");
        const testClass = new CustomAttributeClass(schema, "TestCA");
        expect(await vehicleOwner!.source.supportsClass(testClass)).toBe(false);
        expect(classCompatibleWithConstraint).not.toHaveBeenCalled();
      });

      it("constraint has no constraint classes, supported constraint class, base constraint supportsClass returns true", async () => {
        const baseSupportsClass = vi.spyOn(vehicleOwner.source, "supportsClass");
        expect(await childVehicleOwner!.source.supportsClass(ford)).toBe(true);
        expect(baseSupportsClass).toHaveBeenCalledTimes(1);
      });

      it("child constraint has no constraint classes, parent constraint has no constraint classes, base constraint supportsClass returns true", async () => {
        const baseSupportsClass = vi.spyOn(vehicleOwner.source, "supportsClass");
        const parentSupportsClass = vi.spyOn(childVehicleOwner.source, "supportsClass");
        expect(await grandChildVehicleOwner!.source.supportsClass(ford)).toBe(true);
        expect(parentSupportsClass).toHaveBeenCalledTimes(1);
        expect(baseSupportsClass).toHaveBeenCalledTimes(1);
      });

      it("constraint has no constraint classes, unsupported constraint class, base constraint supportsClass returns false", async () => {
        const baseSupportsClass = vi.spyOn(vehicleOwner.source, "supportsClass");
        const testClass = new CustomAttributeClass(schema, "TestCA");
        expect(await childVehicleOwner!.source.supportsClass(testClass)).toBe(false);
        expect(baseSupportsClass).toHaveBeenCalledTimes(1);
      });

      it("EntityClass, classCompatibleWithConstraint called", async () => {
        const classCompatibleWithConstraint = vi.spyOn(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(vehicle)).toBe(true);
        expect(classCompatibleWithConstraint).toHaveBeenCalled();
      });

      it("RelationshipClass, classCompatibleWithConstraint called", async () => {
        const classCompatibleWithConstraint = vi.spyOn(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(new RelationshipClass(schema, "TestRelationship"))).toBe(false);
        expect(classCompatibleWithConstraint).toHaveBeenCalled();
      });

      it("MixinClass, classCompatibleWithConstraint called", async () => {
        const mixin = new Mixin(schema, "TestMixin");
        const entity = new EntityClass(schema, "TestEntity");
        const promise = new DelayedPromiseWithProps(entity.key, async () => entity);
        vi.spyOn(Mixin.prototype, "appliesTo", "get").mockReturnValue(promise);
        const classCompatibleWithConstraint = vi.spyOn(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(mixin)).toBe(false);
        expect(classCompatibleWithConstraint).toHaveBeenCalled();
      });

      it("supported constraint class, returns true", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(ford)).toBe(true);
        expect(await americanVehicleOwner!.source.supportsClass(chevy)).toBe(true);
      });

      it("unsupported constraint class, returns false", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(honda)).toBe(false);
      });

      it("valid polymorphic constraints, returns true", async () => {
        expect(await vehicleOwner!.source.supportsClass(chevy)).toBe(true);
        expect(await vehicleOwner!.source.supportsClass(ford)).toBe(true);
        expect(await vehicleOwner!.source.supportsClass(honda)).toBe(true);
      });

      it("not a polymorphic constraint, child class, returns false", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(f150)).toBe(false);
      });

      it("no restraint classes, returns false", async () => {
        const classCompatibleWithConstraint = vi.spyOn(RelationshipConstraint, "classCompatibleWithConstraint");
        const relationship = new RelationshipClass(schema, "TestRelationship");
        const constraint = new RelationshipConstraint(relationship, RelationshipEnd.Source);
        expect(await constraint.supportsClass(new EntityClass(schema, "TestEntity"))).toBe(false);
        expect(classCompatibleWithConstraint).not.toHaveBeenCalled();
      });

      it("mixin class derives from mixin constraint, returns true", async () => {
        expect(await iAmericanVehicleOwner!.source.supportsClass(iFord)).toBe(true);
      });

      it("mixin class does not derive from mixin constraint, returns false", async () => {
        const iOwner = schema.getItemSync("IOwner") as Mixin;
        expect(await iAmericanVehicleOwner!.source.supportsClass(iOwner)).toBe(false);
      });

      it("mixin class applies to constraint class, returns true", async () => {
        expect(await vehicleOwner!.source.supportsClass(iFord)).toBe(true);
      });

      it("mixin class does not apply to constraint class, returns false", async () => {
        const iOwner = schema.getItemSync("IOwner") as Mixin;
        expect(await vehicleOwner!.source.supportsClass(iOwner)).toBe(false);
      });
    });
  });
});
