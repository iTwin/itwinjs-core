/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SmallText } from "../../ui-core";

describe("<SmallText />", () => {
  it("should render", () => {
    mount(<SmallText />);
  });
  it("renders correctly", () => {
    shallow(<SmallText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<SmallText>Test content</SmallText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<SmallText />);
    wrapper.find(".uicore-text-small").should.exist;
  });

  it("has correct text", () => {
    const wrapper = shallow(<SmallText>Test Content</SmallText>);
    wrapper.find(".uicore-text-small").text().should.equal("Test Content");
  });
});
