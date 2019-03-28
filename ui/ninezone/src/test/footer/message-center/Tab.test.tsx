/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageCenterTab } from "../../../ui-ninezone";

describe("<MessageCenterTab />", () => {
  it("should render", () => {
    mount(<MessageCenterTab />);
  });

  it("renders correctly", () => {
    shallow(<MessageCenterTab />).should.matchSnapshot();
  });

  it("should set is-open class", () => {
    shallow(<MessageCenterTab isOpen />).should.matchSnapshot();
  });
});
