/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FlexWrapContainer } from "../../core-react";

describe("<FlexWrapContainer />", () => {
  it("should render", () => {
    const wrapper = mount(<FlexWrapContainer />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<FlexWrapContainer />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<FlexWrapContainer>Test content</FlexWrapContainer>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<FlexWrapContainer />);
    wrapper.find(".uicore-flex-wrap-container").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<FlexWrapContainer>Test Content</FlexWrapContainer>);
    wrapper.find(".uicore-flex-wrap-container").text().should.equal("Test Content");
  });
});
