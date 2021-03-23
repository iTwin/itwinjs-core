/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { SplitButton } from "../../ui-core.js";
import { RelativePosition, SpecialKey } from "@bentley/ui-abstract";
import { ButtonType } from "../../ui-core/button/Button.js";

describe("<SplitButton />", () => {
  it("should render", () => {
    const wrapper = mount(<SplitButton label="test" />);
    wrapper.unmount();
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

  it("renders with popupPosition correctly", () => {
    shallow(<SplitButton label="test" popupPosition={RelativePosition.BottomLeft} />).should.matchSnapshot();
  });

  it("renders with buttonType correctly", () => {
    shallow(<SplitButton label="test" buttonType={ButtonType.Blue} />).should.matchSnapshot();
  });

  it("handles keydown/up correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button").at(0).simulate("keyup", { key: SpecialKey.ArrowDown });
    expect(wrapper.state().expanded).to.be.true;

    wrapper.find(".core-split-button").at(0).simulate("keyup", { keyCode: 0 });
    wrapper.unmount();
  });

  it("calls onExecute on Enter keyup", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SplitButton label="test" onExecute={spyMethod} />);
    wrapper.find(".core-split-button").at(0).simulate("keyup", { key: SpecialKey.Enter });
    spyMethod.calledOnce.should.true;
    wrapper.unmount();
  });

  it("handles click on arrow correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.true;
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.false;
    wrapper.unmount();
  });

  it("handles menu close correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" />);
    wrapper.find(".core-split-button-arrow").at(0).simulate("click");
    expect(wrapper.state().expanded).to.be.true;
    wrapper.find(".core-context-menu").at(0).simulate("click", { target: document.getElementsByClassName(".core-split-button-arrow")[0] });
    expect(wrapper.state().expanded).to.be.false;
    wrapper.unmount();
  });

  it("handles initialExpanded prop correctly", () => {
    const wrapper = mount<SplitButton>(<SplitButton label="test" initialExpanded={true} />);
    expect(wrapper.state().expanded).to.be.true;
    wrapper.unmount();
  });

});
