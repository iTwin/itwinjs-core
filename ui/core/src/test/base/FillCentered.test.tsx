/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FillCentered } from "../../ui-core";

describe("<FillCentered />", () => {
  it("should render", () => {
    const wrapper = mount(<FillCentered />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<FillCentered />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<FillCentered>Test content</FillCentered>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<FillCentered />);
    wrapper.find(".uicore-fill-centered").should.exist;
  });

  it("has correct text", () => {
    const wrapper = mount(<FillCentered>Test Content</FillCentered>);
    wrapper.find(".uicore-fill-centered").text().should.equal("Test Content");
  });
});
