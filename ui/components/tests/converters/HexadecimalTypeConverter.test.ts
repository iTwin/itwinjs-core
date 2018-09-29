/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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

  it("convertToString", async () => {
    expect(await converter.convertToString(0xff)).to.equal("FF");
    expect(await converter.convertToString(0x000000ff)).to.equal("FF");
    expect(await converter.convertToString(0xaabbcc)).to.equal("AABBCC");
    expect(await converter.convertToString(0xaabbccff)).to.equal("AABBCCFF");
    expect(await converter.convertToString(null)).to.have.length(0);
  });

  it("convertFromString", async () => {
    expect(await converter.convertFromString("FF")).to.equal(0x000000ff);
    expect(await converter.convertFromString("0xFF")).to.equal(0x000000ff);
    expect(await converter.convertFromString("0x000000FF")).to.equal(0x000000ff);
    expect(await converter.convertFromString("AABBCC")).to.equal(0xaabbcc);
    expect(await converter.convertFromString("AABBCCFF")).to.equal(0xaabbccff);
    expect(await converter.convertFromString("0xAABBCCFF")).to.equal(0xaabbccff);
  });

  it("convertFromString passed invalid values", async () => {
    expect(await converter.convertFromString((null as any))).to.be.undefined;
    expect(await converter.convertFromString((undefined as any))).to.be.undefined;
  });

  it("sortCompare", () => {
    expect(converter.sortCompare(0xff0000ff, 0x000000ff)).to.be.greaterThan(0);
    expect(converter.sortCompare(0x000000ff, 0xff0000ff)).to.be.lessThan(0);
    expect(converter.sortCompare(0xff0000ff, 0xff0000ff)).to.equal(0);
  });

});
