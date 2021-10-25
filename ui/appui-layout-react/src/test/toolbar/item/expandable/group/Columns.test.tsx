/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Columns } from "../../../../../appui-layout-react";
import { mount } from "../../../../Utils";

describe("<Columns />", () => {
  it("should render", () => {
    mount(<Columns />);
  });

  it("renders correctly", () => {
    shallow(<Columns />).should.matchSnapshot();
  });
});
