/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TypeConverterManager, TypeConverter, StringTypeConverter } from "../../src/index";

describe("TypeConverterManager", () => {

  class TestTypeConverter extends TypeConverter { }

  it("registerConverter for typename already registered ", async () => {
    expect(() => TypeConverterManager.registerConverter("text", TestTypeConverter)).to.throw(Error);
  });

  it("getConverter with invalid typename returns StringTypeConverter", async () => {
    const converter = TypeConverterManager.getConverter("badtype");
    expect(converter).to.be.instanceof(StringTypeConverter);
  });

  it("registerConverter registers and getConverter returns the same Converter", async () => {
    TypeConverterManager.registerConverter("testtype", TestTypeConverter);
    const converter = TypeConverterManager.getConverter("testtype");
    expect(converter).to.be.instanceof(TestTypeConverter);
  });

});
