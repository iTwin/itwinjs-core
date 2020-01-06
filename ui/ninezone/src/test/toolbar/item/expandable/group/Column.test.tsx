/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { GroupColumn } from "../../../../../ui-ninezone";

describe("<GroupColumn />", () => {
  it("should render", () => {
    mount(<GroupColumn />);
  });

  it("renders correctly", () => {
    shallow(<GroupColumn />).should.matchSnapshot();
  });
});
