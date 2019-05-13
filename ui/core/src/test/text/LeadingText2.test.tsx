/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LeadingText2 } from "../../ui-core";

describe("<LeadingText2 />", () => {
  it("should render", () => {
    mount(<LeadingText2 />);
  });
  it("renders correctly", () => {
    shallow(<LeadingText2 />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<LeadingText2>Test content</LeadingText2>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<LeadingText2 />);
    wrapper.find(".uicore-text-leading-2").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<LeadingText2>Test Content</LeadingText2>);
    wrapper.find(".uicore-text-leading-2").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
