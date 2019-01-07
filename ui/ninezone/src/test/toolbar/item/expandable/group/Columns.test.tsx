/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Columns } from "../../../../../ui-ninezone";

describe("<Columns />", () => {
  it("should render", () => {
    mount(<Columns />);
  });

  it("renders correctly", () => {
    shallow(<Columns />).should.matchSnapshot();
  });
});
