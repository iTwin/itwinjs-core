/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { HorizontalTabs } from "../../ui-core.js";

describe("<HorizontalTabs />", () => {
  it("should render", () => {
    const wrapper = mount(<HorizontalTabs labels={[]} />);
    wrapper.find(".uicore-tabs-horizontal").length.should.equal(1);
  });

  it("renders correctly", () => {
    shallow(<HorizontalTabs labels={[]} />).should.matchSnapshot();
  });
});
