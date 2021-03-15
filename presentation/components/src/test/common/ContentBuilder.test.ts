/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NestedContentValue, PropertyValueFormat, StructTypeDescription } from "@bentley/presentation-common";
import {
  createTestContentItem, createTestNestedContentField, createTestPropertiesContentField, createTestSimpleContentField,
} from "@bentley/presentation-common/lib/test/_helpers/Content";
import { createTestECInstanceKey, createTestPropertyInfo } from "@bentley/presentation-common/lib/test/_helpers/EC";
import { PrimitiveValue } from "@bentley/ui-abstract";
import { ContentBuilder, FIELD_NAMES_SEPARATOR } from "../../presentation-components/common/ContentBuilder";

describe("ContentBuilder", () => {

  describe("createPropertyDescription", () => {

    it("creates simple description", () => {
      const field = createTestSimpleContentField();
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with name prefix", () => {
      const field = createTestSimpleContentField();
      const descr = ContentBuilder.createPropertyDescription(field, { namePrefix: "test" });
      expect(descr.name).to.eq(`test${FIELD_NAMES_SEPARATOR}${field.name}`);
    });

    it("creates description with renderer", () => {
      const field = createTestSimpleContentField({
        renderer: {
          name: "RendererName",
        },
      });
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with editor", () => {
      const field = createTestSimpleContentField({
        editor: {
          name: "EditorName",
          params: [],
        },
      });
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

    it("creates description with choices", () => {
      const field = createTestPropertiesContentField({
        type: {
          valueFormat: PropertyValueFormat.Primitive,
          typeName: "enum",
        },
        properties: [{
          property: createTestPropertyInfo({
            enumerationInfo: {
              choices: [
                { label: "Enum 1", value: 1 },
                { label: "Enum 2", value: 2 },
              ],
              isStrict: true,
            },
          }),
          relatedClassPath: [],
        }],
      });
      const descr = ContentBuilder.createPropertyDescription(field);
      expect(descr).to.matchSnapshot();
    });

  });

  describe("createPropertyRecord", () => {

    describe("with primitives", () => {

      it("creates record with primitive value", () => {
        const field = createTestSimpleContentField();
        const values = {
          [field.name]: "some value",
        };
        const displayValues = {
          [field.name]: "some display value",
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({field}, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with undefined primitive value", () => {
        const field = createTestSimpleContentField();
        const values = {};
        const displayValues = {};
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with merged primitive value", () => {
        const field = createTestSimpleContentField();
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = createTestContentItem({ values, displayValues, mergedFieldNames: [field.name] });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with nested primitive value", () => {
        const nestedField = createTestSimpleContentField();
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: "some value 1",
            },
            displayValues: {
              [nestedField.name]: "some display value 1",
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
            values: {
              [nestedField.name]: "some value 2",
            },
            displayValues: {
              [nestedField.name]: "some display value 2",
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: nestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with nested primitive value when nested content value is not set", () => {
        const nestedField = createTestSimpleContentField({ name: "nested-field" });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: nestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with deeply nested primitive value", () => {
        const deeplyNestedField = createTestSimpleContentField({ name: "deeply-nested-field" });
        const nestedField = createTestNestedContentField({ name: "nested-field",  nestedFields: [deeplyNestedField] });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: [{
                primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
                values: {
                  [deeplyNestedField.name]: "some value 1",
                },
                displayValues: {
                  [deeplyNestedField.name]: "some display value 1",
                },
                mergedFieldNames: [],
              }, {
                primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
                values: {
                  [deeplyNestedField.name]: "some value 2",
                },
                displayValues: {
                  [deeplyNestedField.name]: "some display value 2",
                },
                mergedFieldNames: [],
              }],
            },
            displayValues: {
              [nestedField.name]: undefined,
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: deeplyNestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with deeply nested primitive value when nested value is not set", () => {
        const deeplyNestedField = createTestSimpleContentField({ name: "deeply-nested-field" });
        const nestedField = createTestNestedContentField({ name: "nested-field", nestedFields: [deeplyNestedField] });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: undefined,
            },
            displayValues: {
              [nestedField.name]: undefined,
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: deeplyNestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

    });

    describe("with arrays", () => {

      it("creates record with array value", () => {
        const field = createTestSimpleContentField({
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: "MyArray[]",
            memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          },
        });
        const values = {
          [field.name]: ["some value 1", "some value 2"],
        };
        const displayValues = {
          [field.name]: ["some display value 1", "some display value 2"],
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with undefined array value", () => {
        const field = createTestSimpleContentField({
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: "MyArray[]",
            memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          },
        });
        const values = {};
        const displayValues = {};
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with merged array value", () => {
        const field = createTestSimpleContentField({
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: "MyArray[]",
            memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          },
        });
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = createTestContentItem({ values, displayValues, mergedFieldNames: [field.name] });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with nested array value", () => {
        const nestedField = createTestSimpleContentField({
          name: "nested-array-field",
          type: {
            valueFormat: PropertyValueFormat.Array,
            typeName: "MyArray[]",
            memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          },
        });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: ["some value 1", "some value 2"],
            },
            displayValues: {
              [nestedField.name]: ["some display value 1", "some display value 2"],
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
            values: {
              [nestedField.name]: ["some value 3", "some value 4"],
            },
            displayValues: {
              [nestedField.name]: ["some display value 3", "some display value 4"],
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: nestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

    });

    describe("with structs", () => {

      it("creates record with struct value", () => {
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "MyStruct[]",
          members: [{
            name: "MyProperty",
            label: "My Property",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          }],
        };
        const field = createTestSimpleContentField({ type: typeDescription });
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
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with undefined struct value", () => {
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "MyStruct[]",
          members: [{
            name: "MyProperty",
            label: "My Property",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          }],
        };
        const field = createTestSimpleContentField({ type: typeDescription });
        const values = {};
        const displayValues = {};
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with merged struct value", () => {
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "MyStruct[]",
          members: [{
            name: "MyProperty",
            label: "My Property",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          }],
        };
        const field = createTestSimpleContentField({ type: typeDescription });
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = createTestContentItem({ values, displayValues, mergedFieldNames: [field.name] });
        const record = ContentBuilder.createPropertyRecord({ field }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with nested struct value", () => {
        const typeDescription: StructTypeDescription = {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "MyStruct[]",
          members: [{
            name: "MyProperty",
            label: "My Property",
            type: { valueFormat: PropertyValueFormat.Primitive, typeName: "MyType" },
          }],
        };
        const nestedField = createTestSimpleContentField({ name: "nested-struct-field", type: typeDescription });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: {
                [typeDescription.members[0].name]: "some value 1",
              },
            },
            displayValues: {
              [nestedField.name]: {
                [typeDescription.members[0].name]: "some display value 1",
              },
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
            values: {
              [nestedField.name]: {
                [typeDescription.members[0].name]: "some value 2",
              },
            },
            displayValues: {
              [nestedField.name]: {
                [typeDescription.members[0].name]: "some display value 2",
              },
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field: nestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

    });

    describe("with nested content", () => {

      it("creates record with single deeply nested content value", () => {
        const deeplyNestedField = createTestSimpleContentField({ name: "deeply-nested-field" });
        const nestedField = createTestNestedContentField({ name: "nested-field", nestedFields: [deeplyNestedField] });
        const field = createTestNestedContentField({
          name: "root-field",
          nestedFields: [nestedField],
          autoExpand: true,
          isReadonly: true,
        });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: [{
                primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
                values: {
                  [deeplyNestedField.name]: "some value",
                },
                displayValues: {
                  [deeplyNestedField.name]: "some display value",
                },
                mergedFieldNames: [],
              }],
            },
            displayValues: {
              [nestedField.name]: undefined,
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues, extendedData: { test: "extended-data" } });
        const record = ContentBuilder.createPropertyRecord({ field, childFields: [{ field: nestedField, childFields: [{ field: deeplyNestedField }] }] }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with multiple nested content values", () => {
        const nestedField = createTestSimpleContentField({ name: "nested-field" });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: "some value 1",
            },
            displayValues: {
              [nestedField.name]: "some display value 1",
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
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
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field, childFields: [{ field: nestedField }] }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with for nested content value without child records", () => {
        const nestedField = createTestNestedContentField({ name: "nested-field", nestedFields: [] });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: [{
            primaryKeys: [createTestECInstanceKey({ id: "0x1" })],
            values: {
              [nestedField.name]: [{
                primaryKeys: [createTestECInstanceKey({ id: "0x2" })],
                values: {
                },
                displayValues: {
                },
                mergedFieldNames: [],
              }],
            },
            displayValues: {
              [nestedField.name]: undefined,
            },
            mergedFieldNames: [],
          }],
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues });
        const record = ContentBuilder.createPropertyRecord({ field, childFields: [{ field: nestedField }] }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("creates record with merged nesting content value", () => {
        const nestedField = createTestSimpleContentField({ name: "nested-field" });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: "merged",
        };
        const item = createTestContentItem({ values, displayValues, mergedFieldNames: [field.name] });
        const record = ContentBuilder.createPropertyRecord({ field: nestedField }, item);
        expect({ field: record.field.name, record: record.record }).to.matchSnapshot();
      });

      it("handles undefined display value of merged nested content value", async () => {
        const nestedField = createTestSimpleContentField({ name: "nested-field" });
        const field = createTestNestedContentField({ name: "root-field",  nestedFields: [nestedField] });
        const values = {
          [field.name]: undefined,
        };
        const displayValues = {
          [field.name]: undefined,
        };
        const item = createTestContentItem({ values, displayValues, mergedFieldNames: [field.name] });
        const record = ContentBuilder.createPropertyRecord({ field, childFields: [{ field: nestedField }] }, item);
        expect((record.record.value as PrimitiveValue).displayValue).to.eq("");
      });

    });

  });

});
