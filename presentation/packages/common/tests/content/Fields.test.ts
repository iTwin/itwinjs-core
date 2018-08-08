/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  createRandomECClassInfo, createRandomECClassInfoJSON,
  createRandomRelationshipPath, createRandomRelationshipPathJSON,
  createRandomCategory, createRandomPrimitiveTypeDescription,
  createRandomEditorDescription, createRandomPrimitiveField,
} from "@helpers/random";
import { BaseFieldJSON, PropertiesFieldJSON, NestedContentFieldJSON } from "@src/content/Fields";
import { Field, PropertiesField, NestedContentField, PropertyValueFormat, StructTypeDescription, Property } from "@src/content";

const generateTestData = () => {
  const testData: any = {};
  testData.baseFieldJSON = {
    category: createRandomCategory(),
    name: faker.random.word(),
    label: faker.random.words(),
    type: createRandomPrimitiveTypeDescription(),
    isReadonly: faker.random.boolean(),
    priority: faker.random.number(),
    editor: createRandomEditorDescription(),
  } as BaseFieldJSON;
  testData.propertiesFieldJSON = {
    ...testData.baseFieldJSON,
    properties: [{
      property: {
        classInfo: createRandomECClassInfoJSON(),
        name: faker.random.word(),
        type: faker.database.type(),
      },
      relatedClassPath: createRandomRelationshipPathJSON(1),
    }],
  } as PropertiesFieldJSON;
  testData.nestedContentFieldJSON = {
    ...testData.baseFieldJSON,
    type: {
      valueFormat: PropertyValueFormat.Struct,
      typeName: faker.random.word(),
      members: [{
        type: createRandomPrimitiveTypeDescription(),
        name: "name1",
        label: "label 1",
      }, {
        type: createRandomPrimitiveTypeDescription(),
        name: "name2",
        label: "label 2",
      }],
    } as StructTypeDescription,
    contentClassInfo: createRandomECClassInfoJSON(),
    pathToPrimaryClass: createRandomRelationshipPathJSON(),
    nestedFields: [{
      ...testData.baseFieldJSON,
      name: "name1",
      label: "label 1",
    }, {
      ...testData.baseFieldJSON,
      name: "name2",
      label: "label 2",
    }],
  } as NestedContentFieldJSON;
  return testData;
};

describe("Field", () => {

  describe("fromJSON", () => {

    let testData!: any;
    beforeEach(() => {
      testData = generateTestData();
    });

    it("creates valid Field from valid JSON", () => {
      const item = Field.fromJSON(testData.baseFieldJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid PropertiesField from valid JSON", () => {
      const item = Field.fromJSON(testData.propertiesFieldJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid JSON", () => {
      const item = Field.fromJSON(testData.nestedContentFieldJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid Field from valid serialized JSON", () => {
      const item = Field.fromJSON(JSON.stringify(testData.baseFieldJSON));
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = Field.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

  describe("isPropertiesField", () => {

    it("returns false for non-properties field", () => {
      const field = createRandomPrimitiveField();
      expect(!field.isPropertiesField());
    });

    it("returns true for properties field", () => {
      const property: Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const field = new PropertiesField(createRandomCategory(), faker.random.word(), faker.random.words(),
        createRandomPrimitiveTypeDescription(), faker.random.boolean(), faker.random.number(), [property]);
      expect(field.isPropertiesField());
    });

  });

  describe("isNestedContentField", () => {

    it("returns false for non-nested content field", () => {
      const field = createRandomPrimitiveField();
      expect(!field.isNestedContentField());
    });

    it("returns true for nested content field", () => {
      const field = new NestedContentField(createRandomCategory(), faker.random.word(), faker.random.words(),
        createRandomPrimitiveTypeDescription(), faker.random.boolean(), faker.random.number(), createRandomECClassInfo(),
        [], []);
      expect(field.isNestedContentField());
    });

  });

});

describe("PropertiesField", () => {

  describe("fromJSON", () => {

    let testData!: any;
    beforeEach(() => {
      testData = generateTestData();
    });

    it("creates valid PropertiesField from valid JSON", () => {
      const item = PropertiesField.fromJSON(testData.propertiesFieldJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid PropertiesField from valid serialized JSON", () => {
      const item = PropertiesField.fromJSON(JSON.stringify(testData.propertiesFieldJSON));
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = PropertiesField.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

});

describe("NestedContentField", () => {

  describe("fromJSON", () => {

    let testData!: any;
    beforeEach(() => {
      testData = generateTestData();
    });

    it("creates valid NestedContentField from valid JSON", () => {
      const item = NestedContentField.fromJSON(testData.nestedContentFieldJSON);
      expect(item).to.matchSnapshot();
    });

    it("creates valid NestedContentField from valid serialized JSON", () => {
      const item = NestedContentField.fromJSON(JSON.stringify(testData.nestedContentFieldJSON));
      expect(item).to.matchSnapshot();
    });

    it("returns undefined for undefined JSON", () => {
      const item = NestedContentField.fromJSON(undefined);
      expect(item).to.be.undefined;
    });

  });

  describe("rebuildParentship / resetParentship", () => {

    it("creates and resets parentship of self and nested fields", () => {
      const descr: StructTypeDescription = {
        valueFormat: PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          type: createRandomPrimitiveTypeDescription(),
          label: faker.random.words(),
          name: faker.random.word(),
        }],
      };
      const field1 = createRandomPrimitiveField();
      const field2 = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), descr, faker.random.boolean(), faker.random.number(),
        createRandomECClassInfo(), createRandomRelationshipPath(), [field1]);
      const field3 = new NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), descr, faker.random.boolean(), faker.random.number(),
        createRandomECClassInfo(), createRandomRelationshipPath(), [field2]);

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

});
