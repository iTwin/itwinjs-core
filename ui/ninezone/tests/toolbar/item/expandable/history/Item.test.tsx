/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Item from "@src/toolbar/item/expandable/history/Item";

describe("<Item />", () => {
  it("should render", () => {
    mount(<Item />);
  });

  it("renders correctly", () => {
    shallow(<Item />).should.matchSnapshot();
  });

  it("renders active", () => {
    shallow(<Item isActive />).should.matchSnapshot();
  });

  it("renders disabled", () => {
    shallow(<Item isDisabled />).should.matchSnapshot();
  });
});
