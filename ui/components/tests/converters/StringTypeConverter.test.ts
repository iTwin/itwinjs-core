/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { StringTypeConverter } from "../../src/index";
import TestUtils from "../TestUtils";

describe("StringTypeConverter", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  let converter: StringTypeConverter;

  beforeEach(() => {
    converter = new StringTypeConverter();
  });

  describe("convertToString", () => {
    it("returns same string", async () => {
      expect(await converter.convertToString("ABCdefGhIjK!@#$%^&*")).to.equal("ABCdefGhIjK!@#$%^&*");
    });

    it("returns empty string if given string is undefined", async () => {
      expect(await converter.convertToString(undefined)).to.equal("");
    });
  });

  describe("convertFromString", () => {
    it("returns same string", async () => {
      expect(await converter.convertFromString("ABCdefGhIjK!@#$%^&*")).to.equal("ABCdefGhIjK!@#$%^&*");
    });
  });

  describe("sortCompare", () => {
    it("returns 0 if strings are equal", () => {
      expect(converter.sortCompare("ABCDEFG", "ABCDEFG")).to.equal(0);
    });

    it("returns non 0 number if strings are equal but letter case is different", () => {
      expect(converter.sortCompare("ABCDEFG", "abcdefg", false)).to.greaterThan(0);
      expect(converter.sortCompare("abcdefg", "ABCDEFG", false)).to.lessThan(0);
    });

    it("returns 0 if strings are equal when ignoring lower case", () => {
      expect(converter.sortCompare("abcdefg", "ABCDEFG", true)).to.equal(0);
      expect(converter.sortCompare("ABCDEFG", "abcdefg", true)).to.equal(0);
    });
  });

  it("isStringType", () => {
    expect(converter.isStringType).to.be.true;
  });

  it("startsWith", () => {
    expect(converter.startsWith("The Test", "The", true)).to.be.true;
    expect(converter.startsWith("The Test", "the", false)).to.be.true;
    expect(converter.startsWith("The Test", "", false)).to.be.false;
  });

  it("endsWith", () => {
    expect(converter.endsWith("The Test", "Test", true)).to.be.true;
    expect(converter.endsWith("The Test", "test", false)).to.be.true;
    expect(converter.endsWith("The Test", "", false)).to.be.false;
    expect(converter.endsWith("Test", "The Test", false)).to.be.false;
  });

  it("contains", () => {
    expect(converter.contains("The contains Test", "contains", true)).to.be.true;
    expect(converter.contains("The contains Test", "Contains", false)).to.be.true;
    expect(converter.contains("The contains Test", "", false)).to.be.false;
    expect(converter.contains("Test", "The contains Test", false)).to.be.false;
  });

  it("doesNotContain", () => {
    expect(converter.doesNotContain("The contains Test", "Some Text", true)).to.be.true;
    expect(converter.doesNotContain("The contains Test", "some text", false)).to.be.true;
  });

  it("isContainedIn", () => {
    expect(converter.isContainedIn("contains", "The contains Test", true)).to.be.true;
    expect(converter.isContainedIn("Contains", "The contains Test", false)).to.be.true;
  });

  it("isNotContainedIn", () => {
    expect(converter.isNotContainedIn("Contain", "The contains Test", true)).to.be.true;
    expect(converter.isNotContainedIn("Contain", "The contains Test", false)).to.be.false;
  });

  it("isEmpty", () => {
    expect(converter.isEmpty("")).to.be.true;
  });

  it("isNotEmpty", () => {
    expect(converter.isNotEmpty("not empty")).to.be.true;
  });

  it("isStringType", () => {
    expect(converter.isStringType).to.be.true;
  });

});
