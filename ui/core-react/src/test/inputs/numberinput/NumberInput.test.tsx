/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SpecialKey } from "@itwin/appui-abstract";
import { fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { NumberInput } from "../../../core-react/inputs/numberinput/NumberInput";

// cSpell:ignore decrementor numberinput

function parseDollar(stringValue: string) {
  const noDollarSign = stringValue.replace(/^\$/, "");
  let n = parseFloat(noDollarSign);
  if (isNaN(n) || !isFinite(n))
    n = 0;
  return n;
}

function formatDollar(num: number | undefined | null, fallback: string) {
  if (undefined === num || null === num)
    return fallback;

  return `$${num.toFixed(2)}`;
}

function exoticStep(direction: string) {
  if (direction === "up")
    return .5;
  return .1;
}

function undefinedStepFunction(_direction: string) {
  return undefined;
}

describe("<NumberInput - React Testing Library />", () => {
  it("should render correctly disabled", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={undefined} onChange={handleChange} disabled />);
    const disabledWrapper = wrapper.container.querySelector("div.core-number-input-container.core-number-input-disabled");
    expect(disabledWrapper).not.to.be.null;
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    expect(value).to.eq(value);
  });

  it("value should update with up/down buttons", () => {
    const spyMethod = sinon.spy();
    let updatedValue: number | undefined = 5;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      updatedValue = v;
      spyMethod();
    };

    const wrapper = render(<NumberInput value={1} step={undefined} onChange={handleChange} />);
    const input = wrapper.container.querySelector("input") as HTMLInputElement;
    expect(input.value).to.eq("1");

    wrapper.rerender(<NumberInput value={5} step={undefined} onChange={handleChange} />);
    expect(input.value).to.eq("5");

    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;

    fireEvent.click(incrementor!);
    expect(input.value).to.eq("6");
    spyMethod.calledOnce.should.true;
    expect(updatedValue).to.eq(6);

    fireEvent.click(decrementor!);
    expect(updatedValue).to.eq(5);
  });

  it("steps correctly with undefined step", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={undefined} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    expect(value).to.eq(1);
  });

  it("steps correctly with number step", () => {
    let value: number | undefined = 0;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={5} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(5);
  });

  it("steps correctly with decimal step", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(1.48);
  });

  it("properly handle max", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={1} max={5} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);  // 1
    fireEvent.click(incrementor!);  // 2
    fireEvent.click(incrementor!);  // 3
    fireEvent.click(incrementor!);  // 4
    fireEvent.click(incrementor!);  // 5
    fireEvent.click(incrementor!);  // 6 => 5
    expect(value).to.eq(5);
  });

  it("properly handle MAX_SAFE_INTEGER value", () => {
    let value: number | undefined = Number.MAX_SAFE_INTEGER;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={1} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(Number.MAX_SAFE_INTEGER);
  });

  it("properly handle min", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={1} min={-5} onChange={handleChange} />);
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;
    fireEvent.click(decrementor!);  // -1
    fireEvent.click(decrementor!);  // -2
    fireEvent.click(decrementor!);  // -3
    fireEvent.click(decrementor!);  // -4
    fireEvent.click(decrementor!);  // -5
    fireEvent.click(decrementor!);  // -6 => -5
    expect(value).to.eq(-5);
  });

  it("properly handle MIN_SAFE_INTEGER value", () => {
    let value: number | undefined = Number.MIN_SAFE_INTEGER;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput value={value} step={1} onChange={handleChange} />);
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;
    fireEvent.click(decrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(Number.MIN_SAFE_INTEGER);
  });

  it("steps correctly with decimal step and snap", () => {
    let value: number | undefined = 1.23;
    let formattedValue: string = "";
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, stringValue: string): void => {
      spyMethod();
      value = v;
      formattedValue = stringValue;
    };

    const wrapper = render(<NumberInput precision={2} value={value} step={.25} snap onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(1.5);
    expect(formattedValue).to.eq("1.50");
  });

  it("steps correctly when placeholder is used", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    const wrapper = render(<NumberInput placeholder="Enter Text" step={1} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    expect(value).to.eq(1);
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;
    fireEvent.click(decrementor!);
    expect(value).to.eq(0);
  });

  it("steps correctly with function step +.5/-.1", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    // Note: requires precision to avoid round off during incrementing.
    const wrapper = render(<NumberInput value={value} precision={1} step={exoticStep} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    expect(value).to.eq(.5);
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;
    fireEvent.click(decrementor!);
    expect(value).to.eq(.4);
  });

  it("steps correctly when step function return undefined", () => {
    let value: number | undefined = 0;
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      value = v;
    };
    // Note: requires precision to avoid round off during incrementing.
    const wrapper = render(<NumberInput value={value} precision={1} step={undefinedStepFunction} onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    expect(value).to.eq(1);
    const decrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-down");
    expect(decrementor).not.to.be.null;
    fireEvent.click(decrementor!);
    expect(value).to.eq(0);
  });

  it("should increment/decrement value on Up/Down Arrow", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const spyKeyDown = sinon.spy();
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} onKeyDown={spyKeyDown} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.keyDown(input!, { key: SpecialKey.ArrowUp });
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(1.48);

    spyMethod.resetHistory();
    fireEvent.keyDown(input!, { key: SpecialKey.ArrowDown });
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(1.23);
    spyKeyDown.calledTwice.should.true;
  });

  it("should update value on enter", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(22.3);
  });

  it("should update value on blur", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const spyBlur = sinon.spy();
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} onBlur={spyBlur} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.focusIn(input!);
    fireEvent.change(input!, { target: { value: "22.3" } });
    fireEvent.blur(input!);
    spyMethod.calledOnce.should.true;
    spyBlur.calledOnce.should.true;
    expect(value).to.eq(22.3);
  });

  it("should reset value on ESC", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    const originalValue = (input as HTMLInputElement).value;
    fireEvent.change(input!, { target: { value: "22.3" } });
    expect((input as HTMLInputElement).value).to.eq("22.3");
    fireEvent.keyDown(input!, { key: SpecialKey.Escape });
    spyMethod.notCalled.should.be.true;
    expect((input as HTMLInputElement).value).to.eq(originalValue);
  });

  it("should reset value to 0 when invalid text is entered", () => {
    let value: number | undefined = 1.23;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, _stringValue: string): void => {
      spyMethod();
      value = v;
    };
    const wrapper = render(<NumberInput precision={2} value={value} step={.25} onChange={handleChange} />);
    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "abc" } });
    expect((input as HTMLInputElement).value).to.eq("abc");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    spyMethod.calledOnce.should.be.true;
    expect(value).to.eq(0);
  });

  it("renders for touch correctly", () => {
    const wrapper = render(<NumberInput value={0} showTouchButtons />);
    const mainContainer = wrapper.container.querySelector("div.core-number-input-container.core-number-buttons-for-touch");
    expect(mainContainer).not.to.be.null;
    const buttonContainer = wrapper.container.querySelector("div.core-number-input-buttons-container.core-number-buttons-for-touch");
    expect(buttonContainer).not.to.be.null;
  });

  it("processes parse and format functions correctly", () => {
    let value: number | undefined = 1.23;
    let formattedValue: string = "";
    const spyMethod = sinon.spy();
    const handleChange = (v: number | undefined, stringValue: string): void => {
      spyMethod();
      value = v;
      formattedValue = stringValue;
    };

    const wrapper = render(<NumberInput format={formatDollar} parse={parseDollar} precision={2} value={value} step={.25} snap onChange={handleChange} />);
    const incrementor = wrapper.container.querySelector("div.core-number-input-button.core-number-input-button-up");
    expect(incrementor).not.to.be.null;
    fireEvent.click(incrementor!);
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(1.5);
    expect(formattedValue).to.eq("$1.50");

    const input = wrapper.container.querySelector("input");
    expect(input).not.to.be.null;
    fireEvent.change(input!, { target: { value: "15.3" } });
    expect((input as HTMLInputElement).value).to.eq("15.3");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    expect(formattedValue).to.eq("$15.30");

    fireEvent.change(input!, { target: { value: "$2.25" } });
    expect((input as HTMLInputElement).value).to.eq("$2.25");
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    expect(formattedValue).to.eq("$2.25");
  });

});

