/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { GroupToolExpander } from "../../../../../../ui-ninezone";

describe("<GroupToolExpander />", () => {
  it("should render", () => {
    mount(<GroupToolExpander />);
  });

  it("renders correctly", () => {
    shallow(<GroupToolExpander />).should.matchSnapshot();
  });
});
