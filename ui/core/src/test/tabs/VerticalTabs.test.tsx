/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { VerticalTabs } from "../../ui-core.js";

describe("<VerticalTabs />", () => {
  it("should render", () => {
    const wrapper = mount(<VerticalTabs labels={[]} />);
    wrapper.find(".uicore-tabs-vertical").length.should.equal(1);
  });

  it("renders correctly", () => {
    shallow(<VerticalTabs labels={[]} />).should.matchSnapshot();
  });
});
