/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Title } from "../../ui-core";

describe("<Title />", () => {
  it("should render", () => {
    mount(<Title />);
  });
  it("renders correctly", () => {
    shallow(<Title />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<Title>Test content</Title>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<Title />);
    wrapper.find(".uicore-text-title").should.exist;
  });

  it("has correct text", () => {
    const wrapper = shallow(<Title>Test Content</Title>);
    wrapper.find(".uicore-text-title").text().should.equal("Test Content");
  });
});
