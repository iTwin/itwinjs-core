/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Triangle from "../../../src/popup/popover/Triangle";
import { Direction } from "../../../src/utilities/Direction";

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
