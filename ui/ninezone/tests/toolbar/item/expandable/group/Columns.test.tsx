/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Columns from "../../../../../src/toolbar/item/expandable/group/Columns";

describe("<Columns />", () => {
  it("should render", () => {
    mount(<Columns />);
  });

  it("renders correctly", () => {
    shallow(<Columns />).should.matchSnapshot();
  });
});
