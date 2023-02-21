/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import { FormatProps, UnitsProvider } from "@itwin/core-quantity";
import { Content } from "../presentation-common/content/Content";
import { NestedContentValue } from "../presentation-common/content/Value";
import { ContentPropertyFormatter, PropertyFormatter } from "../presentation-common/PropertyFormatter";
import {
  createTestContentDescriptor, createTestContentItem, createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo,
} from "./_helpers";

describe("PropertyFormatter", () => {
  let formatter: PropertyFormatter;
  const unitsProviderMock = moq.Mock.ofType<UnitsProvider>();
  const testPersistenceUnitName = "TestSchema:TestUnit";
  const testFormatProps: FormatProps = {
    type: "decimal",
    decimalSeparator: ",",
  };

  beforeEach(() => {
    unitsProviderMock
      .setup(async (x) => x.findUnitByName("TestSchema:TestUnit"))
      .returns(async () => ({
        name: "TestUnit",
        label: "Test Unit",
        phenomenon: "TestPhenomenon",
        isValid: true,
        system: "TestSystem",
      }));
    unitsProviderMock
      .setup(async (x) => x.getUnitsByFamily("TestPhenomenon"))
      .returns(async () => []);

    formatter = new PropertyFormatter(unitsProviderMock.object);
  });

  afterEach(() => {
    unitsProviderMock.reset();
  });

  it("creates FormatterSpec", async () => {
    const formatterSpec = await formatter.getFormatterSpec({
      name: "TestFormat",
      formatProps: testFormatProps,
      persistenceUnitName: testPersistenceUnitName,
    });
    expect(formatterSpec).to.not.be.undefined;
  });

  it("creates ParserSpec", async () => {
    const formatterSpec = await formatter.getParserSpec({
      name: "TestFormat",
      formatProps: testFormatProps,
      persistenceUnitName: testPersistenceUnitName,
    });
    expect(formatterSpec).to.not.be.undefined;
  });

  it("formats value", async () => {
    const formatted = await formatter.format(1.5, {
      name: "TestFormat",
      formatProps: testFormatProps,
      persistenceUnitName: testPersistenceUnitName,
    });
    expect(formatted).to.be.eq("1,5");
  });
});

describe("ContentPropertyFormatter", () => {
  let formatter: ContentPropertyFormatter;
  const unitsProviderMock = moq.Mock.ofType<UnitsProvider>();
  const testFormatProps: FormatProps = {
    type: "decimal",
    decimalSeparator: ",",
  };
  const testPersistenceUnitName = "TestSchema:TestUnit";
  const koqField = createTestPropertiesContentField({
    name: "koqFielName",
    properties: [{
      property: createTestPropertyInfo({ name: "koqProperty", kindOfQuantity: { label: "Koq Props", name: "koqProp", persistenceUnit: testPersistenceUnitName, activeFormat: testFormatProps } }),
    }],
  });
  const simplePropField = createTestPropertiesContentField({
    name: "simpleFieldName",
    properties: [{
      property: createTestPropertyInfo({ name: "simpleProperty" }),
    }],
  });

  beforeEach(() => {
    unitsProviderMock
      .setup(async (x) => x.findUnitByName("TestSchema:TestUnit"))
      .returns(async () => ({
        name: "TestUnit",
        label: "Test Unit",
        phenomenon: "TestPhenomenon",
        isValid: true,
        system: "TestSystem",
      }));

    formatter = new ContentPropertyFormatter(unitsProviderMock.object);
  });

  afterEach(() => {
    unitsProviderMock.reset();
  });

  it("formats content item value", async () => {
    const descriptor = createTestContentDescriptor({ fields: [koqField, simplePropField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [koqField.name]: "1.5",
        [simplePropField.name]: "1.5",
      },
      values: {
        [koqField.name]: 1.5,
        [simplePropField.name]: "1.5",
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("1,5");
    expect(formattedContent.contentSet[0].displayValues[simplePropField.name]).to.be.eq("1.5");
  });

  it("formats nested content item value", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [koqField, simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [nestedContentField.name]: {
          displayValues: {
            [koqField.name]: "1.5",
            [simplePropField.name]: "1.5",
          },
        },
      },
      values: {
        [nestedContentField.name]: [{
          displayValues: {
            [koqField.name]: "1.5",
            [simplePropField.name]: "1.5",
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
    expect(nestedContentValue[0].displayValues[koqField.name]).to.be.eq("1,5");
    expect(nestedContentValue[0].displayValues[simplePropField.name]).to.be.eq("1.5");
  });

  it("handles merged nested field", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField, koqField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [nestedContentField.name]: "*Merged*",
        [koqField.name]: "1.5",
      },
      values: {
        [nestedContentField.name]: undefined,
        [koqField.name]: 1.5,
      },
      mergedFieldNames: [nestedContentField.name],
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[nestedContentField.name]).to.be.eq("*Merged*");
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("1,5");
  });
});
