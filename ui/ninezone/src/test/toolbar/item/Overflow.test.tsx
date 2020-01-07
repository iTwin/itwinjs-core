/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { Overflow } from "../../../ui-ninezone";

describe("<Overflow />", () => {
  it("should render", () => {
    mount(<Overflow />);
  });

  it("renders correctly", () => {
    shallow(<Overflow />).should.matchSnapshot();
  });
});
