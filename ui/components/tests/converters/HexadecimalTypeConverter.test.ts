/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { HexadecimalTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("HexadecimalTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: HexadecimalTypeConverter;

  beforeEach(() => {
    converter = new HexadecimalTypeConverter();
  });

  describe("convertToString", () => {
    it("returns correct string", async () => {
      expect(await converter.convertToString("0xff")).to.equal("0xFF");
      expect(await converter.convertToString("0xaabbcc")).to.equal("0xAABBCC");
      expect(await converter.convertToString("0xaabbccff")).to.equal("0xAABBCCFF");
    });

    it("returns empty string when value is undefined", async () => {
      expect(await converter.convertToString(undefined)).to.equal("");
    });
  });

  describe("convertFromString", () => {
    it("returns correct values", async () => {
      expect(await converter.convertFromString("FF")).to.be.eq("0xff");
      expect(await converter.convertFromString("0xFF")).to.be.eq("0xff");
      expect(await converter.convertFromString("0x000000FF")).to.be.eq("0xff");
      expect(await converter.convertFromString("AABBCC")).to.be.eq("0xaabbcc");
      expect(await converter.convertFromString("AABBCCFF")).to.be.eq("0xaabbccff");
      expect(await converter.convertFromString("0xAABBCCFF")).to.be.eq("0xaabbccff");
    });

    it("returns undefined when string is incorrect", async () => {
      expect(await converter.convertFromString("GFF")).to.be.undefined;
    });
  });

  describe("sortCompare", () => {
    it("returns correct values when number is lower than 2^32", () => {
      expect(converter.sortCompare("0xff0000ff", "0x000000ff")).to.be.greaterThan(0);
      expect(converter.sortCompare("0x000000ff", "0xff0000ff")).to.be.lessThan(0);
      expect(converter.sortCompare("0xff0000ff", "0xff0000ff")).to.equal(0);
    });

    it("returns correct values when number is bigger than 2^32", () => {
      expect(converter.sortCompare("0xff000000ff0000ff", "000000000x000000ff")).to.be.greaterThan(0);
      expect(converter.sortCompare("0x00000000000000ff", "0xff000000ff0000ff")).to.be.lessThan(0);
      expect(converter.sortCompare("0xff000000ff0000ff", "0xff000000ff0000ff")).to.equal(0);
    });

    it("returns 0 even when strings are represented slightly differently", () => {
      expect(converter.sortCompare("0xff", "0x00ff")).to.equal(0);
      expect(converter.sortCompare("0xFF", "0xff")).to.equal(0);
      expect(converter.sortCompare("0xFF", "0x00ff")).to.equal(0);
    });
  });
});
