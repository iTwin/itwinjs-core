/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getCssVariable } from "../../core-react";

// NOTE: CSS Custom Properties don't work in Jsdom

describe.skip("getCssVariable", () => {

  it("should read a CSS variable from document", () => {
    const variableName = "--test-variable";
    const testValue = "Hello World!";

    document.documentElement.style.setProperty(variableName, testValue);
    const test = getComputedStyle(document.documentElement, null).getPropertyValue(variableName);
    expect(test).to.eq(testValue);

    const variableValue = getCssVariable(variableName);
    expect(variableValue).to.eq(testValue);
  });

  it("should read a CSS variable from an element", () => {
    const variableName = "--test-variable";
    const testValue = "Hello World!";

    const element = document.createElement("div");
    document.body.appendChild(element);
    element.style.setProperty(variableName, testValue);

    const variableValue = getCssVariable(variableName, element);
    expect(variableValue).to.eq(testValue);
  });

});
