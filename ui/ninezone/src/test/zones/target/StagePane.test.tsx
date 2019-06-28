/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SplitterPaneTarget } from "../../../ui-ninezone";

describe("<SplitterPaneTarget />", () => {
  it("should render", () => {
    mount(<SplitterPaneTarget />);
  });

  it("renders correctly", () => {
    shallow(<SplitterPaneTarget />).should.matchSnapshot();
  });
});
