/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Zones } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<Zones />", () => {
  it("should render", () => {
    mount(<Zones />);
  });

  it("renders correctly", () => {
    shallow(<Zones />).should.matchSnapshot();
  });

  it("renders hidden correctly", () => {
    shallow(<Zones isHidden />).should.matchSnapshot();
  });
});
