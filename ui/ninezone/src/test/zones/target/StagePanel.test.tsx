/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { StagePanelTarget, StagePanelType, SafeAreaInsets } from "../../../ui-ninezone";

describe("<StagePanelTarget />", () => {
  it("should render", () => {
    mount(<StagePanelTarget type={StagePanelType.Left} />);
  });

  it("renders correctly", () => {
    shallow(<StagePanelTarget type={StagePanelType.Left} />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<StagePanelTarget
      safeAreaInsets={SafeAreaInsets.All}
      type={StagePanelType.Left}
    />).should.matchSnapshot();
  });
});
