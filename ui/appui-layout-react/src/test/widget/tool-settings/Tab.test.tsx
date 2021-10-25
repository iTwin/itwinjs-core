/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolSettingsTab } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<ToolSettingsTab />", () => {
  it("should render", () => {
    mount(<ToolSettingsTab />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsTab />).should.matchSnapshot();
  });
});
