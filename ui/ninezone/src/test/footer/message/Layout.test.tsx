/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { MessageLayout } from "../../../ui-ninezone";

describe("<MessageLayout />", () => {
  it("should render", () => {
    mount(<MessageLayout />);
  });

  it("renders correctly", () => {
    shallow(<MessageLayout />).should.matchSnapshot();
  });
});
