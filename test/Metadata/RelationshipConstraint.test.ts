/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import RelationshipClass, { RelationshipConstraint } from "../../source/Metadata/RelationshipClass";
import { RelationshipEnd} from "../../source/ECObjects";

describe("RelationshipConstraint", () => {
  describe("fromJson", () => {
    let testConstraint: RelationshipConstraint;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      const relClass = new RelationshipClass(schema, "TestRelationship");
      testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testConstraint).to.exist;
      const json: any = { [attributeName]: value };
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
  });
});
