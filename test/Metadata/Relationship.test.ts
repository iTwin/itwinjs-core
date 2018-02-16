/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import EntityClass from "../../source/Metadata/EntityClass";
import RelationshipClass from "../../source/Metadata/RelationshipClass";
import { RelationshipMultiplicity, StrengthType, RelatedInstanceDirection } from "../../source/ECObjects";
import { ECObjectsError } from "../../source/Exception";

describe("relationship multiplicity", () => {
  it("check if standard multiplicities are truly static objects", () => {
    assert.isTrue(RelationshipMultiplicity.zeroOne === RelationshipMultiplicity.zeroOne);
    assert.isTrue(RelationshipMultiplicity.zeroMany === RelationshipMultiplicity.zeroMany);
    assert.isTrue(RelationshipMultiplicity.oneOne === RelationshipMultiplicity.oneOne);
    assert.isTrue(RelationshipMultiplicity.oneMany === RelationshipMultiplicity.oneMany);
  });
});

describe("RelationshipClass", () => {
  describe("deserialization", () => {
    it("succeed with fully defined relationship", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        children: {
          TestRelClass: {
            schemaChildType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Backward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "TestSchema.TestSourceEntity",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "TestSchema.TestTargetEntity",
              ],
            },
          },
          TestSourceEntity: {
            schemaChildType: "EntityClass",
          },
          TestTargetEntity: {
            schemaChildType: "EntityClass",
          },
        },
      };

      const schema = await Schema.fromJson(schemaJson);
      assert.isDefined(schema);

      const sourceEntity = await schema.getClass<EntityClass>("TestSourceEntity");
      assert.isDefined(sourceEntity);
      const targetEntity = await schema.getClass<EntityClass>("TestTargetEntity");
      assert.isDefined(targetEntity);

      const relClass = await schema.getClass<RelationshipClass>("TestRelClass");
      assert.isDefined(relClass);
      expect(relClass!.strength).equal(StrengthType.Embedding);
      expect(relClass!.strengthDirection).equal(RelatedInstanceDirection.Backward);

      assert.isDefined(relClass!.source);
      expect(relClass!.source!.polymorphic).equal(true);
      expect(relClass!.source!.roleLabel).equal("Source RoleLabel");
      assert.isTrue(relClass!.source!.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.source!.constraintClasses);
      expect(relClass!.source!.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.source!.constraintClasses![0] === sourceEntity);

      assert.isDefined(relClass!.target);
      expect(relClass!.target!.polymorphic).equal(true);
      expect(relClass!.target!.roleLabel).equal("Target RoleLabel");
      assert.isTrue(relClass!.target!.multiplicity!.equals(RelationshipMultiplicity.zeroMany));
      assert.isDefined(relClass!.target!.constraintClasses);
      expect(relClass!.target!.constraintClasses!.length).equal(1);
      assert.isTrue(await relClass!.target!.constraintClasses![0] === targetEntity);
    });
  });

  describe("fromJson", () => {
    let testRelationship: RelationshipClass;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testRelationship = new RelationshipClass(schema, "TestRelationship");
    });

    it("should throw for invalid strength", async () => {
      expect(testRelationship).to.exist;
      const json = { strength: 0 };
      await expect(testRelationship.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid 'strength' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid strengthDirection", async () => {
      expect(testRelationship).to.exist;
      const json = { strengthDirection: 0 };
      await expect(testRelationship.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The RelationshipClass TestRelationship has an invalid 'strengthDirection' attribute. It should be of type 'string'.`);
    });
  });
});
