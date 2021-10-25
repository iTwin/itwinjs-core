/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { FillCentered } from "../../core-react";

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
    const wrapper = mount(<FillCentered />);
    wrapper.find(".uicore-fill-centered").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<FillCentered>Test Content</FillCentered>);
    wrapper.find(".uicore-fill-centered").text().should.equal("Test Content");
  });
});
