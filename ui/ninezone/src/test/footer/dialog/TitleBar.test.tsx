/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { TitleBar } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<TitleBar />", () => {
  it("should render", () => {
    mount(<TitleBar />);
  });

  it("renders correctly", () => {
    shallow(<TitleBar />).should.matchSnapshot();
  });
});
