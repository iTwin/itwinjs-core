/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { BlockText } from "../../core-react";

describe("<BlockText />", () => {
  it("should render", () => {
    mount(<BlockText />);
  });
  it("renders correctly", () => {
    shallow(<BlockText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<BlockText>Test content</BlockText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<BlockText />);
    wrapper.find(".uicore-text-block").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<BlockText>Test Content</BlockText>);
    wrapper.find(".uicore-text-block").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
