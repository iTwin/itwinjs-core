/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { TreeBranch as Branch } from "../../ui-core";

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
