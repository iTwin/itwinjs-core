/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { NestedGroup } from "../../../../../appui-layout-react";
import { mount } from "../../../../Utils";

describe("<NestedGroup />", () => {
  it("should render", () => {
    mount(<NestedGroup />);
  });

  it("renders correctly", () => {
    shallow(<NestedGroup />).should.matchSnapshot();
  });
});
