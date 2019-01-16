/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Direction, TrianglePopover } from "../../../ui-ninezone";

describe("<TrianglePopover />", () => {
  it("should render", () => {
    mount(<TrianglePopover direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<TrianglePopover direction={Direction.Left} />).should.matchSnapshot();
  });

  it("should set direction class", () => {
    shallow(<TrianglePopover direction={Direction.Bottom} />).should.matchSnapshot();
  });
});
