/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Buttons } from "../../../../../../ui-ninezone";

describe("<Buttons  />", () => {
  it("should render", () => {
    mount(<Buttons />);
  });

  it("renders correctly", () => {
    shallow(<Buttons />).should.matchSnapshot();
  });
});
