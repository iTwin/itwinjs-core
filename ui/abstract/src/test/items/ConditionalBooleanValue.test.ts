/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ConditionalBooleanValue } from "../../ui-abstract";

const trueFunc = () => true;
const falseFunc = () => false;
const syncEventIds = ["sync-id-one", "sync-id-two", "sync-id-THREE"];

describe("ConditionalBooleanValue", () => {
  it("should construct without initial boolean value", () => {
    const sut = new ConditionalBooleanValue(trueFunc, syncEventIds);
    expect(sut.value).to.be.true;
  });

  it("should construct with initial boolean value", () => {
    const sut = new ConditionalBooleanValue(trueFunc, syncEventIds, false);
    expect(sut.value).to.be.false;
    sut.refresh();
    expect(sut.value).to.be.true;
  });

  it("test static getValue method", () => {
    expect(ConditionalBooleanValue.getValue(undefined)).to.be.false;
    expect(ConditionalBooleanValue.getValue(false)).to.be.false;
    expect(ConditionalBooleanValue.getValue(true)).to.be.true;
    expect(ConditionalBooleanValue.getValue(new ConditionalBooleanValue(trueFunc, syncEventIds, false))).to.be.false;
    expect(ConditionalBooleanValue.getValue(new ConditionalBooleanValue(trueFunc, syncEventIds, true))).to.be.true;
    expect(ConditionalBooleanValue.getValue(new ConditionalBooleanValue(trueFunc, syncEventIds))).to.be.true;
    expect(ConditionalBooleanValue.getValue(new ConditionalBooleanValue(falseFunc, syncEventIds))).to.be.false;
  });

  it("test static refreshValue method", () => {
    const sut = new ConditionalBooleanValue(trueFunc, syncEventIds, false);
    expect(sut.value).to.be.false;
    expect(ConditionalBooleanValue.refreshValue(sut, new Set<string>(["cat"]))).to.be.false;
    expect(sut.value).to.be.false;
    expect(ConditionalBooleanValue.refreshValue(sut, new Set<string>(["sync-id-two"]))).to.be.true;
    expect(sut.value).to.be.true;
    expect(ConditionalBooleanValue.refreshValue(undefined, new Set<string>(["cat"]))).to.be.false;
  });

  it("test static refreshValue method with capitalized ids", () => {
    const sut = new ConditionalBooleanValue(trueFunc, syncEventIds, false);
    expect(sut.value).to.be.false;
    expect(ConditionalBooleanValue.refreshValue(sut, new Set<string>(["cat"]))).to.be.false;
    expect(sut.value).to.be.false;
    expect(ConditionalBooleanValue.refreshValue(sut, new Set<string>(["sync-id-three"]))).to.be.true;
    expect(sut.value).to.be.true;
    expect(ConditionalBooleanValue.refreshValue(undefined, new Set<string>(["cat"]))).to.be.false;
  });
});
