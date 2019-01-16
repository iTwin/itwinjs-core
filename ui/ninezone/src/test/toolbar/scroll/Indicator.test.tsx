/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Direction, Indicator } from "../../../ui-ninezone";

describe("<Indicator />", () => {
  it("should render", () => {
    mount(<Indicator direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<Indicator direction={Direction.Left} />).should.matchSnapshot();
  });
});
