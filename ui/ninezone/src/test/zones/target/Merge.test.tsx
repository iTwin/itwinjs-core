/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { MergeTarget } from "../../../ui-ninezone";

describe("<MergeTarget />", () => {
  it("should render", () => {
    mount(<MergeTarget />);
  });

  it("renders correctly", () => {
    shallow(<MergeTarget />).should.matchSnapshot();
  });
});
