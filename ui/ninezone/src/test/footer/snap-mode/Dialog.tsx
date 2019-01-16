/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { SnapModeDialog } from "../../../ui-ninezone";

describe("<SnapModeDialog />", () => {
  it("should render", () => {
    mount(<SnapModeDialog />);
  });

  it("renders correctly", () => {
    shallow(<SnapModeDialog />).should.matchSnapshot();
  });
});
