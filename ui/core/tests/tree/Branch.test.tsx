/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Branch from "../../src/tree/Branch";

describe("<Branch />", () => {
  it("should render", () => {
    mount(<Branch />);
  });

  it("renders correctly", () => {
    shallow(<Branch />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Branch><div id="unique" /></Branch>);
    wrapper.find("#unique").should.have.lengthOf(1);
  });
});
