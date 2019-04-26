/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { NestedToolSettings } from "../../../ui-ninezone";

describe("<NestedToolSettings />", () => {
  it("should render", () => {
    mount(<NestedToolSettings />);
  });

  it("renders correctly", () => {
    shallow(<NestedToolSettings />).should.matchSnapshot();
  });
});
