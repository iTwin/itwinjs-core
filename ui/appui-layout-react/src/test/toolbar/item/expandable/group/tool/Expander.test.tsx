/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { GroupToolExpander } from "../../../../../../appui-layout-react";
import { mount } from "../../../../../Utils";

describe("<GroupToolExpander />", () => {
  it("should render", () => {
    mount(<GroupToolExpander />);
  });

  it("renders correctly", () => {
    shallow(<GroupToolExpander />).should.matchSnapshot();
  });
});
