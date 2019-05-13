/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { SnapMode } from "../../../ui-ninezone";

describe("<SnapMode />", () => {
  it("should render", () => {
    mount(<SnapMode />);
  });

  it("renders correctly", () => {
    shallow(<SnapMode />).should.matchSnapshot();
  });

  it("renders correctly with label", () => {
    shallow(<SnapMode>Snap Mode</SnapMode>).should.matchSnapshot();
  });
});
