/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { KoqPropertyValueFormatter, LabelDefinition, PropertyValueFormat, TypeDescription } from "../../presentation-common";
import { Content } from "../../presentation-common/content/Content";
import { ContentFormatter, ContentPropertyValueFormatter } from "../../presentation-common/content/PropertyValueFormatter";
import { DisplayValuesArray, DisplayValuesMap, NavigationPropertyValue, NestedContentValue } from "../../presentation-common/content/Value";
import {
  createTestArrayPropertiesContentField,
  createTestContentDescriptor,
  createTestContentItem,
  createTestNestedContentField,
  createTestPropertiesContentField,
  createTestPropertyInfo,
  createTestSimpleContentField,
  createTestStructPropertiesContentField,
} from "../_helpers";

describe("ContentFormatter", () => {
  let formatter: ContentFormatter;

  beforeEach(() => {
    formatter = new ContentFormatter({ formatPropertyValue: async () => "FormattedValue" });
  });

  it("formats koq property item value", async () => {
    const koqField = createTestPropertiesContentField({
      name: "koqFieldName",
      properties: [
        {
          property: createTestPropertyInfo({
            name: "koqProperty",
            kindOfQuantity: { label: "Koq Props", name: "TestSchema:TestKoq", persistenceUnit: "Units:M" },
          }),
        },
      ],
    });
    const descriptor = createTestContentDescriptor({ fields: [koqField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [koqField.name]: 1.5,
      },
    });
    const content = new Content(descriptor, [contentItem]);
    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("FormattedValue");
  });

  it("formats property item value", async () => {
    const simplePropField = createTestPropertiesContentField({
      name: "simpleFieldName",
      properties: [
        {
          property: createTestPropertyInfo({ name: "simpleProperty" }),
        },
      ],
    });
    const descriptor = createTestContentDescriptor({ fields: [simplePropField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [simplePropField.name]: "1.5",
      },
    });
    const content = new Content(descriptor, [contentItem]);
    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[simplePropField.name]).to.be.eq("FormattedValue");
  });

  it("formats calculated item value", async () => {
    const calculatedField = createTestSimpleContentField({
      name: "calculatedFieldName",
    });
    const descriptor = createTestContentDescriptor({ fields: [calculatedField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [calculatedField.name]: "4.5",
      },
    });
    const content = new Content(descriptor, [contentItem]);
    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[calculatedField.name]).to.be.eq("FormattedValue");
  });

  it("formats array item values", async () => {
    const arrayPropField = createTestArrayPropertiesContentField({
      name: "arrayPropFieldName",
      properties: [
        {
          property: createTestPropertyInfo({ name: "arrayProperty" }),
        },
      ],
      itemsField: createTestPropertiesContentField({
        properties: [{ property: createTestPropertyInfo() }],
      }),
    });
    const descriptor = createTestContentDescriptor({ fields: [arrayPropField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [arrayPropField.name]: ["123", "456"],
      },
    });
    const content = new Content(descriptor, [contentItem]);
    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[arrayPropField.name]).to.deep.eq(["FormattedValue", "FormattedValue"]);
  });

  it("formats struct member values", async () => {
    const structPropField = createTestStructPropertiesContentField({
      name: "structPropFieldName",
      properties: [
        {
          property: createTestPropertyInfo({ name: "structProperty" }),
        },
      ],
      memberFields: [
        createTestPropertiesContentField({ name: "prop1", properties: [{ property: createTestPropertyInfo() }] }),
        createTestPropertiesContentField({ name: "prop2", properties: [{ property: createTestPropertyInfo() }] }),
      ],
    });
    const descriptor = createTestContentDescriptor({ fields: [structPropField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [structPropField.name]: {
          prop1: "123",
          prop2: "456",
        },
      },
    });
    const content = new Content(descriptor, [contentItem]);
    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[structPropField.name]).to.deep.eq({ prop1: "FormattedValue", prop2: "FormattedValue" });
  });

  it("formats nested content item value", async () => {
    const nestedField = createTestSimpleContentField({
      name: "calculatedFieldName",
    });
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [nestedField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [nestedContentField.name]: [
          {
            displayValues: {},
            values: {
              [nestedField.name]: 1.5,
            },
            primaryKeys: [],
            mergedFieldNames: [],
          },
        ],
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    const nestedContentValue = formattedContent.contentSet[0].values[nestedContentField.name] as NestedContentValue[];
    expect(nestedContentValue[0].displayValues[nestedField.name]).to.be.eq("FormattedValue");
  });

  it("handles merged nested field", async () => {
    const nestedField = createTestSimpleContentField({
      name: "calculatedFieldName",
    });
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [nestedField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
    const contentItem = createTestContentItem({
      displayValues: {},
      values: {
        [nestedContentField.name]: undefined,
      },
      mergedFieldNames: [nestedContentField.name],
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[nestedContentField.name]).to.be.eq("@Presentation:label.varies@");
  });
});

describe("ContentPropertyValueFormatter", () => {
  let formatter: ContentPropertyValueFormatter;
  const formatMock = sinon.stub();

  beforeEach(() => {
    formatter = new ContentPropertyValueFormatter({ format: formatMock } as unknown as KoqPropertyValueFormatter);
  });

  afterEach(() => {
    formatMock.reset();
  });

  function createField(type: TypeDescription) {
    return createTestPropertiesContentField({
      properties: [],
      type,
    });
  }

  describe("formats primitive", () => {
    it("'undefined' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "string" });
      expect(await formatter.formatPropertyValue(field, undefined)).to.be.eq("");
    });

    it("'string' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "string" });
      expect(await formatter.formatPropertyValue(field, "TestValue")).to.be.eq("TestValue");
    });

    it("'bool' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "bool" });
      expect(await formatter.formatPropertyValue(field, true)).to.be.eq("@Presentation:value.true@");
      expect(await formatter.formatPropertyValue(field, false)).to.be.eq("@Presentation:value.false@");
    });

    it("'double' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "double" });
      expect(await formatter.formatPropertyValue(field, 1.5)).to.be.eq("1.50");
      expect(await formatter.formatPropertyValue(field, 1.2345)).to.be.eq("1.23");
    });

    it("'int' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "int" });
      expect(await formatter.formatPropertyValue(field, 5)).to.be.eq("5");
    });

    it("'dateTime' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "dateTime" });
      expect(await formatter.formatPropertyValue(field, "2023-03-27:12:00:00")).to.be.eq("2023-03-27:12:00:00");
    });

    it("'point2d' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point2d" });
      expect(await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678 })).to.be.eq("X: 1.23; Y: 5.68");
    });

    it("'point3d' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point3d" });
      expect(await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678, z: 1.234 })).to.be.eq("X: 1.23; Y: 5.68; Z: 1.23");
    });

    it("'point3d' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "navigation" });
      const value: NavigationPropertyValue = { id: "0x1", className: "Schema:Class", label: LabelDefinition.fromLabelString("Test Target Instance") };
      expect(await formatter.formatPropertyValue(field, value)).to.be.eq("Test Target Instance");
    });

    it("KOQ property value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "double" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      formatMock.resolves("formatted value");
      const result = await formatter.formatPropertyValue(field, 1.5, "metric");
      expect(formatMock).to.be.calledOnceWith(1.5, { koqName: "KOQProp", unitSystem: "metric" });
      expect(result).to.be.eq("formatted value");
    });

    it("KOQ point2d property value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point2d" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      formatMock.resolves("formatted value");
      const result = await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678 }, "metric");
      expect(formatMock).to.be.calledTwice;
      expect(formatMock.firstCall).to.be.calledWith(1.234, { koqName: "KOQProp", unitSystem: "metric" });
      expect(formatMock.secondCall).to.be.calledWith(5.678, { koqName: "KOQProp", unitSystem: "metric" });
      expect(result).to.be.eq("X: formatted value; Y: formatted value");
    });

    it("KOQ point3d property value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point3d" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      formatMock.resolves("formatted value");
      const result = await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678, z: 1.234 }, "metric");
      expect(formatMock).to.be.calledThrice;
      expect(formatMock.firstCall).to.be.calledWith(1.234, { koqName: "KOQProp", unitSystem: "metric" });
      expect(formatMock.secondCall).to.be.calledWith(5.678, { koqName: "KOQProp", unitSystem: "metric" });
      expect(formatMock.thirdCall).to.be.calledWith(1.234, { koqName: "KOQProp", unitSystem: "metric" });
      expect(result).to.be.eq("X: formatted value; Y: formatted value; Z: formatted value");
    });

    it("KOQ property value without KOQ metadata", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "double" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      formatMock.resolves(undefined);
      expect(await formatter.formatPropertyValue(field, 1.5)).to.be.eq("1.50");
    });
  });

  describe("formats struct", () => {
    it("'undefined' value", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Struct,
        typeName: "struct",
        members: [{ name: "doubleProp", label: "Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } }],
      });
      const formattedValue = (await formatter.formatPropertyValue(field, undefined)) as DisplayValuesMap;
      expect(Object.keys(formattedValue)).to.be.empty;
    });

    it("value without members", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Struct, typeName: "struct", members: [] });
      const formattedValue = (await formatter.formatPropertyValue(field, {})) as DisplayValuesMap;
      expect(Object.keys(formattedValue)).to.be.empty;
    });

    it("value with different type members", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Struct,
        typeName: "struct",
        members: [
          { name: "doubleProp", label: "Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } },
          { name: "intProp", label: "Int Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "int" } },
          { name: "pointProp", label: "Point Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "point2d" } },
        ],
      });

      const structValue = {
        doubleProp: 1.5,
        intProp: 1,
        boolProp: false,
        pointProp: { x: 1.234, y: 4.567 },
      };

      const formattedValue = (await formatter.formatPropertyValue(field, structValue)) as DisplayValuesMap;
      expect(Object.keys(formattedValue)).to.have.lengthOf(3);
      expect(formattedValue.doubleProp).to.be.eq("1.50");
      expect(formattedValue.intProp).to.be.eq("1");
      expect(formattedValue.pointProp).to.be.eq("X: 1.23; Y: 4.57");
    });

    it("value with struct members", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Struct,
        typeName: "struct",
        members: [
          { name: "doubleProp", label: "Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } },
          {
            name: "structProp",
            label: "Struct Property",
            type: {
              valueFormat: PropertyValueFormat.Struct,
              typeName: "struct",
              members: [
                { name: "nestedDoubleProp", label: "Nested Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } },
                { name: "nestedIntProp", label: "Nested Int Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "int" } },
              ],
            },
          },
        ],
      });

      const structValue = {
        doubleProp: 1.5,
        structProp: {
          nestedDoubleProp: 2.5,
          nestedIntProp: 1,
        },
      };

      const formattedValue = (await formatter.formatPropertyValue(field, structValue)) as DisplayValuesMap;
      expect(Object.keys(formattedValue)).to.have.lengthOf(2);
      expect(formattedValue.doubleProp).to.be.eq("1.50");
      const structProp = formattedValue.structProp as DisplayValuesMap;
      expect(Object.keys(structProp)).to.have.lengthOf(2);
      expect(structProp.nestedDoubleProp).to.be.eq("2.50");
      expect(structProp.nestedIntProp).to.be.eq("1");
    });
  });

  describe("formats array", () => {
    it("'undefined' value", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Array,
        typeName: "array",
        memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
      });
      const formattedValue = (await formatter.formatPropertyValue(field, undefined)) as DisplayValuesArray;
      expect(formattedValue).to.be.empty;
    });

    it("empty value", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Array,
        typeName: "array",
        memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
      });
      const formattedValue = (await formatter.formatPropertyValue(field, [])) as DisplayValuesArray;
      expect(formattedValue).to.be.empty;
    });

    it("value with primitive items", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Array,
        typeName: "array",
        memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" },
      });
      const formattedValue = (await formatter.formatPropertyValue(field, [1.234, 5.678])) as DisplayValuesArray;
      expect(formattedValue).to.have.lengthOf(2);
      expect(formattedValue[0]).to.be.eq("1.23");
      expect(formattedValue[1]).to.be.eq("5.68");
    });

    it("value with struct items", async () => {
      const field = createField({
        valueFormat: PropertyValueFormat.Array,
        typeName: "array",
        memberType: {
          valueFormat: PropertyValueFormat.Struct,
          typeName: "struct",
          members: [
            { name: "doubleProp", label: "Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } },
            { name: "pointProp", label: "Point Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "point2d" } },
          ],
        },
      });

      const value = [
        {
          doubleProp: 1.234,
          pointProp: { x: 1.5, y: 5.678 },
        },
        {
          doubleProp: 0.2,
          pointProp: { x: 3, y: 4 },
        },
      ];

      const formattedValue = (await formatter.formatPropertyValue(field, value)) as DisplayValuesArray;
      expect(formattedValue).to.have.lengthOf(2);
      const item1 = formattedValue[0] as DisplayValuesMap;
      expect(item1.doubleProp).to.be.eq("1.23");
      expect(item1.pointProp).to.be.eq("X: 1.50; Y: 5.68");
      const item2 = formattedValue[1] as DisplayValuesMap;
      expect(item2.doubleProp).to.be.eq("0.20");
      expect(item2.pointProp).to.be.eq("X: 3.00; Y: 4.00");
    });
  });
});
