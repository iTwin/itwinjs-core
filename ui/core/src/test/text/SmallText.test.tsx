/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { SmallText } from "../../ui-core.js";

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
    const wrapper = mount(<SmallText />);
    wrapper.find(".uicore-text-small").length.should.eq(1);
  });

  it("has correct text", () => {
    const wrapper = mount(<SmallText>Test Content</SmallText>);
    wrapper.find(".uicore-text-small").text().should.equal("Test Content");
    wrapper.unmount();
  });
});
