/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { SplitButton } from "../../ui-core";

describe("<SplitButton />", () => {
  it("should render", () => {
    mount(<SplitButton label="test" />);
  });

  it("renders correctly", () => {
    shallow(<SplitButton label="test" />).should.matchSnapshot();
  });

  it("renders with icon correctly", () => {
    shallow(<SplitButton label="test" icon="icon-placeholder" />).should.matchSnapshot();
  });

  it("renders with drawBorder correctly", () => {
    shallow(<SplitButton label="test" drawBorder />).should.matchSnapshot();
  });

  it("handles keydown/up correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button").at(0).simulate("keyup", { key: "ArrowDown" });
    expect(wrapper.state().expanded).to.be.true;

    wrapper.find(".core-split-button").at(0).simulate("keyup", { keyCode: 0 });
  });

  it("calls onExecute on Enter keyup", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SplitButton label="test" onExecute={spyMethod} />);
    wrapper.find(".core-split-button").at(0).simulate("keyup", { key: "Enter" });
    spyMethod.calledOnce.should.true;
  });

  it("handles click on arrow correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.true;
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.false;
  });

  it("handles menu close correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.true;
    wrapper.find(".core-context-menu").at(0).simulate("click", { target: document.getElementsByClassName(".core-split-button-arrow")[0] });
    expect(wrapper.state().expanded).to.be.false;
  });
});
