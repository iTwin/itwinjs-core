/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Expander from "../../../../../../src/toolbar/item/expandable/group/tool/Expander";

describe("<Expander />", () => {
  it("should render", () => {
    mount(<Expander />);
  });

  it("renders correctly", () => {
    shallow(<Expander />).should.matchSnapshot();
  });
});
