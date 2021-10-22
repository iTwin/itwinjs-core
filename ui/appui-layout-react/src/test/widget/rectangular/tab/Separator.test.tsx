/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { TabSeparator } from "../../../../appui-layout-react";
import { mount } from "../../../Utils";

describe("<TabSeparator />", () => {
  it("should render", () => {
    mount(<TabSeparator />);
  });

  it("renders correctly", () => {
    shallow(<TabSeparator />).should.matchSnapshot();
  });

  it("renders horizontal correctly", () => {
    shallow(<TabSeparator isHorizontal />).should.matchSnapshot();
  });
});
