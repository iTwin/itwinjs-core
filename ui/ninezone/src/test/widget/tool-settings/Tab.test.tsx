/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolSettingsTab } from "../../../ui-ninezone";

describe("<ToolSettingsTab />", () => {
  it("should render", () => {
    mount(<ToolSettingsTab />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsTab />).should.matchSnapshot();
  });
});
