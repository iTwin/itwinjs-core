/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Outline } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<Outline />", () => {
  it("should render", () => {
    mount(<Outline bounds={{
      bottom: 0,
      left: 0,
      right: 5,
      top: 5,
    }} />);
  });

  it("renders correctly", () => {
    shallow(<Outline bounds={{
      bottom: 0,
      left: 0,
      right: 5,
      top: 5,
    }} />).should.matchSnapshot();
  });
});
