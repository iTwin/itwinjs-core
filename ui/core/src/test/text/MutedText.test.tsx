/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { MutedText } from "../../ui-core";

describe("<MutedText />", () => {
  it("should render", () => {
    mount(<MutedText />);
  });
  it("renders correctly", () => {
    shallow(<MutedText />).should.matchSnapshot();
  });

  it("content renders correctly", () => {
    shallow(<MutedText>Test content</MutedText>).should.matchSnapshot();
  });

  it("has correct className", () => {
    const wrapper = shallow(<MutedText />);
    wrapper.find(".uicore-text-muted").should.exist;
  });

  it("has correct text", () => {
    const wrapper = shallow(<MutedText>Test Content</MutedText>);
    wrapper.find(".uicore-text-muted").text().should.equal("Test Content");
  });
});
