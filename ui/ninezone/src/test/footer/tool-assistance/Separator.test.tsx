/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolAssistanceSeparator } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<ToolAssistanceSeparator />", () => {
  it("should render", () => {
    mount(<ToolAssistanceSeparator />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistanceSeparator />).should.matchSnapshot();
  });
});
