/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import sinon = require("sinon");
import { expect } from "chai";

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
