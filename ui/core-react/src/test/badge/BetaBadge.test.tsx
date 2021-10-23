/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { BetaBadge } from "../../core-react";

describe("<BetaBadge />", () => {
  it("should render", () => {
    const wrapper = mount(<BetaBadge />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<BetaBadge />).should.matchSnapshot();
  });
});
