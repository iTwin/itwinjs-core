/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SafeAreaInsets, StagePanelTarget, StagePanelType } from "../../../appui-layout-react";
import { mount } from "../../Utils";

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
