/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Headline } from "../../ui-core";

describe("<Headline />", () => {
  it("should render", () => {
    mount(<Headline />);
  });
  it("renders correctly", () => {
    shallow(<Headline />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<Headline>Test content</Headline>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<Headline />);
    wrapper.find(".uicore-text-headline").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<Headline>Test Content</Headline>);
    wrapper.find(".uicore-text-headline").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
