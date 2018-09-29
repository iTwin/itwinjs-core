/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import ScrollableArea from "../../../src/widget/tool-settings/ScrollableArea";

describe("<ScrollableArea />", () => {
  it("should render", () => {
    mount(<ScrollableArea />);
  });

  it("renders correctly", () => {
    shallow(<ScrollableArea />).should.matchSnapshot();
  });
});
