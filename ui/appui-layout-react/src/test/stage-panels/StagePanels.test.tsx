/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { StagePanels } from "../../appui-layout-react";
import { mount } from "../Utils";

describe("<StagePanels />", () => {
  it("should render", () => {
    mount(<StagePanels />);
  });

  it("renders correctly", () => {
    shallow(<StagePanels />).should.matchSnapshot();
  });
});
