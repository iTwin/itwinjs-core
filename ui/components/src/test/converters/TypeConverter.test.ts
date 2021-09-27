/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { PrimitiveValue, PropertyConverterInfo, PropertyDescription } from "@itwin/appui-abstract";
import { TypeConverter } from "../../components-react";
import TestUtils from "../TestUtils";

describe("TypeConverter", () => {

  class TestTypeConverter extends TypeConverter {
    public sortCompare({ }, { }, _ignoreCase?: boolean | undefined): number {
      throw new Error("Method not implemented.");
    }
  }

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: TypeConverter;

  beforeEach(() => {
    converter = new TestTypeConverter();
  });

  describe("convertToString", () => {
    it("returns correct value", async () => {
      expect(await converter.convertToString("abc")).to.equal("abc");
      expect(await converter.convertToString(100)).to.equal("100");
    });

    it("returns empty string if value is undefined", async () => {
      expect(await converter.convertToString(undefined)).to.equal("");
    });
  });

  it("Base convertFromString returns undefined", async () => {
    expect(await converter.convertFromString("abc")).to.be.undefined;
  });

  const createPropertyDescription = (): PropertyDescription => {
    const pd: PropertyDescription = {
      typename: "text",
      name: "key",
      displayLabel: "label",
    };
    return pd;
  };

  it("convertPropertyToString", async () => {
    const stringValue = await converter.convertPropertyToString(createPropertyDescription(), "abc");
    expect(stringValue).to.equal("abc");
  });

  describe("convertFromStringToPropertyValue", async () => {
    it("returns property with empty value when convertFromString returns undefined", async () => {
      const converterMock = moq.Mock.ofType(TestTypeConverter, moq.MockBehavior.Loose);
      converterMock.callBase = true;
      converterMock.setup(async (mock) => mock.convertFromString(moq.It.isAny())).returns(async () => undefined);

      const propertyValue = await converterMock.object.convertFromStringToPropertyValue("def", TestUtils.createPrimitiveStringProperty("abc", "abc"));
      expect((propertyValue as PrimitiveValue).value).to.be.empty;
    });

    it("returns property with correct value when convertFromString also returns a correct value", async () => {
      const converterMock = moq.Mock.ofType(TestTypeConverter, moq.MockBehavior.Loose);
      converterMock.callBase = true;
      converterMock.setup(async (mock) => mock.convertFromString(moq.It.isAny())).returns(async (value: string) => value);

      const propertyRecord = TestUtils.createPrimitiveStringProperty("abc", "abc");
      const convertInfo: PropertyConverterInfo = { options: new Map([["test", "test"]]) };
      propertyRecord.property.converter = convertInfo;
      const propertyValue = await converterMock.object.convertFromStringToPropertyValue("def", propertyRecord);
      expect((propertyValue as PrimitiveValue).value).to.be.eq("def");
    });
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
    expect(converter.isBooleanType).to.be.false;
    expect(converter.isNullableType).to.be.true;
  });

});
