/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Expandable from "../../../../src/toolbar/item/expandable/Expandable";

describe("<Expandable />", () => {
  it("should render", () => {
    mount(<Expandable />);
  });

  it("renders correctly", () => {
    shallow(<Expandable />).should.matchSnapshot();
  });
});
