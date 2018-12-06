/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Item } from "../../ui-ninezone";

describe("<Item />", () => {
  it("should render", () => {
    mount(<Item />);
  });

  // NEEDSWORK_MODULARIZATION - check for error or update snap.
  it.skip("renders correctly", () => {
    shallow(<Item />).should.matchSnapshot();
  });

  // NEEDSWORK_MODULARIZATION - check for error or update snap.
  it.skip("should apply style", () => {
    shallow(<Item style={{ backgroundColor: "red" }} />).should.matchSnapshot();
  });

  // NEEDSWORK_MODULARIZATION - check for error or update snap.
  it.skip("should set is-active class", () => {
    shallow(<Item isActive />).should.matchSnapshot();
  });
});
