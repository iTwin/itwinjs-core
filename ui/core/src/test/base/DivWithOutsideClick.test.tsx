/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { DivWithOutsideClick } from "../../ui-core";

describe("<DivWithOutsideClick />", () => {
  it("should render", () => {
    const wrapper = mount(<DivWithOutsideClick />);
    wrapper.unmount();
  });
  it("renders correctly", () => {
    shallow(<DivWithOutsideClick />).should.matchSnapshot();
  });
});
