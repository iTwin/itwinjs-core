/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { RelationshipEnd, StrengthDirection, StrengthType } from "../../ECObjects";
import { ECObjectsError } from "../../Exception";
import { CustomAttributeClass } from "../../Metadata/CustomAttributeClass";
import { EntityClass } from "../../Metadata/EntityClass";
import { Mixin } from "../../Metadata/Mixin";
import { MutableRelationshipConstraint, RelationshipClass, RelationshipConstraint, RelationshipMultiplicity } from "../../Metadata/RelationshipClass";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument, getElementChildrenByTagName } from "../TestUtils/SerializationHelper";

/* eslint-disable @typescript-eslint/naming-convention */

describe("RelationshipMultiplicity", () => {
  describe("fromString", () => {
    it("should return a static object for standard multiplicities", () => {
      // Note that since we're using .equal instead of .eql, this checks that standard multiplicities are truly static objects
      expect(RelationshipMultiplicity.fromString("(0..1)")).to.equal(RelationshipMultiplicity.zeroOne);
      expect(RelationshipMultiplicity.fromString("(0..*)")).to.equal(RelationshipMultiplicity.zeroMany);
      expect(RelationshipMultiplicity.fromString("(1..1)")).to.equal(RelationshipMultiplicity.oneOne);
      expect(RelationshipMultiplicity.fromString("(1..*)")).to.equal(RelationshipMultiplicity.oneMany);
    });

    it("should return a new object for unknown multiplicities", () => {
      const testMul = RelationshipMultiplicity.fromString("(1..5)");
      expect(testMul).to.exist;
      expect(testMul!.lowerLimit).to.equal(1);
      expect(testMul!.upperLimit).to.equal(5);
    });

    it("should return a undefined for an invalid multiplicity", () => {
      const testMul = RelationshipMultiplicity.fromString("invalid");
      expect(testMul).to.not.exist;
    });
  });
  describe("toString", () => {
    it("should successfully return standard multiplicities", () => {
      expect(RelationshipMultiplicity.zeroOne.toString()).to.equal("(0..1)");
      expect(RelationshipMultiplicity.zeroMany.toString()).to.equal("(0..*)");
      expect(RelationshipMultiplicity.oneOne.toString()).to.equal("(1..1)");
      expect(RelationshipMultiplicity.oneMany.toString()).to.equal("(1..*)");
    });
    it("should successfully roundtrip", () => {
      const testMultiplicityString = "(1..5)";
      const testMul = RelationshipMultiplicity.fromString(testMultiplicityString);
      expect(testMul).to.not.be.undefined;
      expect(testMul!.toString()).to.equal(testMultiplicityString);
    });
  });
});

describe("RelationshipClass", () => {
  describe("deserialization", () => {

    function createSchemaJson(relClassJson: any): any {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
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
      assert.isDefined(schema);

      const sourceBaseEntity = await schema.getItem<EntityClass>("SourceBaseEntity");
      assert.isDefined(sourceBaseEntity);
      const targetBaseEntity = await schema.getItem<EntityClass>("TargetBaseEntity");
      assert.isDefined(targetBaseEntity);
      const sourceEntity = await schema.getItem<EntityClass>("TestSourceEntity");
      assert.isDefined(sourceEntity);
      const targetEntity = await schema.getItem<EntityClass>("TestTargetEntity");
      assert.isDefined(targetEntity);

      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      expect(relClass!.strength).equal(StrengthType.Embedding);
      expect(relClass!.strengthDirection).equal(StrengthDirection.Backward);

      assert.isDefined(relClass!.source);
      expect(relClass!.source.polymorphic).equal(true);
      expect(relClass!.source.roleLabel).equal("Source RoleLabel");
      assert.isTrue(relClass!.source.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.source.constraintClasses);
      expect(relClass!.source.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.source.constraintClasses![0] === sourceEntity);
      assert.isDefined(relClass!.source.abstractConstraint);
      assert.isTrue(await relClass!.source.abstractConstraint === sourceBaseEntity);

      assert.isDefined(relClass!.target);
      expect(relClass!.target.polymorphic).equal(true);
      expect(relClass!.target.roleLabel).equal("Target RoleLabel");
      assert.isTrue(relClass!.target.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.target.constraintClasses);
      expect(relClass!.target.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.target.constraintClasses![0] === targetEntity);
      assert.isDefined(relClass!.target.abstractConstraint);
      assert.isTrue(await relClass!.target.abstractConstraint === targetBaseEntity);
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
      assert.isDefined(schema);

      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);

      const navProp = await relClass!.getProperty("testNavProp");
      assert.isDefined(navProp);
      assert.isTrue(navProp!.isNavigation());
      if (navProp && navProp.isNavigation()) {
        assert.isDefined(navProp.relationshipClass);
        assert.isTrue(await navProp.relationshipClass === relClass);
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
      assert.isDefined(schema);

      const relClass = schema.getItemSync<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);

      const navProp = relClass!.getPropertySync("testNavProp");
      assert.isDefined(navProp);
      assert.isTrue(navProp!.isNavigation());
      if (navProp && navProp.isNavigation()) {
        assert.isDefined(navProp.relationshipClass);
        assert.isTrue(navProp.getRelationshipClassSync() === relClass);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship is missing the required source constraint.`);
    });

    it("should throw for missing target constraint", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "forward",
        source: validConstraint,
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship is missing the required target constraint.`);
    });

    it("should throw for invalid source constraint", async () => {
      const json = createSchemaJson({
        strength: "holding",
        strengthDirection: "forward",
        source: 0,
        target: validConstraint,
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid source constraint. It should be of type 'object'.`);
    });

    it("should throw for invalid target constraint", async () => {
      const json = createSchemaJson({
        strength: "referencing",
        strengthDirection: "forward",
        source: validConstraint,
        target: 0,
      });
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid target constraint. It should be of type 'object'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'abstractConstraint' attribute. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      const expectedJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        name: "TestRelationship",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        schemaItemType: "RelationshipClass",
        ...validRelationshipJson,
      };
      expect(relClass).to.exist;
      expect(relClass!.toJSON(true, true)).to.deep.equal(expectedJson);
    });

    it("async - JSON stringify serialization of fully defined relationship", async () => {
      const schema = await Schema.fromJson(createSchemaJson(validRelationshipJson), new SchemaContext());
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      const expectedJson = {
        schemaItemType: "RelationshipClass",
        ...validRelationshipJson,
      };
      expect(relClass).to.exist;
      const json = JSON.stringify(relClass);
      const relSerialization = JSON.parse(json);
      expect(relSerialization).to.deep.equal(expectedJson);
    });

    it("should include modifier if 'None'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "None" }), new SchemaContext());
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      expect(relClass!.toJSON(true, true)).to.include({ modifier: "None" });
    });

    it("should include modifier if 'Abstract'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "Abstract" }), new SchemaContext());
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      expect(relClass!.toJSON(true, true)).to.include({ modifier: "Abstract" });
    });

    it("should include modifier if 'Sealed'", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, modifier: "Sealed" }), new SchemaContext());
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      expect(relClass!.toJSON(true, true)).to.include({ modifier: "Sealed" });
    });

    it("should omit customAttributes if empty", async () => {
      const schema = await Schema.fromJson(createSchemaJson({ ...validRelationshipJson, customAttributes: [] }), new SchemaContext());
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      expect(relClass!.toJSON(true, true)).to.not.have.property("customAttributes");
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson).to.not.have.property("customAttributes");
      expect(actualJson.source).to.not.have.property("customAttributes");
      expect(actualJson.target).to.not.have.property("customAttributes");
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson.source).to.not.have.property("abstractConstraint");
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      const actualJson = relClass!.toJSON(true, true);
      expect(actualJson.source).to.include({ abstractConstraint: "TestSchema.TestSourceEntity" });
    });

    it("sync - Serialization of fully defined relationship", async () => {
      const schemaJson = createSchemaJson(validRelationshipJson);

      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(schema);
      const relClass = schema.getItemSync<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      const relClassJson = relClass!.toJSON(true, true);
      assert.isDefined(relClassJson);
      assert.strictEqual(relClassJson.strength, "Embedding");
      assert.strictEqual(relClassJson.strengthDirection, "Backward");
      assert.strictEqual(relClassJson.modifier, "Sealed");
      assert.isTrue(relClassJson.source.polymorphic);
      assert.strictEqual(relClassJson.source.multiplicity, "(0..*)");
      assert.strictEqual(relClassJson.source.roleLabel, "Source RoleLabel");
      assert.strictEqual(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      assert.strictEqual(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      assert.isTrue(relClassJson.target.polymorphic);
      assert.strictEqual(relClassJson.target.multiplicity, "(0..*)");
      assert.strictEqual(relClassJson.target.roleLabel, "Target RoleLabel");
      assert.strictEqual(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      assert.strictEqual(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });

    it("sync - JSON stringify serialization of fully defined relationship", async () => {
      const schemaJson = createSchemaJson(validRelationshipJson);

      const schema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(schema);
      const relClass = schema.getItemSync<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      const json = JSON.stringify(relClass);
      const relClassJson = JSON.parse(json);
      assert.isDefined(relClassJson);
      assert.strictEqual(relClassJson.strength, "Embedding");
      assert.strictEqual(relClassJson.strengthDirection, "Backward");
      assert.strictEqual(relClassJson.modifier, "Sealed");
      assert.isTrue(relClassJson.source.polymorphic);
      assert.strictEqual(relClassJson.source.multiplicity, "(0..*)");
      assert.strictEqual(relClassJson.source.roleLabel, "Source RoleLabel");
      assert.strictEqual(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      assert.strictEqual(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      assert.isTrue(relClassJson.target.polymorphic);
      assert.strictEqual(relClassJson.target.multiplicity, "(0..*)");
      assert.strictEqual(relClassJson.target.roleLabel, "Target RoleLabel");
      assert.strictEqual(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      assert.strictEqual(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });
  });

  describe("toXml", () => {
    function getCustomAttribute(containerElement: Element, name: string): Element {
      const caElements = containerElement.getElementsByTagName("ECCustomAttributes");
      expect(caElements.length).to.equal(1, "Expected 1 ECCustomAttributes Element");
      const caElement = containerElement.getElementsByTagName(name);
      expect(caElement.length).to.equal(1, `Expected one CustomAttribute Element with the name '${name}`);
      return caElement[0];
    }

    function getCAPropertyValueElement(schema: Element, caName: string, propertyName: string): Element {
      const attribute = getCustomAttribute(schema, caName);
      const propArray = attribute.getElementsByTagName(propertyName);
      expect(propArray.length).to.equal(1, `Expected 1 CustomAttribute Property with the name '${propertyName}'`);
      return propArray[0];
    }

    function getSchemaJson(customAttributeJson?: any) {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      expect(relClass).to.exist;
      const serialized = await relClass!.toXml(newDom);
      expect(serialized.nodeName).to.eql("ECRelationshipClass");
      expect(serialized.getAttribute("strength")).to.eql("Embedding");
      expect(serialized.getAttribute("strengthDirection")).to.eql("Backward");

      const sourceResult = getElementChildrenByTagName(serialized, "Source");
      assert.strictEqual(sourceResult.length, 1);
      const targetResult = getElementChildrenByTagName(serialized, "Target");
      assert.strictEqual(targetResult.length, 1);

      const source = sourceResult[0];
      expect(source.getAttribute("polymorphic")).to.eql("true");
      expect(source.getAttribute("multiplicity")).to.eql("(0..*)");
      expect(source.getAttribute("roleLabel")).to.eql("Source RoleLabel");
      expect(source.getAttribute("abstractConstraint")).to.eql("SourceBaseEntity");
      const sourceConstraintClasses = getElementChildrenByTagName(source, "Class");
      assert.strictEqual(sourceConstraintClasses.length, 1);
      expect(sourceConstraintClasses[0].getAttribute("class")).to.eql("TestSourceEntity");

      const target = targetResult[0];
      expect(target.getAttribute("polymorphic")).to.eql("true");
      expect(target.getAttribute("multiplicity")).to.eql("(0..*)");
      expect(target.getAttribute("roleLabel")).to.eql("Target RoleLabel");
      expect(target.getAttribute("abstractConstraint")).to.eql("TargetBaseEntity");
      const targetConstraintClasses = getElementChildrenByTagName(target, "Class");
      assert.strictEqual(targetConstraintClasses.length, 1);
      expect(targetConstraintClasses[0].getAttribute("class")).to.eql("TestTargetEntity");
    });

    it("Serialization with one custom attribute defined in ref schema, only class name", async () => {
      const context = new SchemaContext();
      const refSchema = new Schema(context, "RefSchema", "ref", 1, 0, 5);
      const refCAClass = await (refSchema as MutableSchema).createCustomAttributeClass("TestCustomAttribute");
      assert.isDefined(refCAClass);
      await context.addSchema(refSchema);
      const testSchema = await Schema.fromJson(getSchemaJson(), new SchemaContext());
      await (testSchema as MutableSchema).addReference(refSchema);
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;
      constraint.addCustomAttribute({ className: "RefSchema.TestCustomAttribute" });
      const serialized = await constraint.toXml(newDom);

      const attributeElement = getCustomAttribute(serialized, "TestCustomAttribute");
      expect(attributeElement.getAttribute("xmlns")).to.equal("RefSchema.01.00.05");
    });

    it("Serialization with one custom attribute defined in same schema, only class name", async () => {
      const attributeJson = {
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          appliesTo: "Schema",
        },
      };
      const testSchema = await Schema.fromJson(getSchemaJson(attributeJson), new SchemaContext());
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
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
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
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
      expect(element.textContent).to.equal("True");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "FalseBoolean");
      expect(element.textContent).to.equal("False");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Integer");
      expect(element.textContent).to.equal("1");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Long");
      expect(element.textContent).to.equal("100");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Double");
      expect(element.textContent).to.equal("200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "DateTime");
      expect(element.textContent).to.equal(nowTicks.toString());
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point2D");
      expect(element.textContent).to.equal("100,200");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Point3D");
      expect(element.textContent).to.equal("100,200,300");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "IGeometry");
      expect(element.textContent).to.equal("geometry");
      element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "Binary");
      expect(element.textContent).to.equal("binary");
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
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
      const constraint = relClass.source as MutableRelationshipConstraint;

      const ca = {
        className: "TestCustomAttribute",
        BooleanArray: [true, false, true],
      };

      constraint.addCustomAttribute(ca);
      const serialized = await constraint.toXml(newDom);

      const element = getCAPropertyValueElement(serialized, "TestCustomAttribute", "BooleanArray");
      const children = element.childNodes;
      expect(children.length).to.equal(3);
      expect(children[0].textContent).to.equal("True");
      expect(children[1].textContent).to.equal("False");
      expect(children[2].textContent).to.equal("True");
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
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
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
      expect(children.length).to.equal(2);
      expect(children[0].textContent).to.equal("1");
      expect(children[1].textContent).to.equal("test");
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
      const relClass = await testSchema.getItem<RelationshipClass>("TestRelationship") as RelationshipClass;
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
      expect(structs.length).to.equal(2);

      let prop1 = structs[0].getElementsByTagName("Integer");
      expect(prop1.length).to.equal(1);
      expect(prop1[0].textContent).to.equal("1");

      let prop2 = structs[0].getElementsByTagName("String");
      expect(prop2.length).to.equal(1);
      expect(prop2[0].textContent).to.equal("test1");

      prop1 = structs[1].getElementsByTagName("Integer");
      expect(prop1.length).to.equal(1);
      expect(prop1[0].textContent).to.equal("2");

      prop2 = structs[1].getElementsByTagName("String");
      expect(prop2.length).to.equal(1);
      expect(prop2[0].textContent).to.equal("test2");
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

      before(async () => {
        schema = await Schema.fromJson(createSchemaJson(), new SchemaContext());
        assert.isDefined(schema);
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
        sinon.restore();
      });

      it("unsupported constraint class type, returns false", async () => {
        const classCompatibleWithConstraint = sinon.spy(RelationshipConstraint, "classCompatibleWithConstraint");
        const testClass = new CustomAttributeClass(schema, "TestCA");
        expect(await vehicleOwner!.source.supportsClass(testClass)).to.be.false;
        expect(classCompatibleWithConstraint.notCalled).to.be.true;
      });

      it("constraint has no constraint classes, supported constraint class, base constraint supportsClass returns true", async () => {
        const baseSupportsClass = sinon.spy(vehicleOwner.source, "supportsClass");
        expect(await childVehicleOwner!.source.supportsClass(ford)).to.be.true;
        expect(baseSupportsClass.calledOnce).to.be.true;
      });

      it("child constraint has no constraint classes, parent constraint has no constraint classes, base constraint supportsClass returns true", async () => {
        const baseSupportsClass = sinon.spy(vehicleOwner.source, "supportsClass");
        const parentSupportsClass = sinon.spy(childVehicleOwner.source, "supportsClass");
        expect(await grandChildVehicleOwner!.source.supportsClass(ford)).to.be.true;
        expect(parentSupportsClass.calledOnce).to.be.true;
        expect(baseSupportsClass.calledOnce).to.be.true;
      });

      it("constraint has no constraint classes, unsupported constraint class, base constraint supportsClass returns false", async () => {
        const baseSupportsClass = sinon.spy(vehicleOwner.source, "supportsClass");
        const testClass = new CustomAttributeClass(schema, "TestCA");
        expect(await childVehicleOwner!.source.supportsClass(testClass)).to.be.false;
        expect(baseSupportsClass.calledOnce).to.be.true;
      });

      it("EntityClass, classCompatibleWithConstraint called", async () => {
        const classCompatibleWithConstraint = sinon.spy(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(vehicle)).to.be.true;
        expect(classCompatibleWithConstraint.called).to.be.true;
      });

      it("RelationshipClass, classCompatibleWithConstraint called", async () => {
        const classCompatibleWithConstraint = sinon.spy(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(new RelationshipClass(schema, "TestRelationship"))).to.be.false;
        expect(classCompatibleWithConstraint.called).to.be.true;
      });

      it("MixinClass, classCompatibleWithConstraint called", async () => {
        const mixin = new Mixin(schema, "TestMixin");
        const entity = new EntityClass(schema, "TestEntity");
        const promise = new DelayedPromiseWithProps(entity.key, async () => entity);
        sinon.stub(Mixin.prototype, "appliesTo").get(() => promise);
        const classCompatibleWithConstraint = sinon.spy(RelationshipConstraint, "classCompatibleWithConstraint");
        expect(await vehicleOwner!.source.supportsClass(mixin)).to.be.false;
        expect(classCompatibleWithConstraint.called).to.be.true;
      });

      it("supported constraint class, returns true", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(ford)).to.be.true;
        expect(await americanVehicleOwner!.source.supportsClass(chevy)).to.be.true;
      });

      it("unsupported constraint class, returns false", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(honda)).to.be.false;
      });

      it("valid polymorphic constraints, returns true", async () => {
        expect(await vehicleOwner!.source.supportsClass(chevy)).to.be.true;
        expect(await vehicleOwner!.source.supportsClass(ford)).to.be.true;
        expect(await vehicleOwner!.source.supportsClass(honda)).to.be.true;
      });

      it("not a polymorphic constraint, child class, returns false", async () => {
        expect(await americanVehicleOwner!.source.supportsClass(f150)).to.be.false;
      });

      it("no restraint classes, returns false", async () => {
        const classCompatibleWithConstraint = sinon.spy(RelationshipConstraint, "classCompatibleWithConstraint");
        const relationship = new RelationshipClass(schema, "TestRelationship");
        const constraint = new RelationshipConstraint(relationship, RelationshipEnd.Source);
        expect(await constraint.supportsClass(new EntityClass(schema, "TestEntity"))).to.be.false;
        expect(classCompatibleWithConstraint.called).to.be.false;
      });

      it("mixin class derives from mixin constraint, returns true", async () => {
        expect(await iAmericanVehicleOwner!.source.supportsClass(iFord)).to.be.true;
      });

      it("mixin class does not derive from mixin constraint, returns false", async () => {
        const iOwner = schema.getItemSync("IOwner") as Mixin;
        expect(await iAmericanVehicleOwner!.source.supportsClass(iOwner)).to.be.false;
      });

      it("mixin class applies to constraint class, returns true", async () => {
        expect(await vehicleOwner!.source.supportsClass(iFord)).to.be.true;
      });

      it("mixin class does not apply to constraint class, returns false", async () => {
        const iOwner = schema.getItemSync("IOwner") as Mixin;
        expect(await vehicleOwner!.source.supportsClass(iOwner)).to.be.false;
      });
    });
  });
});
