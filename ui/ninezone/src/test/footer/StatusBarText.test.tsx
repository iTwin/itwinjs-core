/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { StatusBarText } from "../../ui-ninezone";

describe("<StatusBarText />", () => {
  it("should render", () => {
    mount(<StatusBarText />);
  });

  it("renders correctly", () => {
    shallow(<StatusBarText />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<StatusBarText isInFooterMode />).should.matchSnapshot();
  });
});
