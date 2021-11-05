/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolAssistance } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<ToolAssistance />", () => {
  it("should render", () => {
    mount(<ToolAssistance />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistance />).should.matchSnapshot();
  });

  it("renders correctly with label", () => {
    shallow(<ToolAssistance>Start Point</ToolAssistance>).should.matchSnapshot();
  });
});
