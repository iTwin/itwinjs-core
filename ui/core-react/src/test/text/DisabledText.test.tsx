/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { DisabledText } from "../../core-react";

describe("<DisabledText />", () => {
  it("should render", () => {
    mount(<DisabledText />);
  });
  it("renders correctly", () => {
    shallow(<DisabledText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<DisabledText>Test content</DisabledText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<DisabledText />);
    wrapper.find(".uicore-text-disabled").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<DisabledText>Test Content</DisabledText>);
    wrapper.find(".uicore-text-disabled").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
