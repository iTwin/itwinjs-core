/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageCenterIndicator } from "../../../ui-ninezone";

describe("<MessageCenterIndicator />", () => {
  it("should render", () => {
    mount(<MessageCenterIndicator />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterIndicator />).should.matchSnapshot();
  });
});
