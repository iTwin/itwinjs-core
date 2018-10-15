/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SplitButton } from "../../src/index";

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

  it("handles keydown correctly", () => {
    const wrapper = mount(<SplitButton label="test" />);
    // does not yet have expects, but does test that the onKeyUp code runs.
    wrapper.find(".split-button-arrow").at(0).simulate("keyup", {keyCode: 13});
    wrapper.find(".split-button-arrow").at(0).simulate("keyup", {keyCode: 40});
    wrapper.find(".split-button-arrow").at(0).simulate("keyup", {keyCode: 0});
  });

  it("handles keydown correctly", () => {
    const wrapper = mount(<SplitButton label="test" />);
    // does not yet have expects, but does test that the onClick code runs.
    wrapper.find(".split-button-arrow").at(0).simulate("click");
  });

  it("handles menu close correctly", () => {
    const wrapper = mount(<SplitButton label="test" />);
    // does not yet have expects, but does test that the onClose code runs.
    wrapper.find(".context-menu").at(0).simulate("click");
    wrapper.find(".context-menu").at(0).simulate("click", {target: document.getElementsByClassName("split-button-arrow")[0]});
  });
});
