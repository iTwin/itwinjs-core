/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import { Toggle, ToggleButtonType } from "../../ui-core";

describe("<Toggle />", () => {
  it("should render", () => {
    const wrapper = mount(
      <Toggle />,
    );

    let label = wrapper.find("label.core-toggle");
    label.should.exist;
    label = wrapper.find("label.core-toggle.rounded");
    label.should.exist;

    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <Toggle />,
    ).should.matchSnapshot();
  });

  it("Toggle should call onChange handler", () => {
    const spyMethod = sinon.spy();
    const handleChange = (_checked: boolean) => {
      spyMethod();
    };

    const wrapper = mount(
      <Toggle isOn={false} onChange={handleChange} />,
    );

    const input = wrapper.find("input.core-toggle-input");
    input.should.exist;

    input.simulate("change", { checked: true });
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

  it("Toggle should call onBlur handler", () => {
    const spyMethod = sinon.spy();

    const wrapper = mount(
      <Toggle isOn={false} onBlur={spyMethod} />,
    );

    const input = wrapper.find("input.core-toggle-input");
    input.should.exist;

    input.simulate("blur");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

  it("Toggle should update on props.isOn change", () => {
    const spyMethod = sinon.spy();
    const handleChange = (_checked: boolean) => {
      spyMethod();
    };

    const wrapper = mount(
      <Toggle isOn={false} onChange={handleChange} />,
    );

    wrapper.setProps({ isOn: true });
    expect(wrapper.state("checked")).to.be.true;

    wrapper.setProps({ isOn: false });
    expect(wrapper.state("checked")).to.be.false;

    wrapper.unmount();
  });

  it("Toggle should update on props.disabled change", () => {
    const spyMethod = sinon.spy();
    const handleChange = (_checked: boolean) => {
      spyMethod();
    };

    const wrapper = mount(
      <Toggle isOn={false} onChange={handleChange} disabled={false} buttonType={ToggleButtonType.Primary} showCheckmark={true} rounded={false} />,
    );

    wrapper.setProps({ disabled: true });
    wrapper.update();

    const input = wrapper.find("input.core-toggle-input");
    input.should.exist;
    input.getDOMNode().hasAttribute("disabled").should.true;
    const label = wrapper.find("label.core-toggle.disabled");
    label.should.exist;

    wrapper.unmount();
  });

});
