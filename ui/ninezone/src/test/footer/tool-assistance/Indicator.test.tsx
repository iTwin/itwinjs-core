/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { ToolAssistance } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

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
