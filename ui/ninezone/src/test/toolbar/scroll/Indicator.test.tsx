/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Direction, ScrollIndicator } from "../../../ui-ninezone";

describe("<ScrollIndicator />", () => {
  it("should render", () => {
    mount(<ScrollIndicator direction={Direction.Left} />);
  });

  it("renders correctly", () => {
    shallow(<ScrollIndicator direction={Direction.Left} />).should.matchSnapshot();
  });
});
