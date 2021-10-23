/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Centered } from "../../core-react";

describe("<Centered />", () => {
  it("should render", () => {
    const wrapper = mount(<Centered />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<Centered />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<Centered>Test content</Centered>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<Centered />);
    wrapper.find(".uicore-centered").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<Centered>Test Content</Centered>);
    wrapper.find(".uicore-centered").text().should.equal("Test Content");
  });
});
