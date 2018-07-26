/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Item from "@src/backstage/Item";

describe("<Item />", () => {
  it("should render", () => {
    mount(<Item />);
  });

  it("renders correctly", () => {
    shallow(<Item />).should.matchSnapshot();
  });

  it("should apply style", () => {
    shallow(<Item style={{ backgroundColor: "red" }} />).should.matchSnapshot();
  });

  it("should set is-active class", () => {
    shallow(<Item isActive />).should.matchSnapshot();
  });
});
