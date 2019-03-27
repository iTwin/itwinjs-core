/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageResizeHandle } from "../../../../../ui-ninezone";

describe("<MessageResizeHandle  />", () => {
  it("should render", () => {
    mount(<MessageResizeHandle />);
  });

  it("renders correctly", () => {
    shallow(<MessageResizeHandle />).should.matchSnapshot();
  });
});
