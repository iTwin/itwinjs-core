/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { ToolSettingsTab } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<ToolSettingsTab />", () => {
  it("should render", () => {
    mount(<ToolSettingsTab />);
  });

  it("renders correctly", () => {
    shallow(<ToolSettingsTab />).should.matchSnapshot();
  });
});
