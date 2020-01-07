/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
