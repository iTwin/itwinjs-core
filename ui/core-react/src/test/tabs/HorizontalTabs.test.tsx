/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { HorizontalTabs } from "../../core-react";

/* eslint-disable deprecation/deprecation */

describe("<HorizontalTabs />", () => {
  it("should render", () => {
    const wrapper = mount(<HorizontalTabs labels={[]} />);
    wrapper.find(".uicore-tabs-horizontal").length.should.equal(1);
  });

  it("renders correctly", () => {
    shallow(<HorizontalTabs labels={[]} />).should.matchSnapshot();
  });
});
