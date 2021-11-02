/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Title } from "../../../../../appui-layout-react";
import { mount } from "../../../../Utils";

describe("<Title />", () => {
  it("should render", () => {
    mount(<Title />);
  });

  it("renders correctly", () => {
    shallow(<Title />).should.matchSnapshot();
  });
});
