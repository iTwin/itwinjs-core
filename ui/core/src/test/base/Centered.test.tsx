/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Centered } from "../../ui-core";

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
    const wrapper = shallow(<Centered />);
    wrapper.find(".uicore-centered").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<Centered>Test Content</Centered>);
    wrapper.find(".uicore-centered").text().should.equal("Test Content");
  });
});
