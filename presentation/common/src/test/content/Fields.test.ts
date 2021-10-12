/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Field, NestedContentField, PropertiesField } from "../../presentation-common";
import { FieldDescriptor, FieldDescriptorType } from "../../presentation-common/content/Fields";
import { RelationshipMeaning } from "../../presentation-common/rules/content/modifiers/RelatedPropertiesSpecification";
import {
  createTestCategoryDescription, createTestNestedContentField, createTestPropertiesContentField, createTestSimpleContentField,
} from "../_helpers/Content";
import { createTestECClassInfo, createTestPropertyInfo, createTestRelatedClassInfo } from "../_helpers/EC";

describe("Field", () => {

  describe("fromJSON", () => {

    it("creates valid Field from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestSimpleContentField({ category }).toJSON();
      const field = Field.fromJSON({ ...json }, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid PropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Field.fromJSON(undefined, []);
      expect(item).to.be.undefined;
    });

    it("throws when creating field with category that doesn't exist in given list", () => {
      const category = createTestCategoryDescription();
      const json = createTestSimpleContentField({ category }).toJSON();
      expect(() => Field.fromJSON({ ...json, category: "does not exist" }, [category])).to.throw();
    });

  });

  describe("isPropertiesField", () => {

    it("returns false for non-properties field", () => {
      const field = createTestSimpleContentField();
      expect(field.isPropertiesField()).to.be.false;
    });

    it("returns true for properties field", () => {
      const field = createTestPropertiesContentField({ properties: [{ property: createTestPropertyInfo() }] });
      expect(field.isPropertiesField()).to.be.true;
    });

  });

  describe("isNestedContentField", () => {

    it("returns false for non-nested content field", () => {
      const field = createTestSimpleContentField();
      expect(field.isNestedContentField()).to.be.false;
    });

    it("returns true for nested content field", () => {
      const field = createTestNestedContentField({
        nestedFields: [],
      });
      expect(field.isNestedContentField()).to.be.true;
    });

  });

  describe("getFieldDescriptor", () => {

    it("creates `NamedFieldDescriptor`", () => {
      const field = createTestSimpleContentField();
      expect(field.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Name,
        fieldName: field.name,
      });
    });

  });

  describe("clone", () => {

    it("returns exact copy of itself", () => {
      const field = createTestSimpleContentField();
      const clone = field.clone();
      expect(clone).to.be.instanceOf(Field);
      expect(clone.toJSON()).to.deep.eq(field.toJSON());
    });

  });

});

describe("PropertiesField", () => {

  describe("fromJSON", () => {

    it("creates valid PropertiesField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestPropertiesContentField({
        category,
        properties: [{ property: createTestPropertyInfo() }],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const field = PropertiesField.fromJSON(undefined, []);
      expect(field).to.be.undefined;
    });

  });

  describe("getFieldDescriptor", () => {

    it("creates `PropertiesFieldDescriptor` for root field", () => {
      const propertyInfo = createTestPropertyInfo();
      const field = createTestPropertiesContentField({
        properties: [{ property: propertyInfo }],
      });
      expect(field.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Properties,
        properties: [{
          class: propertyInfo.classInfo.name,
          name: propertyInfo.name,
        }],
        pathFromSelectToPropertyClass: [],
      });
    });

    it("creates `PropertiesFieldDescriptor` for nested field", () => {
      const propertyInfo1 = createTestPropertyInfo({ name: "prop1" });
      const propertyInfo2 = createTestPropertyInfo({ name: "prop2" });
      const propertiesField = createTestPropertiesContentField({
        properties: [{ property: propertyInfo1 }, { property: propertyInfo2 }],
      });
      const parent1 = createTestNestedContentField({
        nestedFields: [propertiesField],
        pathToPrimaryClass: [
          createTestRelatedClassInfo({
            sourceClassInfo: createTestECClassInfo({ name: "a" }),
            relationshipInfo: createTestECClassInfo({ name: "a-b" }),
            targetClassInfo: createTestECClassInfo({ name: "b" }),
            isForwardRelationship: true,
            isPolymorphicRelationship: true,
            isPolymorphicTargetClass: true,
          }),
        ],
      });
      const parent2 = createTestNestedContentField({
        nestedFields: [parent1],
        pathToPrimaryClass: [
          createTestRelatedClassInfo({
            sourceClassInfo: createTestECClassInfo({ name: "c" }),
            relationshipInfo: createTestECClassInfo({ name: "c-d" }),
            targetClassInfo: createTestECClassInfo({ name: "d" }),
            isForwardRelationship: false,
            isPolymorphicRelationship: false,
            isPolymorphicTargetClass: false,
          }),
        ],
      });
      parent2.rebuildParentship();
      expect(propertiesField.getFieldDescriptor()).to.deep.eq({
        type: FieldDescriptorType.Properties,
        properties: [{
          class: propertyInfo1.classInfo.name,
          name: propertyInfo1.name,
        }, {
          class: propertyInfo2.classInfo.name,
          name: propertyInfo2.name,
        }],
        pathFromSelectToPropertyClass: [{
          sourceClassName: "d",
          relationshipName: "c-d",
          targetClassName: "c",
          isForwardRelationship: true,
        }, {
          sourceClassName: "b",
          relationshipName: "a-b",
          targetClassName: "a",
          isForwardRelationship: false,
        }],
      });
    });

  });

  describe("clone", () => {

    it("returns exact copy of itself", () => {
      const field = createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(PropertiesField);
      expect(clone.toJSON()).to.deep.eq(field.toJSON());
    });

  });

});

describe("NestedContentField", () => {

  describe("getFieldByName", () => {

    it("returns undefined when there are no nested fields", () => {
      const field = createTestNestedContentField({ nestedFields: [] });
      expect(field.getFieldByName("test")).to.be.undefined;
    });

    it("returns undefined when field is not found", () => {
      const nested = createTestSimpleContentField();
      const field = createTestNestedContentField({ nestedFields: [nested] });
      expect(field.getFieldByName("does_not_exist", true)).to.be.undefined;
    });

    it("returns a field", () => {
      const nested = createTestSimpleContentField();
      const field = createTestNestedContentField({ nestedFields: [nested] });
      expect(field.getFieldByName(nested.name)).to.eq(nested);
    });

  });

  describe("fromJSON", () => {

    it("creates valid NestedContentField from valid JSON", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid JSON with `relationshipMeaning`", () => {
      const category = createTestCategoryDescription();
      const json = createTestNestedContentField({
        category,
        nestedFields: [createTestSimpleContentField({ category })],
        relationshipMeaning: RelationshipMeaning.SameInstance,
      }).toJSON();
      const field = Field.fromJSON(json, [category]);
      expect(field).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = NestedContentField.fromJSON(undefined, []);
      expect(item).to.be.undefined;
    });

  });

  describe("rebuildParentship / resetParentship", () => {

    it("creates and resets parentship of self and nested fields", () => {
      const field1 = createTestSimpleContentField();
      const field2 = createTestNestedContentField({ nestedFields: [field1] });
      const field3 = createTestNestedContentField({ nestedFields: [field2] });

      field2.rebuildParentship(field3);
      expect(field3.parent).to.be.undefined;
      expect(field2.parent).to.eq(field3);
      expect(field1.parent).to.eq(field2);

      field3.resetParentship();
      expect(field3.parent).to.be.undefined;
      expect(field2.parent).to.be.undefined;
      expect(field1.parent).to.be.undefined;
    });

  });

  describe("clone", () => {

    it("returns exact copy of itself", () => {
      const field = createTestNestedContentField({ nestedFields: [createTestSimpleContentField()] });
      const clone = field.clone();
      expect(clone).to.be.instanceOf(NestedContentField);
      expect(clone.toJSON()).to.deep.eq(field.toJSON());
    });

  });

});

describe("FieldDescriptor", () => {

  describe("type guards", () => {

    it("correctly checks 'Name' descriptor", () => {
      expect(FieldDescriptor.isNamed({
        type: FieldDescriptorType.Name,
        fieldName: "test",
      })).to.be.true;
      expect(FieldDescriptor.isNamed({
        type: FieldDescriptorType.Properties,
        properties: [],
        pathFromSelectToPropertyClass: [],
      })).to.be.false;
    });

    it("correctly checks 'Properties' descriptor", () => {
      expect(FieldDescriptor.isProperties({
        type: FieldDescriptorType.Name,
        fieldName: "test",
      })).to.be.false;
      expect(FieldDescriptor.isProperties({
        type: FieldDescriptorType.Properties,
        properties: [{
          class: "test",
          name: "",
        }],
        pathFromSelectToPropertyClass: [],
      })).to.be.true;
    });

  });

});
