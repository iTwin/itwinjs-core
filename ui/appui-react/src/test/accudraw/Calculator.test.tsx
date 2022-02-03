/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { ReactWrapper} from "enzyme";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Icon } from "@itwin/core-react";
import { Calculator } from "../../appui-react/accudraw/Calculator";
import { CalculatorEngine, CalculatorOperator } from "../../appui-react/accudraw/CalculatorEngine";
import { mount } from "../TestUtils";

describe("Calculator", () => {

  const simulateButtonClick = (w: ReactWrapper) => {
    expect(w.length).to.eq(1);
    const button = w.find("button");
    button.simulate("click");
  };

  it("should render", () => {
    mount(<Calculator />);
  });

  it("should render with icon", () => {
    mount(<Calculator resultIcon={<Icon iconSpec="icon-placeholder" />} />);
  });

  it("renders correctly", () => {
    shallow(<Calculator />).should.matchSnapshot();
  });

  it("should support initialValue", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} initialValue={100} />);

    expect(wrapper.state("displayValue")).to.eq("100");
  });

  it("clicking on 1 button should put it in display", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const keyChar = "1";
    const calculatorButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(calculatorButton);

    expect(wrapper.state("displayValue")).to.eq(keyChar);
  });

  it("clicking on buttons, operator and equals should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);

    let keyChar = "1";
    const oneButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(oneButton);
    expect(wrapper.state("displayValue")).to.eq("1");

    keyChar = "0";
    const zeroButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(zeroButton);
    expect(wrapper.state("displayValue")).to.eq("10");

    const multiplyButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "OperatorButton" && n.prop("operator") === CalculatorOperator.Multiply);
    simulateButtonClick(multiplyButton);
    expect(wrapper.state("displayValue")).to.eq("10");

    keyChar = "2";
    const twoButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(twoButton);
    expect(wrapper.state("displayValue")).to.eq("2");

    const equalsButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "OperatorButton" && n.prop("operator") === CalculatorOperator.Equals);
    simulateButtonClick(equalsButton);
    expect(wrapper.state("displayValue")).to.eq("20");
  });

  it("clicking on OK button should fire onOk", () => {
    const spyMethod = sinon.spy();
    let value = 0;
    const handleOk = (v: number) => { spyMethod(); value = v; };
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} onOk={handleOk} />);
    const keyChar = "5";
    const calculatorButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(calculatorButton);

    expect(wrapper.state("displayValue")).to.eq(keyChar);

    const okButton = wrapper.find("button.uifw-calculator-ok-button");
    expect(okButton.length).to.eq(1);
    okButton.simulate("click");
    spyMethod.called.should.true;
    expect(value).to.eq(5);
  });

  it("clicking on Cancel button should fire onCancel", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} onCancel={spyMethod} />);
    const keyChar = "5";
    const calculatorButton = wrapper.findWhere((n: ReactWrapper) => n.name() === "ValueButton" && n.prop("keyChar") === keyChar);
    simulateButtonClick(calculatorButton);

    expect(wrapper.state("displayValue")).to.eq(keyChar);

    const cancelButton = wrapper.find("button.uifw-calculator-cancel-button");
    expect(cancelButton.length).to.eq(1);
    cancelButton.simulate("click");
    spyMethod.called.should.true;
  });

  it("Pressing Esc should fire onCancel", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} onCancel={spyMethod} />);

    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);
    mainDiv.simulate("keydown", { key: "Escape" });

    spyMethod.called.should.true;
  });

  it("pressing keys and multiply should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "1" });
    expect(wrapper.state("displayValue")).to.eq("1");

    mainDiv.simulate("keydown", { key: "0" });
    expect(wrapper.state("displayValue")).to.eq("10");

    mainDiv.simulate("keydown", { key: "*" });
    expect(wrapper.state("displayValue")).to.eq("10");

    mainDiv.simulate("keydown", { key: "2" });
    expect(wrapper.state("displayValue")).to.eq("2");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("20");

    mainDiv.simulate("keydown", { key: "a" });
    expect(wrapper.state("displayValue")).to.eq("0");
  });

  it("pressing keys and subtract should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "4" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "-" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "3" });
    expect(wrapper.state("displayValue")).to.eq("3");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("1");
  });

  it("pressing keys and divide should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "9" });
    expect(wrapper.state("displayValue")).to.eq("9");

    mainDiv.simulate("keydown", { key: "/" });
    expect(wrapper.state("displayValue")).to.eq("9");

    mainDiv.simulate("keydown", { key: "3" });
    expect(wrapper.state("displayValue")).to.eq("3");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("3");
  });

  it("pressing keys and add should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "8" });
    expect(wrapper.state("displayValue")).to.eq("8");

    mainDiv.simulate("keydown", { key: "7" });
    expect(wrapper.state("displayValue")).to.eq("87");

    mainDiv.simulate("keydown", { key: "6" });
    expect(wrapper.state("displayValue")).to.eq("876");

    mainDiv.simulate("keydown", { key: "." });
    expect(wrapper.state("displayValue")).to.eq("876.");

    mainDiv.simulate("keydown", { key: "5" });
    expect(wrapper.state("displayValue")).to.eq("876.5");

    mainDiv.simulate("keydown", { key: "+" });
    expect(wrapper.state("displayValue")).to.eq("876.5");

    mainDiv.simulate("keydown", { key: "4" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("880.5");
  });

  it("pressing keys and Enter should give correct result", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} onOk={spyMethod} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "8" });
    expect(wrapper.state("displayValue")).to.eq("8");

    mainDiv.simulate("keydown", { key: "/" });
    expect(wrapper.state("displayValue")).to.eq("8");

    mainDiv.simulate("keydown", { key: "4" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "Enter" });
    expect(wrapper.state("displayValue")).to.eq("2");
    spyMethod.called.should.true;
  });

  it("pressing keys and Clear should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "8" });
    expect(wrapper.state("displayValue")).to.eq("8");

    mainDiv.simulate("keydown", { key: "c" });
    expect(wrapper.state("displayValue")).to.eq("0");
  });

  it("pressing keys and Backspace should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "7" });
    expect(wrapper.state("displayValue")).to.eq("7");

    mainDiv.simulate("keydown", { key: "6" });
    expect(wrapper.state("displayValue")).to.eq("76");

    mainDiv.simulate("keydown", { key: "Backspace" });
    expect(wrapper.state("displayValue")).to.eq("7");

    mainDiv.simulate("keydown", { key: "Backspace" });
    expect(wrapper.state("displayValue")).to.eq("0");
  });

  it("pressing keys and Equal and Enter should give correct result", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} onOk={spyMethod} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "6" });
    expect(wrapper.state("displayValue")).to.eq("6");

    mainDiv.simulate("keydown", { key: "5" });
    expect(wrapper.state("displayValue")).to.eq("65");

    mainDiv.simulate("keydown", { key: "-" });
    expect(wrapper.state("displayValue")).to.eq("65");

    mainDiv.simulate("keydown", { key: "4" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("61");

    mainDiv.simulate("keydown", { key: "Enter" });
    expect(wrapper.state("displayValue")).to.eq("61");
    spyMethod.called.should.true;
  });

  it("pressing keys and Equal and Clear should give correct result", () => {
    const wrapper = mount(<Calculator engine={new CalculatorEngine()} />);
    const mainDiv = wrapper.find("div.uifw-calculator");
    expect(mainDiv.length).to.eq(1);

    mainDiv.simulate("keydown", { key: "4" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "*" });
    expect(wrapper.state("displayValue")).to.eq("4");

    mainDiv.simulate("keydown", { key: "3" });
    expect(wrapper.state("displayValue")).to.eq("3");

    mainDiv.simulate("keydown", { key: "=" });
    expect(wrapper.state("displayValue")).to.eq("12");

    mainDiv.simulate("keydown", { key: "c" });
    expect(wrapper.state("displayValue")).to.eq("0");
  });

});
