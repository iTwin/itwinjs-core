/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Group from "../../../../../src/toolbar/item/expandable/group/Group";

describe("<Group />", () => {
  it("should render", () => {
    mount(<Group />);
  });

  it("renders correctly", () => {
    shallow(<Group />).should.matchSnapshot();
  });
});
