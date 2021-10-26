/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Primitives } from "@itwin/appui-abstract";
import { CompositeTypeConverter } from "../../components-react/converters/CompositeTypeConverter";
import TestUtils from "../TestUtils";

describe("CompositeTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: CompositeTypeConverter;

  beforeEach(() => {
    converter = new CompositeTypeConverter();
  });

  describe("convertToString", () => {

    it("returns correct string", async () => {
      const compositeValue: Primitives.Composite = {
        separator: "*",
        parts: [
          {
            displayValue: "FirstPart",
            rawValue: "FirstPart",
            typeName: "string",
          },
          {
            displayValue: "SecondPart - InnerPart",
            rawValue: {
              separator: " - ",
              parts: [
                {
                  displayValue: "SecondPart",
                  rawValue: "SecondPart",
                  typeName: "string",
                },
                {
                  displayValue: "InnerPart",
                  rawValue: "InnerPart",
                  typeName: "string",
                },
              ],
            },
            typeName: "composite",
          },
        ],
      };
      expect(await converter.convertToString(compositeValue)).to.equal("FirstPart*SecondPart - InnerPart");
    });

    it("returns empty string when value is undefined", () => {
      expect(converter.convertToString(undefined)).to.equal("");
    });

  });

  describe("sortCompare", () => {
    let lhs: Primitives.Composite;
    let rhs: Primitives.Composite;

    beforeEach(() => {
      lhs = {
        separator: "*",
        parts: [
          {
            displayValue: "first",
            rawValue: "first",
            typeName: "string",
          },
        ],
      };

      rhs = {
        separator: "*",
        parts: [
          {
            displayValue: "first",
            rawValue: "first",
            typeName: "string",
          },
        ],
      };
    });

    it("returns correct value when parts have different values", () => {
      rhs.parts[0].displayValue = "second";
      rhs.parts[0].rawValue = "second";
      expect(converter.sortCompare(lhs, rhs)).to.lessThan(0);
    });

    it("returns correct value when composite values has different separators", () => {
      rhs.separator = "-";
      expect(converter.sortCompare(lhs, rhs)).to.greaterThan(0);
    });

    it("returns correct value when composite values has different parts count", () => {
      rhs.parts.push({
        displayValue: "second",
        rawValue: "second",
        typeName: "string",
      });
      expect(converter.sortCompare(lhs, rhs)).to.lessThan(0);
    });

    it("returns 0 when parts have different types but same display value", () => {
      rhs.parts[0].typeName = "int";
      expect(converter.sortCompare(lhs, rhs)).to.equal(0);
    });

    it("returns 0 when composite all parts are equal", () => {
      const part = {
        displayValue: "second",
        rawValue: "second",
        typeName: "string",
      };
      lhs.parts.push(part);
      rhs.parts.push(part);
      expect(converter.sortCompare(lhs, rhs)).to.equal(0);
    });

    it("returns 0 when composite values are equal ignoring case", () => {
      rhs.parts[0].displayValue = "FIRST";
      rhs.parts[0].rawValue = "FIRST";
      expect(converter.sortCompare(lhs, rhs, true)).to.equal(0);
    });
  });
});
