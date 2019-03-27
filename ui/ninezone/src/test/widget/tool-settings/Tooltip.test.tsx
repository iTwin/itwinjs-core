/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolSettingsTooltip } from "../../../ui-ninezone";

describe("<ToolSettingsTooltip />", () => {
  it("should render", () => {
    mount(<ToolSettingsTooltip position={{
      x: 0,
      y: 0,
    }} />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsTooltip position={{
      x: 0,
      y: 0,
    }} />).should.matchSnapshot();
  });
});
