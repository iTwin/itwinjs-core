/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";

import { ImageCheckBox } from "../../ui-core";

describe("<ImageCheckBox />", () => {
  it("should render", () => {
    const wrapper = mount(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" />,
    );
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(
      <ImageCheckBox imageOn="icon-visibility" imageOff="icon-visibility-hide-2" />,
    ).should.matchSnapshot();
  });

});
