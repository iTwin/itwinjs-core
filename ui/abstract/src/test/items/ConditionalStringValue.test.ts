/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ConditionalStringValue } from "../../ui-abstract";

const helloValue = "hello";
const goodByeValue = "goodBye";
const defaultValue = "default";
const helloFunc = () => helloValue;
const goodbyeFunc = () => goodByeValue;
const syncEventIds = ["sync-id-one", "sync-id-two", "sync-id-THREE"];

describe("ConditionalStringValue", () => {
  it("should construct without initial string value", () => {
    const sut = new ConditionalStringValue(helloFunc, syncEventIds);
    expect(sut.value).to.be.equal(helloValue);
  });

  it("should construct with initial value", () => {
    const sut = new ConditionalStringValue(helloFunc, syncEventIds, defaultValue);
    expect(sut.value).to.be.equal(defaultValue);
    expect(sut.refresh()).to.be.true;
    expect(sut.value).to.be.equal(helloValue);
  });

  it("should construct with initial value that matches stringGetter function", () => {
    const sut = new ConditionalStringValue(helloFunc, syncEventIds, helloValue);
    expect(sut.value).to.be.equal(helloValue);
    expect(sut.refresh()).to.be.false;
    expect(sut.value).to.be.equal(helloValue);
  });

  it("test static getValue method", () => {
    expect(ConditionalStringValue.getValue(undefined)).to.be.undefined;
    expect(ConditionalStringValue.getValue(helloValue)).to.be.equal(helloValue);
    expect(ConditionalStringValue.getValue(goodByeValue)).to.be.equal(goodByeValue);
    expect(ConditionalStringValue.getValue(new ConditionalStringValue(helloFunc, syncEventIds, defaultValue))).to.be.equal(defaultValue);
    expect(ConditionalStringValue.getValue(new ConditionalStringValue(goodbyeFunc, syncEventIds, defaultValue))).to.be.equal(defaultValue);
    expect(ConditionalStringValue.getValue(new ConditionalStringValue(helloFunc, syncEventIds))).to.be.equal(helloValue);
    expect(ConditionalStringValue.getValue(new ConditionalStringValue(goodbyeFunc, syncEventIds))).to.be.equal(goodByeValue);
  });

  it("test static refreshValue method", () => {
    const sut = new ConditionalStringValue(helloFunc, syncEventIds, defaultValue);
    expect(sut.value).to.be.equal(defaultValue);
    expect(ConditionalStringValue.refreshValue(sut, new Set<string>(["cat"]))).to.be.false;
    expect(sut.value).to.be.equal(defaultValue);
    expect(ConditionalStringValue.refreshValue(sut, new Set<string>(["sync-id-two"]))).to.be.true;
    expect(sut.value).to.be.equal(helloValue);
    expect(ConditionalStringValue.refreshValue(undefined, new Set<string>(["cat"]))).to.be.false;
  });

  it("test static refreshValue method with capitalized ids", () => {
    const sut = new ConditionalStringValue(helloFunc, syncEventIds, defaultValue);
    expect(sut.value).to.be.equal(defaultValue);
    expect(ConditionalStringValue.refreshValue(sut, new Set<string>(["cat"]))).to.be.false;
    expect(sut.value).to.be.equal(defaultValue);
    expect(ConditionalStringValue.refreshValue(sut, new Set<string>(["sync-id-three"]))).to.be.true;
    expect(sut.value).to.be.equal(helloValue);
    expect(ConditionalStringValue.refreshValue(undefined, new Set<string>(["cat"]))).to.be.false;
  });
});
