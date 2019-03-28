/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { UserProfile } from "../../ui-ninezone";

describe("<UserProfile />", () => {
  it("should render", () => {
    mount(<UserProfile firstName="First" lastName="Last" email="spam@bentley.com" />);
  });

  it("renders correctly", () => {
    shallow(<UserProfile firstName="First" lastName="Last" email="spam@bentley.com" />).should.matchSnapshot();
  });

  it("renders w/o initials", () => {
    shallow(<UserProfile firstName="" lastName="" email="spam@bentley.com" />).should.matchSnapshot();
  });
});
