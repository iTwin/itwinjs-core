/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SplitterTarget } from "../../../appui-layout-react";
import { mount } from "../../Utils";

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
