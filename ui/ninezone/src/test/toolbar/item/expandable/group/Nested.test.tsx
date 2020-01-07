/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { NestedGroup } from "../../../../../ui-ninezone";

describe("<NestedGroup />", () => {
  it("should render", () => {
    mount(<NestedGroup />);
  });

  it("renders correctly", () => {
    shallow(<NestedGroup />).should.matchSnapshot();
  });
});
