/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  createRandomPrimitiveField, createRandomCategory, createRandomPrimitiveTypeDescription,
  createRandomECClassInfo, createRandomECInstanceKey, createRandomRelationshipPath,
} from "@bentley/presentation-common/tests/_helpers/random";
import { PresentationError } from "@bentley/presentation-common";
import * as content from "@bentley/presentation-common/lib/content";
import ContentBuilder from "../../lib/common/ContentBuilder";

describe("ContentBuilder", () => {

  describe("createPropertyDescription", () => {

    it("creates simple description", () => {
      const field = createRandomPrimitiveField();
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with editor", () => {
      const field = createRandomPrimitiveField();
      field.editor = {
        name: faker.random.word(),
        params: [],
      };
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with choices", () => {
      const field = createRandomPrimitiveField();
      field.type = {
        valueFormat: content.PropertyValueFormat.Primitive,
        typeName: "enum",
      } as content.PrimitiveTypeDescription;
      (field as content.PropertiesField).properties = [{
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
          enumerationInfo: {
            choices: [
              { label: faker.random.word(), value: faker.random.number() },
              { label: faker.random.word(), value: faker.random.number() },
            ],
            isStrict: true,
          },
        },
        relatedClassPath: [],
      }];
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

  });

  describe("createPropertyRecord", () => {

    it("creates record with primitive value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: "some value",
      };
      const displayValues = {
        [field.name]: "some display value",
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("throws on invalid primitive value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: ["some value"],
      };
      const displayValues = {
        [field.name]: ["some display value"],
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
    });

    it("creates record with merged primitive value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: "merged",
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("creates record with array value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.ArrayTypeDescription = {
        valueFormat: content.PropertyValueFormat.Array,
        typeName: faker.random.word(),
        memberType: createRandomPrimitiveTypeDescription(),
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: ["some value 1", "some value 2"],
      };
      const displayValues = {
        [field.name]: ["some display value 1", "some display value 2"],
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("throws on invalid array value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.ArrayTypeDescription = {
        valueFormat: content.PropertyValueFormat.Array,
        typeName: faker.random.word(),
        memberType: createRandomPrimitiveTypeDescription(),
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
    });

    it("creates record with merged array value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.ArrayTypeDescription = {
        valueFormat: content.PropertyValueFormat.Array,
        typeName: faker.random.word(),
        memberType: createRandomPrimitiveTypeDescription(),
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: "merged",
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("creates record with struct value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.StructTypeDescription = {
        valueFormat: content.PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          name: faker.random.word(),
          label: faker.random.words(),
          type: createRandomPrimitiveTypeDescription(),
        }],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: {
          [typeDescription.members[0].name]: "some value",
        },
      };
      const displayValues = {
        [field.name]: {
          [typeDescription.members[0].name]: "some display value",
        },
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("throws on invalid struct value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.StructTypeDescription = {
        valueFormat: content.PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          name: faker.random.word(),
          label: faker.random.words(),
          type: createRandomPrimitiveTypeDescription(),
        }],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw();
    });

    it("creates record with merged struct value", () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.StructTypeDescription = {
        valueFormat: content.PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          name: faker.random.word(),
          label: faker.random.words(),
          type: createRandomPrimitiveTypeDescription(),
        }],
      };
      const field = new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: "merged",
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("creates record with single nested content value", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: [{
          primaryKeys: [createRandomECInstanceKey()],
          values: {
            [nestedField.name]: "some value",
          },
          displayValues: {
            [nestedField.name]: "some display value",
          },
          mergedFieldNames: [],
        }] as content.NestedContent[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("throws when nested content value is of wrong format", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
    });

    it("creates record with multiple nested content values", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: [{
          primaryKeys: [createRandomECInstanceKey()],
          values: {
            [nestedField.name]: "some value 1",
          },
          displayValues: {
            [nestedField.name]: "some display value 1",
          },
          mergedFieldNames: [],
        }, {
          primaryKeys: [createRandomECInstanceKey()],
          values: {
            [nestedField.name]: "some value 2",
          },
          displayValues: {
            [nestedField.name]: "some display value 2",
          },
          mergedFieldNames: [],
        }] as content.NestedContent[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("creates record with merged outside nested content value", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: "merged",
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("handles undefined display value of merged nested content value", async () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(await record.getDisplayValue()).to.eq("");
    });

    it("throws when display value of merged nested content is not primitive", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: undefined,
      };
      const displayValues = {
        [field.name]: ["merged"],
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, [field.name]);
      expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
    });

    it("creates record with merged inside nested content value", () => {
      const nestedField = createRandomPrimitiveField();
      const field = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField]);
      const values = {
        [field.name]: [{
          primaryKeys: [createRandomECInstanceKey()],
          values: {
            [nestedField.name]: undefined,
          },
          displayValues: {
            [nestedField.name]: "merged",
          },
          mergedFieldNames: [nestedField.name],
        }] as content.NestedContent[],
      };
      const displayValues = {
        [field.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field, item);
      expect(record).to.matchSnapshot();
    });

    it("creates record with only properties in field path", () => {
      const field11 = createRandomPrimitiveField();
      const field12 = createRandomPrimitiveField();
      const field2 = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field11, field12]);
      const field3 = new content.NestedContentField(createRandomCategory(), faker.random.word(),
        faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
        faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field2]);
      const values = {
        [field3.name]: [{
          primaryKeys: [createRandomECInstanceKey()],
          values: {
            [field2.name]: [{
              primaryKeys: [createRandomECInstanceKey()],
              values: {
                [field11.name]: "some value 1.1",
                [field12.name]: "some value 1.2",
              },
              displayValues: {
                [field11.name]: "some display value 1.1",
                [field12.name]: "some display value 1.2",
              },
              mergedFieldNames: [],
            }, {
              primaryKeys: [createRandomECInstanceKey()],
              values: {
                [field11.name]: "some value 2.1",
                [field12.name]: "some value 2.2",
              },
              displayValues: {
                [field11.name]: "some display value 2.1",
                [field12.name]: "some display value 2.2",
              },
              mergedFieldNames: [],
            }] as content.NestedContent[],
          },
          displayValues: {
            [field2.name]: undefined,
          },
          mergedFieldNames: [],
        }] as content.NestedContent[],
      };
      const displayValues = {
        [field3.name]: undefined,
      };
      const item = new content.Item([createRandomECInstanceKey()], faker.random.words(),
        faker.random.uuid(), undefined, values, displayValues, []);
      const record = ContentBuilder.createPropertyRecord(field3, item, [field2, field12]);
      expect(record).to.matchSnapshot();
    });

  });

});
