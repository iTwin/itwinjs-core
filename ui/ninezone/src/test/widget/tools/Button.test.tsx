/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolbarButton } from "../../../ui-ninezone";

describe("<ToolbarButton  />", () => {
  it("should render", () => {
    mount(<ToolbarButton />);
  });

  it("renders correctly", () => {
    shallow(<ToolbarButton />).should.matchSnapshot();
  });

  it("renders correctly with mouseProximity & small", () => {
    shallow(<ToolbarButton mouseProximity={0.50} small={true} />).should.matchSnapshot();
  });

});
