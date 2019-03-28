/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { SelectionInfo } from "../../../ui-ninezone";

describe("<SelectionInfo />", () => {
  it("should render", () => {
    mount(<SelectionInfo />);
  });

  it("renders correctly", () => {
    shallow(<SelectionInfo />).should.matchSnapshot();
  });

  it("renders correctly in footer mode", () => {
    shallow(<SelectionInfo isInFooterMode />).should.matchSnapshot();
  });
});
