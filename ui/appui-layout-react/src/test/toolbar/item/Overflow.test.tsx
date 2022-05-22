/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { Overflow } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<Overflow />", () => {
  it("should render", () => {
    mount(<Overflow />);
  });

  it("renders correctly", () => {
    shallow(<Overflow />).should.matchSnapshot();
  });
});
