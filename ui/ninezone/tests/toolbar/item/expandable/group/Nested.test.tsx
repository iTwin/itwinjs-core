/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Nested from "../../../../../src/toolbar/item/expandable/group/Nested";

describe("<Nested />", () => {
  it("should render", () => {
    mount(<Nested />);
  });

  it("renders correctly", () => {
    shallow(<Nested />).should.matchSnapshot();
  });
});
