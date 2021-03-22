/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import {
  ArrayTypeDescription, Item, NestedContentField, NestedContentValue, PresentationError, PrimitiveTypeDescription, PropertiesField, Property,
  PropertyValueFormat, StructTypeDescription,
} from "@bentley/presentation-common";
import {
  createRandomCategory, createRandomECClassInfo, createRandomECInstanceKey, createRandomPrimitiveField, createRandomPrimitiveTypeDescription,
  createRandomRelationshipPath,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { PrimitiveValue } from "@bentley/ui-abstract";
import { ContentBuilder, FIELD_NAMES_SEPARATOR } from "../../presentation-components/common/ContentBuilder";

describe("ContentBuilder", () => {

  describe("createPropertyDescription", () => {

    it("creates simple description", () => {
      const field = createRandomPrimitiveField();
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with name prefix", () => {
      const field = createRandomPrimitiveField();
      const descr = ContentBuilder.createPropertyDescription(field, { namePrefix: "test" });
      expect(descr.name).to.eq(`test${FIELD_NAMES_SEPARATOR}${field.name}`);
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
        valueFormat: PropertyValueFormat.Primitive,
        typeName: "enum",
      } as PrimitiveTypeDescription;
      (field as PropertiesField).properties = [{
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

    describe("with primitives", () => {

      it("creates record with primitive value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: "some value",
        };
        const displayValues = {
          [field.name]: "some display value",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [], { test: "custom value" });
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with undefined primitive value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {};
        const displayValues = {};
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with merged primitive value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("throws on invalid primitive value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: ["some value"],
        };
        const displayValues = {
          [field.name]: ["some display value"],
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
      });

    });

    describe("with arrays", () => {

      it("creates record with array value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createRandomPrimitiveTypeDescription(),
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: ["some value 1", "some value 2"],
        };
        const displayValues = {
          [field.name]: ["some display value 1", "some display value 2"],
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with undefined array value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createRandomPrimitiveTypeDescription(),
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {};
        const displayValues = {};
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with merged array value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createRandomPrimitiveTypeDescription(),
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("throws on invalid array value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: ArrayTypeDescription = {
          valueFormat: PropertyValueFormat.Array,
          typeName: faker.random.word(),
          memberType: createRandomPrimitiveTypeDescription(),
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: "not an array",
        };
        const displayValues = {
          [field.name]: "not an array",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
      });

    });

    describe("with structs", () => {

      it("creates record with struct value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createRandomPrimitiveTypeDescription(),
          }],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
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
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with undefined struct value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createRandomPrimitiveTypeDescription(),
          }],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {};
        const displayValues = {};
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with merged struct value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createRandomPrimitiveTypeDescription(),
          }],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("throws on invalid struct value", () => {
        const property: Property = {
          property: {
            classInfo: createRandomECClassInfo(),
            name: faker.random.word(),
            type: faker.database.type(),
          },
          relatedClassPath: [],
        };
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: faker.random.word(),
          members: [{
            name: faker.random.word(),
            label: faker.random.words(),
            type: createRandomPrimitiveTypeDescription(),
          }],
        };
        const field = new PropertiesField(createRandomCategory(), faker.random.word(),
          faker.random.words(), typeDescription, faker.random.boolean(),
          faker.random.number(), [property]);
        const values = {
          [field.name]: "not a struct",
        };
        const displayValues = {
          [field.name]: "not a struct",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw();
      });

    });

    describe("with nested content", () => {

      it("creates record with single nested content value", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
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
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [], { test: "custom value" });
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("throws when nested content value is of wrong format", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
      });

      it("creates record with multiple nested content values", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
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
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with multiple nested content values which have links in them", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
        const values = {
          [field.name]: [{
            primaryKeys: [createRandomECInstanceKey()],
            values: {
              [nestedField.name]: "some value 1",
            },
            displayValues: {
              [nestedField.name]: "some display value 1 with link www.testLink.com",
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createRandomECInstanceKey()],
            values: {
              [nestedField.name]: "some value 2",
            },
            displayValues: {
              [nestedField.name]: "some display value 2 with link http://www.testLinkTwo.com",
            },
            mergedFieldNames: [],
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with merged nesting content value", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("handles undefined display value of merged nested content value", async () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect((record!.value as PrimitiveValue).displayValue).to.eq("");
      });

      it("throws when display value of merged nested content is not primitive", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: ["merged"],
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [field.name]);
        expect(() => ContentBuilder.createPropertyRecord(field, item)).to.throw(PresentationError);
      });

      it("creates record with merged nested content value", () => {
        const nestedField = createRandomPrimitiveField();
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [nestedField], undefined, faker.random.boolean());
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
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field, item);
        expect(record).to.matchSnapshot();
      });

      it("creates record with only properties in exclusive include path", () => {
        const field11 = createRandomPrimitiveField();
        const field12 = createRandomPrimitiveField();
        const field2 = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field11, field12], undefined, faker.random.boolean());
        const field3 = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field2], undefined, faker.random.boolean());
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
              }] as NestedContentValue[],
            },
            displayValues: {
              [field2.name]: undefined,
            },
            mergedFieldNames: [],
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field3.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field3, item, { exclusiveIncludePath: [field2, field12] });
        expect(record).to.matchSnapshot();
      });

      it("creates record without properties in hidden fields path", () => {
        const field11 = createRandomPrimitiveField();
        const field12 = createRandomPrimitiveField();
        const field2 = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field11, field12], undefined, faker.random.boolean());
        const field3 = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [field2], undefined, faker.random.boolean());
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
              }] as NestedContentValue[],
            },
            displayValues: {
              [field2.name]: undefined,
            },
            mergedFieldNames: [],
          }] as NestedContentValue[],
        };
        const displayValues = {
          [field3.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const record = ContentBuilder.createPropertyRecord(field3, item, { hiddenFieldPaths: [[field2, field12]] });
        expect(record).to.matchSnapshot();
      });

      it("returns undefined if created record has no members and `skipChildlessRecords` prop is set", () => {
        const field = new NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1), [], undefined, faker.random.boolean());
        const values = {
          [field.name]: [],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = new Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, [], { test: "custom value" });
        expect(ContentBuilder.createPropertyRecord(field, item, { skipChildlessRecords: true })).to.be.undefined;
      });

    });

  });

});
