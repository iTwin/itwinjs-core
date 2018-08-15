/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Triangle from "@src/popup/popover/Triangle";
import { Direction } from "@src/utilities/Direction";

describe("<Triangle />", () => {
  it("should render", () => {
    mount(<Triangle direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Triangle direction={Direction.Left} />).should.matchSnapshot();
  });

  it("should set direction class", () => {
    shallow(<Triangle direction={Direction.Bottom} />).should.matchSnapshot();
  });
});
