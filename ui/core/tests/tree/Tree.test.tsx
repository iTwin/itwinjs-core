/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Tree from "../../src/tree/Tree";

describe("<Tree />", () => {
  it("should render", () => {
    mount(<Tree />);
  });

  it("renders correctly", () => {
    shallow(<Tree />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Tree><div id="unique" /></Tree>);
    wrapper.find("#unique").should.have.lengthOf(1);
  });
});
