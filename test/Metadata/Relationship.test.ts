/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import RelationshipClass from "../../source/Metadata/RelationshipClass";
import { RelationshipMultiplicity, StrengthType, StrengthDirection } from "../../source/ECObjects";
import { ECObjectsError } from "../../source/Exception";

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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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

      const schema = await Schema.fromJson(schemaJson);
      assert.isDefined(schema);

      const sourceBaseEntity = await schema.getClass<EntityClass>("SourceBaseEntity");
      assert.isDefined(sourceBaseEntity);
      const targetBaseEntity = await schema.getClass<EntityClass>("TargetBaseEntity");
      assert.isDefined(targetBaseEntity);
      const sourceEntity = await schema.getClass<EntityClass>("TestSourceEntity");
      assert.isDefined(sourceEntity);
      const targetEntity = await schema.getClass<EntityClass>("TestTargetEntity");
      assert.isDefined(targetEntity);

      const relClass = await schema.getClass<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      expect(relClass!.strength).equal(StrengthType.Embedding);
      expect(relClass!.strengthDirection).equal(StrengthDirection.Backward);

      assert.isDefined(relClass!.source);
      expect(relClass!.source!.polymorphic).equal(true);
      expect(relClass!.source!.roleLabel).equal("Source RoleLabel");
      assert.isTrue(relClass!.source!.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.source!.constraintClasses);
      expect(relClass!.source!.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.source!.constraintClasses![0] === sourceEntity);
      assert.isDefined(relClass!.source!.abstractConstraint);
      assert.isTrue(await relClass!.source!.abstractConstraint === sourceBaseEntity);

      assert.isDefined(relClass!.target);
      expect(relClass!.target!.polymorphic).equal(true);
      expect(relClass!.target!.roleLabel).equal("Target RoleLabel");
      assert.isTrue(relClass!.target!.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.target!.constraintClasses);
      expect(relClass!.target!.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.target!.constraintClasses![0] === targetEntity);
      assert.isDefined(relClass!.target!.abstractConstraint);
      assert.isTrue(await relClass!.target!.abstractConstraint === targetBaseEntity);
    });

    it("should succeed with navigation property", async () => {
      const json = createSchemaJson({
        source: {},
        target: {},
        properties: [
          {
            propertyType: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.TestRelationship",
            direction: "backward",
          },
        ],
      });
      const schema = await Schema.fromJson(json);
      assert.isDefined(schema);

      const relClass = await schema.getClass<RelationshipClass>("TestRelationship");
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
        source: {},
        target: {},
        properties: [
          {
            propertyType: "NavigationProperty",
            name: "testNavProp",
            relationshipName: "TestSchema.TestRelationship",
            direction: "backward",
          },
        ],
      });
      const schema = Schema.fromJsonSync(json);
      assert.isDefined(schema);

      const relClass = schema.getClassSync<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);

      const navProp = relClass!.getPropertySync("testNavProp");
      assert.isDefined(navProp);
      assert.isTrue(navProp!.isNavigation());
      if (navProp && navProp.isNavigation()) {
        assert.isDefined(navProp.relationshipClass);
        assert.isTrue(navProp.getRelationshipClassSync() === relClass);
      }
    });

    it("should throw for missing source constraint", async () => {
      const json = createSchemaJson({
        target: {},
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship is missing the required source constraint.`);
    });

    it("should throw for missing target constraint", async () => {
      const json = createSchemaJson({
        source: {},
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship is missing the required target constraint.`);
    });

    it("should throw for invalid source constraint", async () => {
      const json = createSchemaJson({
        source: 0,
        target: {},
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid source constraint. It should be of type 'object'.`);
    });

    it("should throw for invalid target constraint", async () => {
      const json = createSchemaJson({
        source: {},
        target: 0,
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid target constraint. It should be of type 'object'.`);
    });

    it("should throw for invalid abstractConstraint", async () => {
      const json = createSchemaJson({
        source: { abstractConstraint: 0 },
        target: {},
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestRelationship has an invalid 'abstractConstraint' property. It should be of type 'string'.`);
    });

    it("should throw for invalid constraintClasses", async () => {
      const json = createSchemaJson({
        source: { constraintClasses: 0 },
        target: {},
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestRelationship has an invalid 'constraintClasses' property. It should be of type 'array'.`);
    });
  });

  describe("fromJson", () => {
    const baseJson = { schemaItemType: "RelationshipClass" };
    let testRelationship: RelationshipClass;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testRelationship = new RelationshipClass(schema, "TestRelationship");
    });

    it("should throw for invalid strength", async () => {
      expect(testRelationship).to.exist;
      const json = { ...baseJson, strength: 0 };
      await expect(testRelationship.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid 'strength' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid strengthDirection", async () => {
      expect(testRelationship).to.exist;
      const json = { ...baseJson, strengthDirection: 0 };
      await expect(testRelationship.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid 'strengthDirection' attribute. It should be of type 'string'.`);
    });
  });
});
