/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LoadingStatus } from "../../core-react";

describe("<LoadingStatus />", () => {
  it("should render", () => {
    const wrapper = mount(
      <LoadingStatus />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <LoadingStatus />,
    ).should.matchSnapshot();
  });

  it("renders with message correctly", () => {
    shallow(<LoadingStatus message="test" />).should.matchSnapshot();
  });

  it("renders with message and position correctly", () => {
    shallow(<LoadingStatus message="test" percent={50} />).should.matchSnapshot();
  });

});
