/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SplitterTarget } from "../../../ui-ninezone";

describe("<SplitterTarget />", () => {
  it("should render", () => {
    mount(<SplitterTarget paneCount={1} />);
  });

  it("renders correctly", () => {
    shallow(<SplitterTarget paneCount={1} />).should.matchSnapshot();
  });

  it("renders vertical correctly", () => {
    shallow(<SplitterTarget paneCount={1} isVertical />).should.matchSnapshot();
  });
});
