/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FlexWrapContainer } from "../../ui-core";

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
    const wrapper = shallow(<FlexWrapContainer />);
    wrapper.find(".uicore-flex-wrap-container").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<FlexWrapContainer>Test Content</FlexWrapContainer>);
    wrapper.find(".uicore-flex-wrap-container").text().should.equal("Test Content");
  });
});
