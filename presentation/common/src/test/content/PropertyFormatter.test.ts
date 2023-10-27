/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import { KoqPropertyValueFormatter, LabelDefinition, PropertyValueFormat, TypeDescription } from "../../presentation-common";
import { Content } from "../../presentation-common/content/Content";
import { ContentFormatter, ContentPropertyValueFormatter } from "../../presentation-common/content/PropertyValueFormatter";
import { DisplayValuesArray, DisplayValuesMap, NavigationPropertyValue, NestedContentValue } from "../../presentation-common/content/Value";
import {
  createTestContentDescriptor, createTestContentItem, createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo,
} from "../_helpers";

describe("ContentPropertyValueFormatter", () => {
  let formatter: ContentFormatter;
  const propertyValueFormatterMock = moq.Mock.ofType<ContentPropertyValueFormatter>();
  const koqField = createTestPropertiesContentField({
    name: "koqFieldName",
    properties: [{
      property: createTestPropertyInfo({ name: "koqProperty", kindOfQuantity: { label: "Koq Props", name: "TestSchema:TestKoq", persistenceUnit: "Units:M" } }),
    }],
  });
  const simplePropField = createTestPropertiesContentField({
    name: "simpleFieldName",
    properties: [{
      property: createTestPropertyInfo({ name: "simpleProperty" }),
    }],
  });

  beforeEach(() => {
    propertyValueFormatterMock.setup(async (x) => x.formatPropertyValue(moq.It.isAny(), moq.It.isAny(), moq.It.isAny())).returns(async () => "FormattedValue");
    formatter = new ContentFormatter(propertyValueFormatterMock.object);
  });

  afterEach(() => {
    propertyValueFormatterMock.reset();
  });

  it("formats content item value", async () => {
    const descriptor = createTestContentDescriptor({ fields: [koqField, simplePropField] });
    const contentItem = createTestContentItem({
      displayValues: {
      },
      values: {
        [koqField.name]: 1.5,
        [simplePropField.name]: "1.5",
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("FormattedValue");
    expect(formattedContent.contentSet[0].displayValues[simplePropField.name]).to.be.eq("FormattedValue");
  });

  it("formats nested content item value", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [koqField, simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
    const contentItem = createTestContentItem({
      displayValues: {
      },
      values: {
        [nestedContentField.name]: [{
          displayValues: {
          },
          values: {
            [koqField.name]: 1.5,
            [simplePropField.name]: "1.5",
          },
          primaryKeys: [],
          mergedFieldNames: [],
        }],
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    const nestedContentValue = formattedContent.contentSet[0].values[nestedContentField.name] as NestedContentValue[];
    expect(nestedContentValue[0].displayValues[koqField.name]).to.be.eq("FormattedValue");
    expect(nestedContentValue[0].displayValues[simplePropField.name]).to.be.eq("FormattedValue");
  });

  it("handles merged nested field", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField, koqField] });
    const contentItem = createTestContentItem({
      displayValues: {
      },
      values: {
        [nestedContentField.name]: undefined,
        [koqField.name]: 1.5,
      },
      mergedFieldNames: [nestedContentField.name],
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[nestedContentField.name]).to.be.eq("@Presentation:label.varies@");
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("FormattedValue");
  });
});

describe("ContentPropertyValueFormatter", () => {
  let formatter: ContentPropertyValueFormatter;
  const koqFormatterMock = moq.Mock.ofType<KoqPropertyValueFormatter>();

  beforeEach(() => {
    formatter = new ContentPropertyValueFormatter(koqFormatterMock.object);
  });

  afterEach(() => {
    koqFormatterMock.reset();
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
      koqFormatterMock.setup(async (x) => x.format(moq.It.isAny(), moq.It.is((options) => options.unitSystem === "metric"))).returns(async (raw: number) => `${raw.toFixed(2)} M`);
      expect(await formatter.formatPropertyValue(field, 1.5, "metric")).to.be.eq("1.50 M");
    });

    it("KOQ point2d property value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point2d" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      koqFormatterMock.setup(async (x) => x.format(moq.It.isAny(), moq.It.is((options) => options.unitSystem === "metric"))).returns(async (raw: number) => `${raw.toFixed(2)} M`);
      expect(await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678 }, "metric")).to.be.eq("X: 1.23 M; Y: 5.68 M");
    });

    it("KOQ point3d property value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "point3d" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      koqFormatterMock.setup(async (x) => x.format(moq.It.isAny(), moq.It.is((options) => options.unitSystem === "metric"))).returns(async (raw: number) => `${raw.toFixed(2)} M`);
      expect(await formatter.formatPropertyValue(field, { x: 1.234, y: 5.678, z: 1.234 }, "metric")).to.be.eq("X: 1.23 M; Y: 5.68 M; Z: 1.23 M");
    });

    it("KOQ property value without KOQ metadata", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Primitive, typeName: "double" });
      field.properties = [{ property: createTestPropertyInfo({ kindOfQuantity: { label: "KOQ Label", name: "KOQProp", persistenceUnit: "Unit" } }) }];
      koqFormatterMock.setup(async (x) => x.format(1.5, moq.It.isAny())).returns(async () => undefined);
      expect(await formatter.formatPropertyValue(field, 1.5)).to.be.eq("1.50");
    });
  });

  describe("formats struct", () => {
    it("'undefined' value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Struct, typeName: "struct", members: [{ name: "doubleProp", label: "Double Property", type: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } }] });
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
            name: "structProp", label: "Struct Property", type: {
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
      const field = createField({ valueFormat: PropertyValueFormat.Array, typeName: "array", memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } });
      const formattedValue = (await formatter.formatPropertyValue(field, undefined)) as DisplayValuesArray;
      expect(formattedValue).to.be.empty;
    });

    it("empty value", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Array, typeName: "array", memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } });
      const formattedValue = (await formatter.formatPropertyValue(field, [])) as DisplayValuesArray;
      expect(formattedValue).to.be.empty;
    });

    it("value with primitive items", async () => {
      const field = createField({ valueFormat: PropertyValueFormat.Array, typeName: "array", memberType: { valueFormat: PropertyValueFormat.Primitive, typeName: "double" } });
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

      const value = [{
        doubleProp: 1.234,
        pointProp: { x: 1.5, y: 5.678 },
      }, {
        doubleProp: 0.2,
        pointProp: { x: 3, y: 4 },
      }];

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

