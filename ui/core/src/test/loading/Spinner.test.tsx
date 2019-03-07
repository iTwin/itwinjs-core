/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";

import { Spinner, SpinnerSize } from "../../ui-core";

describe("<Spinner />", () => {
  it("should render", () => {
    const wrapper = mount(
      <Spinner />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <Spinner />,
    ).should.matchSnapshot();
  });

  it("should render small", () => {
    shallow(<Spinner size={SpinnerSize.Small} />).should.matchSnapshot();
  });

  it("should render medium", () => {
    shallow(<Spinner size={SpinnerSize.Medium} />).should.matchSnapshot();
  });

  it("should render large", () => {
    shallow(<Spinner size={SpinnerSize.Large} />).should.matchSnapshot();
  });

  it("should render x-large", () => {
    shallow(<Spinner size={SpinnerSize.XLarge} />).should.matchSnapshot();
  });

  it("should render with sizeClass", () => {
    shallow(<Spinner sizeClass="test-class" />).should.matchSnapshot();
  });

});
