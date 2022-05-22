/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SnapMode } from "../../../appui-layout-react";
import { mount } from "../../Utils";

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
