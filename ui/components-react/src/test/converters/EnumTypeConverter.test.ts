/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PropertyDescription } from "@itwin/appui-abstract";
import { EnumTypeConverter } from "../../components-react";
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

  describe("convertPropertyToString", () => {
    it("returns property enum label if provided value matches", async () => {
      expect(await converter.convertPropertyToString(propertyDescription, 100)).to.equal(colorNames[0]);
      expect(await converter.convertPropertyToString(propertyDescription, 103)).to.equal(colorNames[3]);
      expect(await converter.convertPropertyToString(propertyDescription, 105)).to.equal(colorNames[5]);
    });

    it("returns stringified value if provided value does not match", async () => {
      expect(await converter.convertPropertyToString(propertyDescription, 0)).to.equal("0");
      expect(await converter.convertPropertyToString(propertyDescription, 1000)).to.equal("1000");
    });

    it("returns stringified value if property description does not have enum", async () => {
      const propDescription: PropertyDescription = { ...propertyDescription, enum: undefined };
      expect(await converter.convertPropertyToString(propDescription, 0)).to.equal("0");
      expect(await converter.convertPropertyToString(propDescription, 1000)).to.equal("1000");
    });

    it("returns empty string when value is undefined", async () => {
      expect(await converter.convertPropertyToString(propertyDescription, undefined)).to.equal("");
    });

    it("returns empty string when value is undefined", async () => {
      expect(await converter.convertPropertyToString(propertyDescription, undefined)).to.equal("");
    });
  });

  describe("sortCompare", () => {
    it("returns 0 when comparing equal numeric enums", () => {
      expect(converter.sortCompare(10, 10)).to.equal(0);
    });

    it("returns 0 when comparing equal string enums", () => {
      expect(converter.sortCompare("TEN", "TEN")).to.equal(0);
    });

    it("returns greater than 0 when comparing numeric enums and first enum is bigger", () => {
      expect(converter.sortCompare(15, 10)).to.greaterThan(0);
    });

    it("returns greater than 0 when comparing string enums and first enum's value is bigger", () => {
      expect(converter.sortCompare("BBB", "AAA")).to.greaterThan(0);
    });
  });
});
