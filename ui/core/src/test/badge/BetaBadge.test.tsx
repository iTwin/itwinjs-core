/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { BetaBadge } from "../../ui-core";

describe("<BetaBadge />", () => {
  it("should render", () => {
    const wrapper = mount(<BetaBadge />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<BetaBadge />).should.matchSnapshot();
  });
});
