/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { DivWithOutsideClick } from "../../core-react";

describe("<DivWithOutsideClick />", () => {
  it("should render", () => {
    const wrapper = mount(<DivWithOutsideClick />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<DivWithOutsideClick />).should.matchSnapshot();
  });
});
