/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { BackstageSeparator } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<BackstageSeparator />", () => {
  it("should render", () => {
    mount(<BackstageSeparator />);
  });

  it("renders correctly", () => {
    shallow(<BackstageSeparator />).should.matchSnapshot();
  });
});
