/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Sticky from "../../../src/footer/message/Sticky";

describe("<Sticky />", () => {
  it("should render", () => {
    mount(<Sticky />);
  });

  it("renders correctly", () => {
    shallow(<Sticky />).should.matchSnapshot();
  });
});
