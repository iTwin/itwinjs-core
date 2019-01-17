/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Schema } from "../../src/Metadata/Schema";
import { EntityClass } from "../../src/Metadata/EntityClass";
import { RelationshipClass, RelationshipMultiplicity, RelationshipConstraint } from "../../src/Metadata/RelationshipClass";
import { StrengthType, StrengthDirection, RelationshipEnd } from "../../src/ECObjects";
import { ECObjectsError } from "../../src/Exception";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import sinon = require("sinon");
import { CustomAttributeClass } from "../../src/Metadata/CustomAttributeClass";
import { Mixin } from "../../src/Metadata/Mixin";
import { DelayedPromiseWithProps } from "../../src/DelayedPromise";

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

      const schema = await Schema.fromJson(schemaJson);
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
      const schema = await Schema.fromJson(json);
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
      const schema = Schema.fromJsonSync(json);
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
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship is missing the required source constraint.`);
    });

    it("should throw for missing target constraint", async () => {
      const json = createSchemaJson({
        strength: "embedding",
        strengthDirection: "forward",
        source: validConstraint,
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship is missing the required target constraint.`);
    });

    it("should throw for invalid source constraint", async () => {
      const json = createSchemaJson({
        strength: "holding",
        strengthDirection: "forward",
        source: 0,
        target: validConstraint,
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid source constraint. It should be of type 'object'.`);
    });

    it("should throw for invalid target constraint", async () => {
      const json = createSchemaJson({
        strength: "referencing",
        strengthDirection: "forward",
        source: validConstraint,
        target: 0,
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid target constraint. It should be of type 'object'.`);
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
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'abstractConstraint' attribute. It should be of type 'string'.`);
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
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);
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

    it("async - Serialization of fully defined relationship", async () => {
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
      const relClass = await schema.getItem<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      const relClassJson = relClass!.toJson(true, true);
      assert.isDefined(relClassJson);
      assert(relClassJson.strength, "Embedding");
      assert(relClassJson.strengthDirection, "Backward");
      assert(relClassJson.modifier, "Sealed");
      assert(relClassJson.source.polymorphic === true);
      assert(relClassJson.source.multiplicity, "(0..*)");
      assert(relClassJson.source.roleLabel, "Source RoleLabel");
      assert(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      assert(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      assert(relClassJson.target.polymorphic === true);
      assert(relClassJson.target.multiplicity, "(0..*)");
      assert(relClassJson.target.roleLabel, "Target RoleLabel");
      assert(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      assert(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });
    it("sync - Serialization of fully defined relationship", async () => {
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

      const schema = Schema.fromJsonSync(schemaJson);
      assert.isDefined(schema);
      const relClass = schema.getItemSync<RelationshipClass>("TestRelationship");
      assert.isDefined(relClass);
      const relClassJson = relClass!.toJson(true, true);
      assert.isDefined(relClassJson);
      assert(relClassJson.strength, "Embedding");
      assert(relClassJson.strengthDirection, "Backward");
      assert(relClassJson.modifier, "Sealed");
      assert(relClassJson.source.polymorphic === true);
      assert(relClassJson.source.multiplicity, "(0..*)");
      assert(relClassJson.source.roleLabel, "Source RoleLabel");
      assert(relClassJson.source.abstractConstraint, "TestSchema.SourceBaseEntity");
      assert(relClassJson.source.constraintClasses[0], "TestSchema.TestSourceEntity");
      assert(relClassJson.target.polymorphic === true);
      assert(relClassJson.target.multiplicity, "(0..*)");
      assert(relClassJson.target.roleLabel, "Target RoleLabel");
      assert(relClassJson.target.abstractConstraint, "TestSchema.TargetBaseEntity");
      assert(relClassJson.target.constraintClasses[0], "TestSchema.TestTargetEntity");
    });
  });

  describe("validation", () => {
    let schema: Schema;

    describe("supportsClass method tests", () => {
      let vehicleOwner: RelationshipClass;
      let childVehicleOwner: RelationshipClass;
      let grandChildVehicleOwner: RelationshipClass;
      let americanVehicleOwner: RelationshipClass;
      let vehicle: EntityClass;
      let chevy: EntityClass;
      let ford: EntityClass;
      let f150: EntityClass;
      let honda: EntityClass;

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
          Honda: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Vehicle",
          },
          Ford: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.Vehicle",
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
        });
      }

      before(async () => {
        schema = await Schema.fromJson(createSchemaJson());
        assert.isDefined(schema);
        vehicleOwner = schema.getItemSync("VehicleOwner") as RelationshipClass;
        childVehicleOwner = schema.getItemSync("ChildVehicleOwner") as RelationshipClass;
        grandChildVehicleOwner = schema.getItemSync("GrandChildVehicleOwner") as RelationshipClass;
        americanVehicleOwner = schema.getItemSync("AmericanVehicleOwner") as RelationshipClass;
        vehicle = schema.getItemSync("Vehicle") as EntityClass;
        chevy = schema.getItemSync("Chevy") as EntityClass;
        ford = schema.getItemSync("Ford") as EntityClass;
        f150 = schema.getItemSync("F150") as EntityClass;
        honda = schema.getItemSync("Honda") as EntityClass;
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
    });
  });
});
