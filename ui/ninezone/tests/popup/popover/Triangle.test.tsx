/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Triangle from "@src/popup/popover/Triangle";

describe("<Triangle />", () => {
  it("should render", () => {
    mount(<Triangle />);
  });

  it("renders correctly", () => {
    shallow(<Triangle />).should.matchSnapshot();
  });
});
