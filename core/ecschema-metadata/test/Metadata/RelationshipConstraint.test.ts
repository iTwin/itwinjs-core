/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";
import RelationshipClass, { RelationshipConstraint } from "../../src/Metadata/RelationshipClass";
import { RelationshipEnd } from "../../src/ECObjects";

describe("RelationshipConstraint", () => {
  describe("fromJson", () => {
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any, anyRelationshipConstraint?: boolean) {
      expect(testConstraint).to.exist;
      const json: any = { [attributeName]: value };
      if (anyRelationshipConstraint !== undefined)
        await expect(testConstraint.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The AnyRelationshipConstraint TestRelationship.source has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
      else
        await expect(testConstraint.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipConstraint TestRelationship.source has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid roleLabel", async () => testInvalidAttribute("roleLabel", "string", 0));
    it("should throw for invalid polymorphic", async () => testInvalidAttribute("polymorphic", "boolean", 0));

    it("should throw for invalid multiplicity", async () => {
      await testInvalidAttribute("multiplicity", "string", 0);
      const badMultiplicityJson = { multiplicity: "bAd" };
      expect(testConstraint.fromJson(badMultiplicityJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid abstractConstraint", async () => {
      await testInvalidAttribute("abstractConstraint", "string", 0);
      const unloadedAbstractConstraintJson = { abstractConstraint: "ThisClassDoesNotExist" };
      expect(testConstraint.fromJson(unloadedAbstractConstraintJson)).to.be.rejectedWith(ECObjectsError);
    });
    it("should throw for invalid constraintClasses", async () => {
      await testInvalidAttribute("constraintClasses", "string[]", 0);
      await testInvalidAttribute("constraintClasses", "string[]", [0]);
      const unloadedConstraintClassesJson = { constraintClasses: ["ThisClassDoesNotExist"] };
      expect(testConstraint.fromJson(unloadedConstraintClassesJson)).to.be.rejectedWith(ECObjectsError);
    });
    it("should throw for invalid customAttributes", async () => {
      const json: any = { ["customAttributes"]: "array" };
      await expect(testConstraint.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The AnyRelationshipConstraint TestRelationship.source has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
      const unloadedConstraintClassesJson = { constraintClasses: ["ThisClassDoesNotExist"] };
      expect(testConstraint.fromJson(unloadedConstraintClassesJson)).to.be.rejectedWith(ECObjectsError, ``);
    });
    const oneCustomAttributeJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "ValidSchema",
      customAttributes: [
        {
          className: "CoreCustomAttributes.HiddenSchema",
          ShowClasses: true,
        },
      ],
    };
    it("async - Deserialize One Custom Attribute", async () => {
      await testConstraint.fromJson(oneCustomAttributeJson);
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    it("sync - Deserialize One Custom Attribute", () => {
      testConstraint.fromJsonSync(oneCustomAttributeJson);
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === true);
    });
    const twoCustomAttributesJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "ValidSchema",
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
      await testConstraint.fromJson(twoCustomAttributesJson);
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testConstraint.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes", () => {
      testConstraint.fromJsonSync(twoCustomAttributesJson);
      expect(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"]).to.exist;
      expect(testConstraint.customAttributes!["ExampleCustomAttributes.ExampleSchema"]).to.exist;
    });
    it("sync - Deserialize Two Custom Attributes with additional properties", () => {
      const relConstraintJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "ValidSchema",
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
      testConstraint.fromJsonSync(relConstraintJson);
      assert(testConstraint.customAttributes!["CoreCustomAttributes.HiddenSchema"].ShowClasses === false);
      assert(testConstraint.customAttributes!["ExampleCustomAttributes.ExampleSchema"].ShowClasses === true);
    });
    const mustBeAnArrayJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "InvalidSchema",
      customAttributes: "CoreCustomAttributes.HiddenSchema",
    };
    it("async - Custom Attributes must be an array", async () => {
      await expect(testConstraint.fromJson(mustBeAnArrayJson)).to.be.rejectedWith(ECObjectsError, `The AnyRelationshipConstraint TestRelationship.source has an invalid 'customAttributes' attribute. It should be of type 'array'.`);

    });
    it("sync - Custom Attributes must be an array", () => {
      assert.throws(() => testConstraint.fromJsonSync(mustBeAnArrayJson), ECObjectsError, `The AnyRelationshipConstraint TestRelationship.source has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });
  });
});
