/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { VerticalTabs } from "../../core-react";

describe("<VerticalTabs />", () => {
  it("should render", () => {
    const wrapper = mount(<VerticalTabs labels={[]} />);
    wrapper.find(".uicore-tabs-vertical").length.should.equal(1);
  });

  it("renders correctly", () => {
    shallow(<VerticalTabs labels={[]} />).should.matchSnapshot();
  });
});
