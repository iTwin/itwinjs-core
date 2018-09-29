/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import AppButton from "../../../src/toolbar/button/App";

describe("<AppButton />", () => {
  it("should render", () => {
    mount(<AppButton />);
  });

  it("renders correctly", () => {
    shallow(<AppButton />).should.matchSnapshot();
  });
});
