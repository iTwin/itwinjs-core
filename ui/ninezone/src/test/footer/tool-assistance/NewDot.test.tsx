/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { NewDot } from "../../../appui-layout-react/footer/tool-assistance/NewDot";
import { mount } from "../../Utils";

describe("<NewDot />", () => {
  it("should render", () => {
    mount(<NewDot />);
  });

  it("renders correctly", () => {
    shallow(<NewDot />).should.matchSnapshot();
  });
});
