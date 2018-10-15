/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Assistance from "../../../src/footer/tool-assistance/Content";

describe("<Assistance />", () => {
  it("should render", () => {
    mount(<Assistance />);
  });

  it("renders correctly", () => {
    shallow(<Assistance />).should.matchSnapshot();
  });
});
