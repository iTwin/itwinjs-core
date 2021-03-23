/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { mount, shallow } = enzyme;
import * as React from "react";
import { NewBadge } from "../../ui-core.js";

describe("<NewBadge />", () => {
  it("should render", () => {
    const wrapper = mount(<NewBadge />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<NewBadge />).should.matchSnapshot();
  });
});
