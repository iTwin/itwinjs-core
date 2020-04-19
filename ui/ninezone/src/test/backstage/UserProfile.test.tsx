/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { UserProfile, SafeAreaInsets } from "../../ui-ninezone";

describe("<UserProfile />", () => {
  it("should render", () => {
    mount(<UserProfile />);
  });

  it("renders correctly", () => {
    shallow(<UserProfile />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<UserProfile safeAreaInsets={SafeAreaInsets.All} />).should.matchSnapshot();
  });
});
