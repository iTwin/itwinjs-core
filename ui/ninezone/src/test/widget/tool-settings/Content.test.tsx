/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolSettingsContent } from "../../../ui-ninezone";

describe("<ToolSettingsContent />", () => {
  it("should render", () => {
    mount(<ToolSettingsContent />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsContent />).should.matchSnapshot();
  });
});
