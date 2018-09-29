/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Target from "../../../src/zones/target/Target";

describe("<Target />", () => {
  it("should render", () => {
    mount(<Target />);
  });

  it("renders correctly", () => {
    shallow(<Target />).should.matchSnapshot();
  });
});
