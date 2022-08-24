/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { getCssVariable, getCssVariableAsNumber } from "../../core-react";

// NOTE: CSS Custom Properties don't work in Jsdom, stubbing global function instead.
const VARIABLE_NAME = "--test-variable";
function fakeGetComputedStyle(value: string | null) {
  const style = new CSSStyleDeclaration();
  style.setProperty(VARIABLE_NAME, value);
  return sinon.replace(globalThis, "getComputedStyle", sinon.fake.returns(style));
}

describe("getCssVariable", () => {
  it("should read a CSS variable from document", () => {
    const testValue = "Hello World!";
    const spy = fakeGetComputedStyle(testValue);

    expect(getCssVariable(VARIABLE_NAME)).to.eq(testValue);
    expect(spy).to.have.been.calledWith(document.documentElement, null);
  });

  it("should read a CSS variable from an element", () => {
    const testValue = "Hello World!";
    const spy = fakeGetComputedStyle(testValue);
    const element = document.createElement("div");

    expect(getCssVariable(VARIABLE_NAME, element)).to.eq(testValue);
    expect(spy).to.have.been.calledWith(element, null);
  });

});

describe("getCssVariableAsNumber", () => {

  it("should read a CSS variable from document", () => {
    const testValue = "12.345";
    const expectedValue = 12.345;
    const spy = fakeGetComputedStyle(testValue);

    expect(getCssVariableAsNumber(VARIABLE_NAME)).to.eq(expectedValue);
    expect(spy).to.have.been.calledWith(document.documentElement, null);
  });

  it("should read a CSS variable from an element", () => {
    const testValue = "12.345";
    const expectedValue = 12.345;
    const spy = fakeGetComputedStyle(testValue);
    const element = document.createElement("div");

    expect(getCssVariableAsNumber(VARIABLE_NAME, element)).to.eq(expectedValue);
    expect(spy).to.have.been.calledWith(element, null);
  });

  it("should return NaN if the property is undefined", () => {
    const spy = sinon.spy(globalThis, "getComputedStyle");

    expect(getCssVariableAsNumber(VARIABLE_NAME)).to.be.NaN;
    expect(spy).to.have.been.calledWith(document.documentElement, null);
  });
});
