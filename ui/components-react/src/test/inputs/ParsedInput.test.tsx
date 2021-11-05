/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import TestUtils from "../TestUtils";
import { ParsedInput } from "../../components-react/inputs/ParsedInput";
import { ParseResults, SpecialKey } from "@itwin/appui-abstract";

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

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(async () => {
    TestUtils.terminateUiComponents();
  });

  it("should process format and parse function", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");
    fireEvent.change(input, { target: { value: "32F" } });
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    expect(spyOnChange).to.have.been.called;
    spyOnChange.resetHistory();
    expect(input.value).to.eq("0.0C");
    fireEvent.change(input, { target: { value: "0.0C" } });
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    expect(spyOnChange).to.not.have.been.called;
  });

  it("should process blur", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");

    // Blur does change
    fireEvent.change(input, { target: { value: "10.0C" } });
    fireEvent.blur(input);
    expect(spyOnChange).to.have.been.called;
  });

  it("should process Escape keystroke", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");

    // Escape does not change
    fireEvent.change(input, { target: { value: "20.0C" } });
    fireEvent.keyDown(input, { key: SpecialKey.Escape });
    expect(spyOnChange).to.not.have.been.called;
  });

  it("should process keystrokes and initialValue prop change", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");

    // Should process updated initialValue prop
    const newTemperature = 100;  // 100 C
    wrapper.rerender(<ParsedInput onChange={spyOnChange} initialValue={newTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const updatedInput = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(updatedInput.value).to.eq("100.0C");
  });

  it("should process keystrokes and initialValue prop change", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");

    // Should process updated initialValue prop
    const newTemperature = 100;  // 100 C
    wrapper.rerender(<ParsedInput onChange={spyOnChange} initialValue={newTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const updatedInput = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(updatedInput.value).to.eq("100.0C");
  });

  it("should notify on bad input", () => {
    const initialTemperature = 20;  // 20 C
    const spyOnChange = sinon.spy();

    const wrapper = render(<ParsedInput onChange={spyOnChange} initialValue={initialTemperature} formatValue={formatCelsiusValue} parseString={parseStringToCelsius} />);
    expect(wrapper).not.to.be.undefined;
    const input = wrapper.getByTestId("components-parsed-input") as HTMLInputElement;
    expect(input.value).to.eq("20.0C");

    // Should add "components-parsed-input-has-error" CSS class on bad input
    fireEvent.change(input, { target: { value: "XYZ" } });
    fireEvent.keyDown(input, { key: SpecialKey.Enter });
    expect(spyOnChange).to.not.have.been.called;
    expect(wrapper.container.querySelector(".components-parsed-input-has-error")).to.not.be.null;
  });

});
