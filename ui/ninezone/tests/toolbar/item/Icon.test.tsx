/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Icon from "../../../src/toolbar/item/Icon";

describe("<Icon />", () => {
  it("should render", () => {
    mount(<Icon />);
  });

  it("renders correctly", () => {
    shallow(<Icon />).should.matchSnapshot();
  });
});
