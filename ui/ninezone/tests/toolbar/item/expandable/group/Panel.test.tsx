/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Panel from "../../../../../src/toolbar/item/expandable/group/Panel";

describe("<Panel />", () => {
  it("should render", () => {
    mount(<Panel />);
  });

  it("renders correctly", () => {
    shallow(<Panel />).should.matchSnapshot();
  });
});
