/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { SnapModeIndicator } from "../../../ui-ninezone";

describe("<SnapModeIndicator />", () => {
  it("should render", () => {
    mount(<SnapModeIndicator />);
  });

  it("renders correctly", () => {
    shallow(<SnapModeIndicator />).should.matchSnapshot();
  });

  it("renders correctly with label", () => {
    shallow(<SnapModeIndicator label="Snap Mode" />).should.matchSnapshot();
  });
});
