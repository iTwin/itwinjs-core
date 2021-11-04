/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolbarButton } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<ToolbarButton  />", () => {
  it("should render", () => {
    mount(<ToolbarButton />);
  });

  it("renders correctly", () => {
    shallow(<ToolbarButton />).should.matchSnapshot();
  });

  it("renders correctly with mouseProximity & small", () => {
    shallow(<ToolbarButton mouseProximity={0.50} small />).should.matchSnapshot();
  });

});
