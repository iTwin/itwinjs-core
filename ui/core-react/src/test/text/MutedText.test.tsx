/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { MutedText } from "../../core-react";

describe("<MutedText />", () => {
  it("should render", () => {
    mount(<MutedText />);
  });
  it("renders correctly", () => {
    shallow(<MutedText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<MutedText>Test content</MutedText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<MutedText />);
    wrapper.find(".uicore-text-muted").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<MutedText>Test Content</MutedText>);
    wrapper.find(".uicore-text-muted").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
