/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { GhostOutline } from "../../ui-ninezone";

describe("<GhostOutline />", () => {
  it("should render", () => {
    mount(<GhostOutline />);
  });

  it("renders correctly", () => {
    shallow(<GhostOutline />).should.matchSnapshot();
  });
});
