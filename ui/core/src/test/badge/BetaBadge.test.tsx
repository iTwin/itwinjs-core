/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { BetaBadge } from "../../ui-core.js";

describe("<BetaBadge />", () => {
  it("should render", () => {
    const wrapper = mount(<BetaBadge />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<BetaBadge />).should.matchSnapshot();
  });
});
