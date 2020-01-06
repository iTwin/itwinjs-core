/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { ToolAssistanceDialog } from "../../../ui-ninezone";

describe("<ToolAssistanceDialog />", () => {
  it("should render", () => {
    mount(<ToolAssistanceDialog />);
  });

  it("renders correctly", () => {
    shallow(<ToolAssistanceDialog />).should.matchSnapshot();
  });
});
