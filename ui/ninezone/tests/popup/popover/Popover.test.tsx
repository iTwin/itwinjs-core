/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Popover from "@src/popup/popover/Popover";

describe("<Popover />", () => {
  it("should render", () => {
    mount(<Popover />);
  });

  it("renders correctly", () => {
    shallow(<Popover />).should.matchSnapshot();
  });
});
