/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Panel } from "../../../../../ui-ninezone";

describe("<Panel />", () => {
  it("should render", () => {
    mount(<Panel />);
  });

  it("renders correctly", () => {
    shallow(<Panel />).should.matchSnapshot();
  });
});
