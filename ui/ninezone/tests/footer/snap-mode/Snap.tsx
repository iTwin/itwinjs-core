/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Snap from "../../../src/footer/snap-mode/Snap";

describe("<Snap />", () => {
  it("should render", () => {
    mount(<Snap />);
  });

  it("renders correctly", () => {
    shallow(<Snap />).should.matchSnapshot();
  });
});
