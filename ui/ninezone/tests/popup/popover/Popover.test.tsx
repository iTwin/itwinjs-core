/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Popover from "../../../src/popup/popover/Popover";
import { Direction } from "../../../src/utilities/Direction";

describe("<Popover />", () => {
  it("should render", () => {
    mount(<Popover direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Popover direction={Direction.Left} />).should.matchSnapshot();
  });

  it("should set direction class", () => {
    shallow(<Popover direction={Direction.Right} />).should.matchSnapshot();
  });
});
