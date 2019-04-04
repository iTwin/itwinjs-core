/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { StatusZone } from "../../ui-ninezone";

describe("<StatusZone />", () => {
  it("should render", () => {
    mount(<StatusZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />);
  });

  it("renders correctly", () => {
    shallow(<StatusZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<StatusZone bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} isInFooterMode />).should.matchSnapshot();
  });
});
