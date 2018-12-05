/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { ToolAssistanceSeparator } from "../../../ui-ninezone";

describe("<ToolAssistanceSeparator />", () => {
  it("should render", () => {
    mount(<ToolAssistanceSeparator />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistanceSeparator />).should.matchSnapshot();
  });
});
