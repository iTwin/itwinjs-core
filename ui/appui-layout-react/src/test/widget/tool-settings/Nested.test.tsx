/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { NestedToolSettings } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<NestedToolSettings />", () => {
  it("should render", () => {
    mount(<NestedToolSettings />);
  });

  it("renders correctly", () => {
    shallow(<NestedToolSettings />).should.matchSnapshot();
  });
});
