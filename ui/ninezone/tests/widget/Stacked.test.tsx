/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Stacked, { HorizontalAnchor } from "../../src/widget/Stacked";

describe("<Stacked />", () => {
  it("should render", () => {
    mount(<Stacked horizontalAnchor={HorizontalAnchor.Right} />);
  });

  it("renders correctly", () => {
    shallow(<Stacked horizontalAnchor={HorizontalAnchor.Right} />).should.matchSnapshot();
  });
});
