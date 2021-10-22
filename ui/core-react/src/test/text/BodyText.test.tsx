/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { BodyText } from "../../core-react";

describe("<BodyText />", () => {
  it("should render", () => {
    mount(<BodyText />);
  });
  it("renders correctly", () => {
    shallow(<BodyText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<BodyText>Test content</BodyText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = mount(<BodyText />);
    wrapper.find(".uicore-text-body").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<BodyText>Test Content</BodyText>);
    wrapper.find(".uicore-text-body").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
