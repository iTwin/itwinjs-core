/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import CustomAttributeClass from "../../source/Metadata/CustomAttributeClass";
import { ECClassModifier } from "../../source/ECObjects";
import { CustomAttributeContainerType } from "../../source/index";

describe("CustomAttributeClass", () => {

  describe("deserialization", () => {
    function createSchemaJsonWithItems(itemsJson: any): any {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          ...itemsJson,
        },
      };
    }
    function createSchemaJson(caClassJson: any): any {
      return createSchemaJsonWithItems({
        TestCAClass: {
          schemaItemType: "CustomAttributeClass",
          ...caClassJson,
        },
      });
    }

    it("should succeed with fully defined", async () => {
      const schemaJson = createSchemaJson({
        label: "Test CustomAttribute Class",
        description: "Used for testing",
        modifier: "Sealed",
        appliesTo: "AnyClass",
      });

      const ecschema = await Schema.fromJson(schemaJson);

      const testCAClass = await ecschema.getClass<CustomAttributeClass>("TestCAClass");
      expect(testCAClass).to.exist;

      expect(testCAClass!.name).to.equal("TestCAClass");
      expect(testCAClass!.label).to.equal("Test CustomAttribute Class");
      expect(testCAClass!.description).to.equal("Used for testing");
      expect(testCAClass!.modifier).to.equal(ECClassModifier.Sealed);
      expect(testCAClass!.containerType).to.equal(CustomAttributeContainerType.AnyClass);
    });

    it("should throw for NavigationProperty", async () => {
      const json = createSchemaJson({
        appliesTo: "Schema",
        properties: [{ name: "navProp", propertyType: "NavigationProperty" }],
      });
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Navigation Property TestCAClass.navProp is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);
    });
  });

  describe("fromJson", () => {
    let testClass: CustomAttributeClass;
    const baseJson = {schemaItemType: "CustomAttributeClass"};

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testClass = new CustomAttributeClass(schema, "TestCustomAttribute");
    });

    it("should throw for missing appliesTo", async () => {
      expect(testClass).to.exist;
      await expect(testClass.fromJson({...baseJson})).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testClass).to.exist;
      const json = {
        ...baseJson,
        appliesTo: 0,
      };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });
  });
});
