/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SplitterPaneTarget } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<SplitterPaneTarget />", () => {
  it("should render", () => {
    mount(<SplitterPaneTarget />);
  });

  it("renders correctly", () => {
    shallow(<SplitterPaneTarget />).should.matchSnapshot();
  });
});
