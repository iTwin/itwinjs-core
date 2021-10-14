/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LoadingPrompt } from "../../core-react";

describe("<LoadingPrompt />", () => {
  it("should render", () => {
    const wrapper = mount(
      <LoadingPrompt />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <LoadingPrompt />,
    ).should.matchSnapshot();
  });

  it("renders with text correctly", () => {
    shallow(<LoadingPrompt title="title" />).should.matchSnapshot();
  });

  it("renders with text and message correctly", () => {
    shallow(<LoadingPrompt title="title" message="description" />).should.matchSnapshot();
  });

  it("renders with indeterminate ProgressBar", () => {
    shallow(<LoadingPrompt showIndeterminateBar />).should.matchSnapshot();
  });

  it("renders with text and message, and determinate", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterminate={true} />).should.matchSnapshot();
  });

  it("renders with text and message, and determinate and percent", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterminate={true} percent={50} />).should.matchSnapshot();
  });

  it("renders with text and message, and determinate and showCancel", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterminate={true} percent={50} showCancel={true} />).should.matchSnapshot();
  });

  it("renders with text and message, and determinate and showStatus", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterminate={true} showStatus={true} percent={50} status="updating" />).should.matchSnapshot();
  });

});
