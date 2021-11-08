/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolAssistanceItem } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<ToolAssistanceItem />", () => {
  it("should render", () => {
    mount(<ToolAssistanceItem />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistanceItem />).should.matchSnapshot();
  });
});
