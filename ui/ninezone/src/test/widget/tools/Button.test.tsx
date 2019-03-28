/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolbarButton } from "../../../ui-ninezone";

describe("<ToolbarButton  />", () => {
  it("should render", () => {
    mount(<ToolbarButton />);
  });

  it("renders correctly", () => {
    shallow(<ToolbarButton />).should.matchSnapshot();
  });
});
