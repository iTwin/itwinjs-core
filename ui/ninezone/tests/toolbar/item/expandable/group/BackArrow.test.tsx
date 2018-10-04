/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import BackArrow from "../../../../../src/toolbar/item/expandable/group/BackArrow";

describe("<BackArrow />", () => {
  it("should render", () => {
    mount(<BackArrow />);
  });

  it("renders correctly", () => {
    shallow(<BackArrow />).should.matchSnapshot();
  });
});
