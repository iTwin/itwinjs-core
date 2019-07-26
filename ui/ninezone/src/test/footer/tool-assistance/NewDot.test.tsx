/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { NewDot } from "../../../ui-ninezone/footer/tool-assistance/NewDot";

describe("<NewDot />", () => {
  it("should render", () => {
    mount(<NewDot />);
  });

  it("renders correctly", () => {
    shallow(<NewDot />).should.matchSnapshot();
  });
});
