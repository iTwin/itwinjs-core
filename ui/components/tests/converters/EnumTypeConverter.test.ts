/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EnumTypeConverter, PropertyDescription } from "../../src/index";
import TestUtils from "../TestUtils";

describe("EnumTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: EnumTypeConverter;
  const colorNames = ["Yellow", "Red", "Green", "Blue", "Violet", "Cyan"];
  const propertyDescription: PropertyDescription = {
    name: "column1",
    displayLabel: "column1",
    typename: "enum",
    enum: {
      choices: [
        { label: colorNames[0], value: 100 },
        { label: colorNames[1], value: 101 },
        { label: colorNames[2], value: 102 },
        { label: colorNames[3], value: 103 },
        { label: colorNames[4], value: 104 },
        { label: colorNames[5], value: 105 },
      ],
    },
  };

  beforeEach(() => {
    converter = new EnumTypeConverter();
  });

  it("convertPropertyToString", async () => {
    expect(await converter.convertPropertyToString(propertyDescription, 100)).to.equal(colorNames[0]);
    expect(await converter.convertPropertyToString(propertyDescription, 103)).to.equal(colorNames[3]);
    expect(await converter.convertPropertyToString(propertyDescription, 105)).to.equal(colorNames[5]);
    expect(await converter.convertPropertyToString(propertyDescription, 0)).to.equal("0");
    expect(await converter.convertPropertyToString(propertyDescription, 1000)).to.equal("1000");
  });

});
