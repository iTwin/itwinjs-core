/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TypeConverter } from "../../src/index";
import { PropertyValue, PropertyValueFormat, PropertyDescription, PropertyRecord, PrimitiveValue } from "../../src/properties";
import TestUtils from "../TestUtils";

describe("TypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: TypeConverter;

  beforeEach(() => {
    converter = new TypeConverter();
  });

  it("convertToString", async () => {
    expect(await converter.convertToString("abc")).to.equal("abc");
    expect(await converter.convertToString(100)).to.equal("100");
  });

  it("convertToString passed invalid values", async () => {
    expect(await converter.convertToString(null)).to.equal("");
    expect(await converter.convertToString(undefined)).to.equal("");
  });

  it("Base convertFromString returns undefined", async () => {
    expect(await converter.convertFromString("abc")).to.be.undefined;
  });

  const createPropertyValue = (value?: string): PropertyValue => {
    const v: PropertyValue = {
      valueFormat: PropertyValueFormat.Primitive,
      displayValue: value ? value : "",
      value,
    };
    return v;
  };

  const createPropertyDescription = (): PropertyDescription => {
    const pd: PropertyDescription = {
      typename: "text",
      name: "key",
      displayLabel: "label",
    };
    return pd;
  };

  const createPropertyRecord = (value?: string): PropertyRecord => {
    const v = createPropertyValue(value);
    const pd = createPropertyDescription();
    return new PropertyRecord(v, pd);
  };

  it("convertPropertyToString", async () => {
    const stringValue = await converter.convertPropertyToString(createPropertyDescription(), "abc");
    expect(stringValue).to.equal("abc");
    expect(await converter.convertPropertyToString(createPropertyDescription(), null)).to.equal("");
    expect(await converter.convertPropertyToString(createPropertyDescription(), undefined)).to.equal("");
  });

  it("Base convertFromStringToPropertyValue returns undefined value", async () => {
    const propertyValue = await converter.convertFromStringToPropertyValue("def", createPropertyRecord("abc"));
    expect((propertyValue as PrimitiveValue).value).to.be.undefined;
  });

  it("isEqualTo", () => {
    expect(converter.isEqualTo(0, 0)).to.be.true;
    expect(converter.isEqualTo(1, 0)).to.be.false;
  });

  it("isNotEqualTo", () => {
    expect(converter.isNotEqualTo(0, 0)).to.be.false;
    expect(converter.isNotEqualTo(1, 0)).to.be.true;
  });

  it("Type methods", () => {
    expect(converter.isStringType).to.be.false;
    expect(converter.isLessGreaterType).to.be.false;
    expect(converter.isNullableType).to.be.false;
    expect(converter.isBooleanType).to.be.false;
  });

});
