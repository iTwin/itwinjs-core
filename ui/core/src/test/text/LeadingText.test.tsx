/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LeadingText } from "../../ui-core";

describe("<LeadingText />", () => {
  it("should render", () => {
    mount(<LeadingText />);
  });
  it("renders correctly", () => {
    shallow(<LeadingText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<LeadingText>Test content</LeadingText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<LeadingText />);
    wrapper.find(".uicore-text-leading").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<LeadingText>Test Content</LeadingText>);
    wrapper.find(".uicore-text-leading").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
