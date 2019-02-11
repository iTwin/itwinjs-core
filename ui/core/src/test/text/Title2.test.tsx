/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Title2 } from "../../ui-core";

describe("<Title2 />", () => {
  it("should render", () => {
    mount(<Title2 />);
  });
  it("renders correctly", () => {
    shallow(<Title2 />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<Title2>Test content</Title2>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<Title2 />);
    wrapper.find(".uicore-text-title-2").should.exist;
  });

  it("has correct text", () => {
    const wrapper = shallow(<Title2>Test Content</Title2>);
    wrapper.find(".uicore-text-title-2").text().should.equal("Test Content");
  });
});
