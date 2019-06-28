/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { StagePanelTarget, StagePanelType } from "../../../ui-ninezone";

describe("<StagePanelTarget />", () => {
  it("should render", () => {
    mount(<StagePanelTarget type={StagePanelType.Left} />);
  });

  it("renders correctly", () => {
    shallow(<StagePanelTarget type={StagePanelType.Left} />).should.matchSnapshot();
  });
});
