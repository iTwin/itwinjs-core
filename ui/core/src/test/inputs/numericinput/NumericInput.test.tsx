/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { NumericInput } from "../../../ui-core/inputs/numericinput/NumericInput";

describe("NumericInput", () => {
  it("should render", () => {
    const wrapper = mount(<NumericInput />);
    wrapper.unmount();
  });

  it("should render correctly", () => {
    const wrapper = shallow(<NumericInput />);
    wrapper.should.matchSnapshot();
    wrapper.unmount();
  });

  it("steps correctly with number step", () => {
    let value: number | null = 0;
    const spyMethod = sinon.spy();
    const handleChange = (v: number | null, _stringValue: string, _input: HTMLInputElement): void => {
      spyMethod();
      value = v;
    };
    const wrapper = mount(<NumericInput value={value} step={5} onChange={handleChange} />);
    const iNodes = wrapper.find("i");
    expect(iNodes.length).to.eq(2);
    const iUp = iNodes.at(0);
    iUp.simulate("mousedown");
    spyMethod.calledOnce.should.true;
    expect(value).to.eq(5);
    wrapper.unmount();
  });

  it("steps correctly with undefined step", () => {
    let value: number | null = 0;
    const handleChange = (v: number | null, _stringValue: string, _input: HTMLInputElement): void => {
      value = v;
    };
    const wrapper = mount(<NumericInput value={value} step={undefined} onChange={handleChange} />);
    const iNodes = wrapper.find("i");
    expect(iNodes.length).to.eq(2);
    const iUp = iNodes.at(0);
    iUp.simulate("mousedown");
    expect(value).to.eq(1);

    wrapper.setProps({ value: 5 });
    wrapper.update();
    expect(wrapper.prop("value")).to.eq(5);
    wrapper.unmount();
  });

  it("steps correctly with function step", () => {
    let value: number | null = 0;
    const handleChange = (v: number | null, _stringValue: string, _input: HTMLInputElement): void => {
      value = v;
    };
    const wrapper = mount(<NumericInput value={value} step={() => 5} onChange={handleChange} />);
    const iNodes = wrapper.find("i");
    expect(iNodes.length).to.eq(2);
    const iUp = iNodes.at(0);
    iUp.simulate("mousedown");
    expect(value).to.eq(5);
    wrapper.unmount();
  });
});

describe("<NumericInput - React Testing Library />", () => {
  afterEach(cleanup);

  it("value should update with up/down buttons", () => {
    let updatedValue: number | null = 5;
    const handleChange = (v: number | null, _stringValue: string, _input: HTMLInputElement): void => {
      updatedValue = v;
    };

    const component = render(<NumericInput value={1} step={undefined} onChange={handleChange} />);
    const input = component.container.querySelector("input") as HTMLInputElement;
    expect(input.value).to.eq("1");

    component.rerender(<NumericInput value={5} step={undefined} onChange={handleChange} />);
    expect(input.value).to.eq("5");

    const incrementor = component.container.querySelectorAll("i");
    expect(incrementor.length).to.eq(2);
    fireEvent.mouseDown(incrementor[0]);
    fireEvent.mouseUp(incrementor[0]);
    expect(input.value).to.eq("6");
    expect(updatedValue).to.eq(6);
  });

});
