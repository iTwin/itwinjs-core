/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

  it("covertToString", async () => {
    expect(await converter.convertToString("ABCdefGhIjK!@#$%^&*")).to.equal("ABCdefGhIjK!@#$%^&*");
    expect(await converter.convertToString(null)).to.equal("");
  });

  it("convertFromString", async () => {
    expect(await converter.convertFromString("ABCdefGhIjK!@#$%^&*")).to.equal("ABCdefGhIjK!@#$%^&*");
  });

  it("sortCompare", () => {
    expect(converter.sortCompare("ABCDEFG", "abcdefg")).to.be.greaterThan(0);
    expect(converter.sortCompare("abcdefg", "ABCDEFG")).to.be.lessThan(0);
    expect(converter.sortCompare("ABCDEFG", "ABCDEFG")).to.equal(0);
    expect(converter.sortCompare("abcdefg", "ABCDEFG", true)).to.equal(0);
    expect(converter.sortCompare("ABCDEFG", "abcdefg", true)).to.equal(0);
    expect(converter.sortCompare(null, "abcdefg", true)).to.equal(0);
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
