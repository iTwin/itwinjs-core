/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LoadingBar } from "../../core-react";

describe("<LoadingBar />", () => {
  it("should render", () => {
    const wrapper = mount(
      <LoadingBar />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <LoadingBar />,
    ).should.matchSnapshot();
  });

  it("renders with percent correctly", () => {
    shallow(<LoadingBar percent={50} />).should.matchSnapshot();
  });

  it("renders with percent and show correctly", () => {
    shallow(<LoadingBar percent={50} showPercentage={true} />).should.matchSnapshot();
  });

  it("renders with percent, show and bar height correctly", () => {
    shallow(<LoadingBar percent={50} showPercentage={true} barHeight={10} />).should.matchSnapshot();
  });

});
