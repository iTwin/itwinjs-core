/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Title from "@src/toolbar/item/expandable/group/Title";

describe("<Title />", () => {
  it("should render", () => {
    mount(<Title />);
  });

  it("renders correctly", () => {
    shallow(<Title />).should.matchSnapshot();
  });
});
