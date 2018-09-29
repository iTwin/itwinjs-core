/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Overflow from "../../../src/toolbar/item/Overflow";

describe("<Overflow />", () => {
  it("should render", () => {
    mount(<Overflow />);
  });

  it("renders correctly", () => {
    shallow(<Overflow />).should.matchSnapshot();
  });
});
