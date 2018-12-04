/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Overflow } from "../../../ui-ninezone";

describe("<Overflow />", () => {
  it("should render", () => {
    mount(<Overflow />);
  });

  it("renders correctly", () => {
    shallow(<Overflow />).should.matchSnapshot();
  });
});
