/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Subheading2 } from "../../ui-core";

describe("<Subheading2 />", () => {
  it("should render", () => {
    mount(<Subheading2 />);
  });
  it("renders correctly", () => {
    shallow(<Subheading2 />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<Subheading2>Test content</Subheading2>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<Subheading2 />);
    wrapper.find(".uicore-text-subheading-2").should.exist;
  });

  it("has correct text", () => {
    const wrapper = shallow(<Subheading2>Test Content</Subheading2>);
    wrapper.find(".uicore-text-subheading-2").text().should.equal("Test Content");
  });
});
