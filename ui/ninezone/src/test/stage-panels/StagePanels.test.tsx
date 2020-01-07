/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { StagePanels } from "../../ui-ninezone";

describe("<StagePanels />", () => {
  it("should render", () => {
    mount(<StagePanels />);
  });

  it("renders correctly", () => {
    shallow(<StagePanels />).should.matchSnapshot();
  });
});
