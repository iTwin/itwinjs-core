/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Group } from "../../../../../appui-layout-react";
import { mount } from "../../../../Utils";

describe("<Group />", () => {
  it("should render", () => {
    mount(<Group />);
  });

  it("renders correctly", () => {
    shallow(<Group />).should.matchSnapshot();
  });

  it("renders with title and columns correctly", () => {
    shallow(<Group title="Test" columns={<div>columns</div>} />).should.matchSnapshot();
  });
});
