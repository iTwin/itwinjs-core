/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";

import { LoadingPrompt } from "../../ui-core";

describe("<LoadingBar />", () => {
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

  it("renders with text and message, and deterministic", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterministic={true} />).should.matchSnapshot();
  });

  it("renders with text and message, and deterministic", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterministic={true} percent={50} />).should.matchSnapshot();
  });

  it("renders with text and message, and deterministic", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterministic={true} percent={50} showCancel={true} />).should.matchSnapshot();
  });

  it("renders with text and message, and deterministic", () => {
    shallow(<LoadingPrompt title="title" message="description" isDeterministic={true} showStatus={true} percent={50} status="updating" />).should.matchSnapshot();
  });

});
