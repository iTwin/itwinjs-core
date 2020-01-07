/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
