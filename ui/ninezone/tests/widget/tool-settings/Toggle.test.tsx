/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Toggle from "../../../src/widget/tool-settings/Toggle";

describe("<Toggle />", () => {
  it("should render", () => {
    mount(<Toggle />);
  });

  it("renders correctly", () => {
    shallow(<Toggle />).should.matchSnapshot();
  });
});
