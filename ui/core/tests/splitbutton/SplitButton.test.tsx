/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SplitButton } from "../../src/index";

describe("<SplitButton />", () => {
  it("should render", () => {
    mount(<SplitButton label="test" />);
  });

  it("renders correctly", () => {
    shallow(<SplitButton label="test" />).should.matchSnapshot();
  });
});
