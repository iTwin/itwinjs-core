/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { withOnOutsideClick, Div } from "../../src/index";

describe("WithOnOutsideClick", () => {

  const WithOnOutsideClickDiv = withOnOutsideClick(Div); // tslint:disable-line:variable-name

  it("should render", () => {
    const wrapper = mount(<WithOnOutsideClickDiv />);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(<WithOnOutsideClickDiv />).should.matchSnapshot();
  });

});
