/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { SafeAreaInsets, UserProfile } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

describe("<UserProfile />", () => {
  it("should render", () => {
    mount(<UserProfile />);
  });

  it("renders correctly", () => {
    shallow(<UserProfile />).should.matchSnapshot();
  });

  it("renders correctly with given color", () => {
    shallow(<UserProfile color="#6ab9ec" />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<UserProfile safeAreaInsets={SafeAreaInsets.All} />).should.matchSnapshot();
  });
});
