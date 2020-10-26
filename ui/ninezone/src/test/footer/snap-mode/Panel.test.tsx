/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SnapModePanel } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<SnapModePanel />", () => {
  it("should render", () => {
    mount(<SnapModePanel />);
  });

  it("renders correctly", () => {
    shallow(<SnapModePanel />).should.matchSnapshot();
  });
});
