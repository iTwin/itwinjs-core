/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { IModelApp, MockRender } from "@bentley/imodeljs-frontend";
import TestUtils from "../TestUtils";
import { ParsedInput } from "../../ui-components/inputs/ParsedInput";
import { ParseResults, SpecialKey } from "@bentley/ui-abstract";

function fahrenheitToCelsius(f: number) {
  return (f - 32) * 5 / 9;
}

function parseStringToCelsius(userInput: string): ParseResults {
  let convertFromFahrenheit = false;
  let temperatureStr = userInput;
  // if explicitly specified honor specification
  if (userInput.endsWith("f") || userInput.endsWith("F")) {
    convertFromFahrenheit = true;
    temperatureStr = userInput.slice(0, userInput.length - 1);
  } else if (userInput.endsWith("c") || userInput.endsWith("C")) {
    convertFromFahrenheit = false;
    temperatureStr = userInput.slice(0, userInput.length - 1);
  }

  try {
    let temperature = Number.parseFloat(temperatureStr);
    if (Number.isNaN(temperature))
      return { parseError: "unable to parse temperature" };
    if (convertFromFahrenheit)
      temperature = fahrenheitToCelsius(temperature);
    return { value: temperature };
  } catch (_e) {
    return { parseError: "unable to parse temperature" };
  }
}

function formatCelsiusValue(temperature: number): string {
  return `${temperature.toFixed(1)}C`;
}

describe("ParsedInput", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;
  function requestNextAnimation() { }

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });
    await TestUtils.initializeUiComponents();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);
  });

  afterEach(cleanup);

  it("should process format and parse function", async () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = (await wrapper.findByTestId("components-parsed-input")) as HTMLInputElement;
    expect(input.value).to.eq("20.0C");
    fireEvent.change(input, { target: { value: "32F" } });
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();
    expect(spyOnChange).to.have.been.called;
    expect(input.value).to.eq("0.0C");
  });

});
