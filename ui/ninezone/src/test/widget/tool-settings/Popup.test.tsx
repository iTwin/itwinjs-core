/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolSettingsPopup } from "../../../ui-ninezone";

describe("<ToolSettingsPopup />", () => {
  it("should render", () => {
    mount(<ToolSettingsPopup />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsPopup />).should.matchSnapshot();
  });
});
